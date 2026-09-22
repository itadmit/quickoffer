import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhook } from "@/lib/billing/hub";
import {
  clearPastDue,
  completeCheckout,
  downgradeToTrial,
  markPastDue,
  recordPaidPeriod,
} from "@/lib/billing/subscription";
import { db } from "@/lib/db";
import { billingEvents } from "@/lib/db/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Events from the billing hub (quick-billing).
 *
 * The hub signs the exact body with the endpoint secret and retries five times
 * with backoff on any non-2xx. That shapes the rules here:
 *  - verify before parsing anything, and 401 an unsigned body;
 *  - record the delivery id first, so a retry of something we already applied
 *    is a no-op rather than a second upgrade;
 *  - return 500 when handling genuinely failed, so the hub retries. Returning
 *    200 on failure would lose a paid subscription silently.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-quickcommerce-signature");
  const deliveryId = req.headers.get("x-quickcommerce-delivery-id");

  if (!(await verifyWebhook(raw, signature))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: { event?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const type = event.event ?? "";
  const data = event.data ?? {};
  const id = deliveryId ?? `${type}:${JSON.stringify(data)}`;

  // Claim the delivery. A conflict means we already handled it - the hub is
  // retrying because our response was lost, not because anything is pending.
  const claimed = await db
    .insert(billingEvents)
    .values({ id, eventType: type, payload: event })
    .onConflictDoNothing()
    .returning({ id: billingEvents.id });
  if (!claimed.length) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    const userId = await handle(type, data);
    if (userId) {
      await db.update(billingEvents).set({ userId }).where(eq(billingEvents.id, id));
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[billing webhook]", type, id, message);
    // Release the claim so the hub's retry gets a real attempt, and keep a
    // separate row as the record that this delivery failed once.
    await db.delete(billingEvents).where(eq(billingEvents.id, id)).catch(() => {});
    await db
      .insert(billingEvents)
      .values({
        id: `${id}:failed:${Date.now()}`,
        eventType: type,
        payload: event,
        error: message,
      })
      .onConflictDoNothing()
      .catch(() => {});
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
}

/** Returns the affected user id, when we could resolve one. */
async function handle(type: string, data: Record<string, unknown>): Promise<string | null> {
  const customerId = str(data.customer_id);

  switch (type) {
    case "payment_method.created": {
      const sessionId = str(data.setup_session_id);
      const paymentMethodId = str(data.payment_method_id);
      if (!sessionId || !paymentMethodId || !customerId) return null;
      const { user } = await completeCheckout({ sessionId, customerId, paymentMethodId });
      return user?.id ?? null;
    }

    case "invoice.paid":
    case "charge.succeeded": {
      if (!customerId) return null;
      const user = await recordPaidPeriod(customerId, str(data.current_period_end));
      return user?.id ?? null;
    }

    case "charge.recovered": {
      if (!customerId) return null;
      return (await clearPastDue(customerId))?.id ?? null;
    }

    case "charge.failed":
    case "invoice.failed":
    case "charge.dunning_started": {
      if (!customerId) return null;
      return (await markPastDue(customerId))?.id ?? null;
    }

    case "subscription.cancelled": {
      if (!customerId) return null;
      return (await downgradeToTrial(customerId))?.id ?? null;
    }

    case "payment_method.expired": {
      if (!customerId) return null;
      return (await markPastDue(customerId))?.id ?? null;
    }

    default:
      // Events we subscribe to but do not act on (customer.*, subscription.created
      // which we caused ourselves) are recorded and acknowledged.
      return null;
  }
}

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}
