import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { outboundMessages } from "@/lib/db/schema";
import { describeSettings } from "@/lib/settings";
import { IbotForm } from "./ibot-form";

export default async function AdminIbot() {
  const all = await describeSettings();
  const s = Object.fromEntries(all.map((x) => [x.key, x])) as Record<string, (typeof all)[number]>;
  const lastOut = await db.select().from(outboundMessages).orderBy(desc(outboundMessages.at)).limit(10);
  const webhookUrl = `${s["app.url"].value.replace(/\/$/, "")}/api/webhooks/ibot`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">iBot</h1>
      <div className="grid md:grid-cols-3 gap-3 text-sm">
        <Info label="סטטוס instance" value={s["ibot.instance_status"].value} tone={s["ibot.instance_status"].value === "connected" ? "ok" : s["ibot.instance_status"].value === "unknown" ? undefined : "bad"} />
        <Info label="נבדק לאחרונה" value={fmt(s["ibot.instance_checked_at"].value)} />
        <Info label="webhook אחרון" value={fmt(s["ibot.last_webhook_at"].value)} />
      </div>
      <div className="rounded-2xl border border-line bg-card p-4 text-sm space-y-1">
        <div className="font-semibold">כתובת ה-webhook להגדרה בדשבורד iBot</div>
        <code dir="ltr" className="block bg-surface rounded-lg p-2 select-all">{webhookUrl}</code>
        <p className="text-muted">חובה ליצור webhook token בעמוד ה-webhook ב-iBot ולהדביק אותו כאן - בלעדיו iBot לא שולח את ה-header ואנחנו מחזירים 401.</p>
      </div>
      <IbotForm
        current={{
          token: { value: s["ibot.token"].value, source: s["ibot.token"].source },
          instanceId: s["ibot.instance_id"].value,
          webhookToken: { value: s["ibot.webhook_token"].value, source: s["ibot.webhook_token"].source },
          baseUrl: s["ibot.base_url"].value,
          appUrl: s["app.url"].value,
          botPhone: s["bot.phone"].value,
        }}
      />
      <section className="space-y-2">
        <h2 className="font-bold">10 שליחות אחרונות</h2>
        <div className="rounded-2xl border border-line bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted"><tr><th className="p-2 text-start">זמן</th><th className="p-2 text-start">אל</th><th className="p-2 text-start">סוג</th><th className="p-2 text-start">תוכן</th><th className="p-2 text-start">תשובת iBot</th></tr></thead>
            <tbody>
              {lastOut.map((m) => (
                <tr key={m.id} className={`border-t border-line ${m.ok ? "" : "bg-danger/5"}`}>
                  <td className="p-2 whitespace-nowrap">{m.at.toLocaleString("he-IL")}</td>
                  <td className="p-2" dir="ltr">{m.userPhone}</td>
                  <td className="p-2">{m.type}</td>
                  <td className="p-2 max-w-xs truncate">{m.body}</td>
                  <td className="p-2 max-w-xs truncate text-xs" dir="ltr">{JSON.stringify(m.ibotResponse)}</td>
                </tr>
              ))}
              {!lastOut.length && <tr><td className="p-4 text-muted" colSpan={5}>עדיין לא נשלח דבר</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const fmt = (iso: string) => (iso ? new Date(iso).toLocaleString("he-IL") : "-");

function Info({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" }) {
  const cls = tone === "ok" ? "border-ok/40 bg-ok/5" : tone === "bad" ? "border-danger/40 bg-danger/5" : "border-line bg-card";
  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className="font-semibold mt-1">{value}</div>
    </div>
  );
}
