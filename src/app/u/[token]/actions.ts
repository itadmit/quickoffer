"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { billingCheckouts, users } from "@/lib/db/schema";
import { createSetupSession, HubError, upsertCustomer } from "@/lib/billing/hub";
import { planName, priceOf } from "@/lib/billing/plans";
import { contactPhone } from "@/lib/quotes/service";
import { appUrl, resolveLink } from "@/lib/quotes/links";
import { CheckoutSchema, type CheckoutForm } from "./schema";

async function authorize(token: string) {
  const subject = await resolveLink(token, "s");
  if (!subject) return null;
  return db.query.users.findFirst({ where: eq(users.id, subject) });
}

/**
 * Start a subscription: register the customer with the billing hub, open a
 * hosted card page, and remember which plan this attempt was for.
 *
 * Nothing about the plan changes here. The professional is only upgraded when
 * the hub tells us the card went through (api/webhooks/billing) - believing a
 * redirect would mean handing out quota for a payment that never landed.
 */
export async function startCheckoutAction(token: string, form: CheckoutForm) {
  const user = await authorize(token);
  if (!user) return { ok: false as const, error: "unauthorized" };

  const parsed = CheckoutSchema.safeParse(form);
  if (!parsed.success) return { ok: false as const, error: "invalid" };
  const { plan, email, vatNumber } = parsed.data;

  const amount = priceOf(plan);
  if (!amount) return { ok: false as const, error: "invalid" };

  try {
    const customer = await upsertCustomer({
      email,
      phone: contactPhone(user) ?? undefined,
      name: user.businessName ?? user.displayName ?? undefined,
      company_name: user.businessName ?? undefined,
      vat_number: vatNumber || undefined,
      external_id: user.id,
    });

    const base = await appUrl();
    const session = await createSetupSession({
      customer_id: customer.id,
      amount,
      description: `QuickOffer - חבילת ${planName(plan)}`,
      success_url: `${base}/u/${token}/done?s=ok`,
      failure_url: `${base}/u/${token}/done?s=fail`,
      cancel_url: `${base}/u/${token}`,
    });

    await db.insert(billingCheckouts).values({
      userId: user.id,
      plan,
      amount,
      hubCustomerId: customer.id,
      hubSessionId: session.session_id,
    });

    // Keep the email and the hub id so a second upgrade skips the form.
    await db
      .update(users)
      .set({ billingEmail: email, billingCustomerId: customer.id, taxId: vatNumber || user.taxId })
      .where(eq(users.id, user.id));

    return { ok: true as const, url: session.payment_page_url };
  } catch (err) {
    console.error("[checkout]", user.id, err);
    if (err instanceof HubError && err.code === "NOT_CONFIGURED") {
      return { ok: false as const, error: "not_configured" };
    }
    return { ok: false as const, error: "hub" };
  }
}
