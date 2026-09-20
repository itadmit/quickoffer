import { and, avg, count, gte, isNotNull, sql, sum } from "drizzle-orm";
import { db } from "@/lib/db";
import { inboundMessages, processingRuns, quotes, users } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings";

export default async function AdminOverview() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);

  const [[today], [month], [usersCount], [ai], [asrFail], [p90row], instanceStatus, lastWebhook, aiKeySet] =
    await Promise.all([
      db.select({ n: count() }).from(quotes).where(gte(quotes.createdAt, startOfDay)),
      db.select({ n: count() }).from(quotes).where(gte(quotes.createdAt, startOfMonth)),
      db.select({ n: count() }).from(users),
      db
        .select({ cost: sum(processingRuns.costEstimate), avgMs: avg(processingRuns.totalMs), n: count() })
        .from(processingRuns),
      db
        .select({ n: count() })
        .from(processingRuns)
        .where(and(isNotNull(processingRuns.error), sql`${processingRuns.error} like 'transcribe:%'`)),
      db
        .select({ p50: sql<number>`percentile_cont(0.5) within group (order by ${processingRuns.totalMs})`, p90: sql<number>`percentile_cont(0.9) within group (order by ${processingRuns.totalMs})` })
        .from(processingRuns)
        .where(isNotNull(processingRuns.totalMs)),
      getSetting("ibot.instance_status"),
      getSetting("ibot.last_webhook_at"),
      getSetting("llm.api_key").then((k) => !!k),
    ]);
  const [unprocessed] = await db
    .select({ n: count() })
    .from(inboundMessages)
    .where(and(sql`${inboundMessages.processedAt} is null`));

  const tiles = [
    ["הצעות היום", today.n],
    ["הצעות החודש", month.n],
    ["משתמשים", usersCount.n],
    ["עלות AI מצטברת", `${Number(ai.cost ?? 0).toFixed(2)} ₪`],
    ["זמן עיבוד p50 / p90", p90row?.p50 ? `${(p90row.p50 / 1000).toFixed(1)}s / ${(p90row.p90 / 1000).toFixed(1)}s` : "-"],
    ["כשלי תמלול", `${asrFail.n} / ${ai.n}`],
    ["הודעות ממתינות", unprocessed.n],
  ] as const;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">סקירה</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-card p-4">
            <div className="text-xs text-muted">{label}</div>
            <div className="text-2xl font-bold mt-1">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Status ok={instanceStatus === "connected"} unknown={instanceStatus === "unknown"} title="iBot instance">
          סטטוס: {instanceStatus} · webhook אחרון: {lastWebhook ? new Date(lastWebhook).toLocaleString("he-IL") : "טרם התקבל"}
        </Status>
        <Status ok={aiKeySet} title="מפתחות AI">
          {aiKeySet ? "מפתח LLM מוגדר" : "אין מפתח LLM - הגדר בלשונית ספקי AI"}
        </Status>
      </div>
    </div>
  );
}

function Status({ ok, unknown, title, children }: { ok: boolean; unknown?: boolean; title: string; children: React.ReactNode }) {
  const cls = unknown ? "border-line" : ok ? "border-ok/40 bg-ok/5" : "border-danger/40 bg-danger/5";
  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <div className="font-semibold">{unknown ? "⚪" : ok ? "🟢" : "🔴"} {title}</div>
      <div className="text-sm text-muted mt-1">{children}</div>
    </div>
  );
}
