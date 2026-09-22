import { and, count, eq, gte, sql } from "drizzle-orm";
import { PLAN_OFFERS } from "@/lib/billing";
import { db } from "@/lib/db";
import { quotes, users } from "@/lib/db/schema";
import { describeSettings } from "@/lib/settings";
import { BillingForm } from "./billing-form";

export const dynamic = "force-dynamic";

/**
 * Where each paid plan's "שדרג" button points, plus who is on what.
 *
 * Billing is manual for the demo (§11), so an empty URL is a valid state - it
 * falls back to a WhatsApp message to the bot number.
 */
export default async function AdminBilling() {
  const all = await describeSettings();
  const s = Object.fromEntries(all.map((x) => [x.key, x])) as Record<string, (typeof all)[number]>;

  const byPlan = await db
    .select({ plan: users.plan, users: count() })
    .from(users)
    .groupBy(users.plan);

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [{ quotesThisMonth }] = await db
    .select({ quotesThisMonth: sql<number>`count(*)::int` })
    .from(quotes)
    .where(gte(quotes.createdAt, monthStart));

  const atLimit = await db
    .select({ plan: users.plan, id: users.id })
    .from(users)
    .where(and(eq(users.plan, "trial"), eq(users.blocked, false)));

  const counts = new Map(byPlan.map((r) => [r.plan, r.users]));
  const mrr = PLAN_OFFERS.reduce((sum, o) => sum + o.price * (counts.get(o.plan) ?? 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">תשלומים</h1>

      <div className="grid sm:grid-cols-3 gap-3 text-sm">
        <Stat label="הכנסה חודשית (₪)" value={mrr.toLocaleString("he-IL")} />
        <Stat label="הצעות החודש" value={String(quotesThisMonth)} />
        <Stat label="משתמשים בניסיון" value={String(atLimit.length)} />
      </div>

      <section className="rounded-2xl border border-line bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="p-2 text-start">חבילה</th>
              <th className="p-2 text-start">מחיר</th>
              <th className="p-2 text-start">מכסה</th>
              <th className="p-2 text-start">משתמשים</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_OFFERS.map((o) => (
              <tr key={o.plan} className="border-t border-line">
                <td className="p-2 font-medium">{o.name}</td>
                <td className="p-2">{o.price ? `${o.price} ₪` : "חינם"}</td>
                <td className="p-2 text-muted">{o.quota}</td>
                <td className="p-2">{counts.get(o.plan) ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <BillingForm
        current={{
          basic: s["billing.checkout_basic"].value,
          pro: s["billing.checkout_pro"].value,
          unlimited: s["billing.checkout_unlimited"].value,
          botPhone: s["bot.phone"].value,
        }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="font-semibold text-lg mt-1">{value}</div>
    </div>
  );
}
