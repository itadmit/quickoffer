import { count, desc, gte, sql } from "drizzle-orm";
import { PLAN_OFFERS } from "@/lib/billing/plans";
import { db } from "@/lib/db";
import { billingCheckouts, billingEvents, quotes, users } from "@/lib/db/schema";
import { describeSettings } from "@/lib/settings";
import { BillingForm } from "./billing-form";

export const dynamic = "force-dynamic";

/**
 * The money view: who is on what, what the hub connection looks like, and the
 * last events it sent us - which is the first place to look when someone says
 * "שילמתי ולא קיבלתי".
 */
export default async function AdminBilling() {
  const all = await describeSettings();
  const s = Object.fromEntries(all.map((x) => [x.key, x])) as Record<string, (typeof all)[number]>;
  const appUrl = s["app.url"].value.replace(/\/$/, "");

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [byPlan, [{ quotesThisMonth }], recentEvents, recentCheckouts] = await Promise.all([
    db.select({ plan: users.plan, users: count() }).from(users).groupBy(users.plan),
    db
      .select({ quotesThisMonth: sql<number>`count(*)::int` })
      .from(quotes)
      .where(gte(quotes.createdAt, monthStart)),
    db.select().from(billingEvents).orderBy(desc(billingEvents.at)).limit(10),
    db.select().from(billingCheckouts).orderBy(desc(billingCheckouts.createdAt)).limit(10),
  ]);

  const counts = new Map(byPlan.map((r) => [r.plan, r.users]));
  const mrr = PLAN_OFFERS.reduce((sum, o) => sum + o.price * (counts.get(o.plan) ?? 0), 0);
  const paying = PLAN_OFFERS.filter((o) => o.price > 0).reduce(
    (n, o) => n + (counts.get(o.plan) ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">תשלומים</h1>

      <div className="grid sm:grid-cols-4 gap-3 text-sm">
        <Stat label="הכנסה חודשית (₪)" value={mrr.toLocaleString("he-IL")} />
        <Stat label="משלמים" value={String(paying)} />
        <Stat label="בניסיון" value={String(counts.get("trial") ?? 0)} />
        <Stat label="הצעות החודש" value={String(quotesThisMonth)} />
      </div>

      <section className="rounded-2xl border border-line bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="p-2 text-start">חבילה</th>
              <th className="p-2 text-start">plan_code</th>
              <th className="p-2 text-start">מחיר</th>
              <th className="p-2 text-start">מכסה</th>
              <th className="p-2 text-start">משתמשים</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_OFFERS.map((o) => (
              <tr key={o.plan} className="border-t border-line">
                <td className="p-2 font-medium">{o.name}</td>
                <td className="p-2 text-muted" dir="ltr">{o.plan}</td>
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
          hubUrl: s["billing.hub_url"].value,
          productId: s["billing.product_id"].value,
          apiKeySet: !!s["billing.api_key"].value,
          apiSecretSet: !!s["billing.api_secret"].value,
          endpointSecretSet: !!s["billing.endpoint_secret"].value,
          webhookUrl: `${appUrl}/api/webhooks/billing`,
          botPhone: s["bot.phone"].value,
        }}
      />

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="space-y-2">
          <h2 className="font-bold">אירועים אחרונים מההאב</h2>
          <div className="rounded-2xl border border-line bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="p-2 text-start">זמן</th>
                  <th className="p-2 text-start">אירוע</th>
                  <th className="p-2 text-start">משתמש</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((e) => (
                  <tr key={e.id} className={`border-t border-line ${e.error ? "bg-danger/5" : ""}`}>
                    <td className="p-2 whitespace-nowrap">{e.at.toLocaleString("he-IL")}</td>
                    <td className="p-2" dir="ltr">{e.eventType}</td>
                    <td className="p-2 text-xs text-muted" dir="ltr">
                      {e.error ? e.error.slice(0, 60) : (e.userId?.slice(0, 8) ?? "-")}
                    </td>
                  </tr>
                ))}
                {!recentEvents.length && (
                  <tr>
                    <td className="p-4 text-muted" colSpan={3}>
                      עדיין לא התקבלו אירועים
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold">ניסיונות תשלום אחרונים</h2>
          <div className="rounded-2xl border border-line bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="p-2 text-start">זמן</th>
                  <th className="p-2 text-start">חבילה</th>
                  <th className="p-2 text-start">סכום</th>
                  <th className="p-2 text-start">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {recentCheckouts.map((c) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="p-2 whitespace-nowrap">{c.createdAt.toLocaleString("he-IL")}</td>
                    <td className="p-2" dir="ltr">{c.plan}</td>
                    <td className="p-2">{c.amount} ₪</td>
                    <td className={`p-2 ${c.status === "completed" ? "text-ok" : "text-muted"}`}>
                      {c.status}
                    </td>
                  </tr>
                ))}
                {!recentCheckouts.length && (
                  <tr>
                    <td className="p-4 text-muted" colSpan={4}>
                      עדיין אין ניסיונות
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
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
