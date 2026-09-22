import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { billingCheckouts, users, type User } from "../db/schema";
import { upgradeLink } from "../quotes/links";
import { sendText } from "../whatsapp";
import { createSubscription } from "./hub";
import { billing as msg } from "../conversation/messages";
import { planName } from "./plans";

/**
 * What the billing hub's events mean for a professional's plan.
 *
 * The hub is the authority on money; this module is the authority on quota.
 * Everything here has to be safe to run twice - the hub retries a webhook up
 * to five times, and a retry must never charge, upgrade or downgrade twice.
 */

/** The card was stored and the first charge went through. */
export async function completeCheckout(params: {
  sessionId: string;
  customerId: string;
  paymentMethodId: string;
}): Promise<{ user: User | null; already: boolean }> {
  const checkout = await db.query.billingCheckouts.findFirst({
    where: eq(billingCheckouts.hubSessionId, params.sessionId),
  });
  if (!checkout) return { user: null, already: false };
  if (checkout.status === "completed") {
    const user = await db.query.users.findFirst({ where: eq(users.id, checkout.userId) });
    return { user: user ?? null, already: true };
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, checkout.userId) });
  if (!user) return { user: null, already: false };

  // Creating the subscription is the step that can fail on the hub side. Do it
  // before touching our own state, and let the caller signal a retry - a plan
  // granted without a subscription behind it bills nobody next month.
  const sub = await createSubscription({
    customer_id: params.customerId,
    plan_code: checkout.plan,
    payment_method_id: params.paymentMethodId,
  });

  await db
    .update(users)
    .set({
      plan: checkout.plan,
      billingCustomerId: params.customerId,
      billingSubscriptionId: sub.id,
      billingPastDueAt: null,
      planExpiresAt: sub.current_period_end ? new Date(sub.current_period_end) : null,
    })
    .where(eq(users.id, user.id));

  await db
    .update(billingCheckouts)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(billingCheckouts.id, checkout.id));

  await sendText(user.phone, msg.upgraded(planName(checkout.plan), await upgradeLink(user.id)));
  return { user, already: false };
}

/** Renewal paid. Extend the window and clear any past-due flag. */
export async function recordPaidPeriod(customerId: string, periodEnd: string | null) {
  const user = await byCustomerId(customerId);
  if (!user) return null;
  await db
    .update(users)
    .set({
      billingPastDueAt: null,
      ...(periodEnd ? { planExpiresAt: new Date(periodEnd) } : {}),
    })
    .where(eq(users.id, user.id));
  return user;
}

/**
 * A charge failed. The hub runs dunning (retries at 1, 3 and 7 days), so the
 * plan stays put - we flag it and tell the professional once, while there is
 * still time to fix the card.
 */
export async function markPastDue(customerId: string): Promise<User | null> {
  const user = await byCustomerId(customerId);
  if (!user) return null;
  if (user.billingPastDueAt) return user; // already told them
  await db
    .update(users)
    .set({ billingPastDueAt: new Date() })
    .where(eq(users.id, user.id));
  await sendText(user.phone, msg.chargeFailed(planName(user.plan), await upgradeLink(user.id)));
  return user;
}

/** Dunning recovered the payment. */
export async function clearPastDue(customerId: string): Promise<User | null> {
  const user = await byCustomerId(customerId);
  if (!user?.billingPastDueAt) return user;
  await db.update(users).set({ billingPastDueAt: null }).where(eq(users.id, user.id));
  await sendText(user.phone, msg.chargeRecovered(planName(user.plan)));
  return user;
}

/**
 * The subscription ended - cancelled by us, by them, or by dunning giving up.
 * Back to the free tier; quotes already sent keep working, they just cannot
 * create new ones past the trial allowance.
 */
export async function downgradeToTrial(customerId: string): Promise<User | null> {
  const user = await byCustomerId(customerId);
  if (!user || user.plan === "trial") return user;
  const previous = user.plan;
  await db
    .update(users)
    .set({
      plan: "trial",
      billingSubscriptionId: null,
      billingPastDueAt: null,
      planExpiresAt: null,
    })
    .where(eq(users.id, user.id));
  await sendText(user.phone, msg.cancelled(planName(previous), await upgradeLink(user.id)));
  return user;
}

async function byCustomerId(customerId: string): Promise<User | null> {
  const direct = await db.query.users.findFirst({
    where: eq(users.billingCustomerId, customerId),
  });
  if (direct) return direct;
  // A customer we have not linked yet (first event arriving out of order):
  // fall back to the most recent checkout for that hub customer.
  const checkout = await db.query.billingCheckouts.findFirst({
    where: eq(billingCheckouts.hubCustomerId, customerId),
    orderBy: desc(billingCheckouts.createdAt),
  });
  if (!checkout) return null;
  return (await db.query.users.findFirst({ where: eq(users.id, checkout.userId) })) ?? null;
}
