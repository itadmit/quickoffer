import { and, avg, count, gte, isNotNull, sql, sum } from "drizzle-orm";
import { db } from "@/lib/db";
import { inboundMessages, processingRuns, quotes, users } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings";
import { keysConfigured } from "@/lib/ai";

/**
 * Every counter here is bounded by a date.
 *
 * The unbounded versions (all-time sum, all-time percentile over
 * processing_runs) read the whole table on every load, and this is the page
 * that gets refreshed most while a campaign is running - so it was the one
 * query set guaranteed to get slower exactly when attention is highest.
 * `processing_runs_at_idx` serves the window.
 */
const WINDOW_DAYS = 30;

export default async function AdminOverview() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);
  // Derived from startOfDay rather than Date.now(): the window lands on a day
  // boundary, so the numbers hold still while you are looking at them.
  const windowStart = new Date(startOfDay);
  windowStart.setDate(windowStart.getDate() - WINDOW_DAYS);

  const inWindow = gte(processingRuns.at, windowStart);

  const [[today], [month], [usersCount], [ai], [asrFail], [p90row], [unprocessed], [noCredit], instanceStatus, lastWebhook, keys] =
    await Promise.all([
      db.select({ n: count() }).from(quotes).where(gte(quotes.createdAt, startOfDay)),
      db.select({ n: count() }).from(quotes).where(gte(quotes.createdAt, startOfMonth)),
      db.select({ n: count() }).from(users),
      db
        .select({ cost: sum(processingRuns.costEstimate), avgMs: avg(processingRuns.totalMs), n: count() })
        .from(processingRuns)
        .where(inWindow),
      db
        .select({ n: count() })
        .from(processingRuns)
        .where(and(inWindow, isNotNull(processingRuns.error), sql`${processingRuns.error} like 'transcribe:%'`)),
      db
        .select({ p50: sql<number>`percentile_cont(0.5) within group (order by ${processingRuns.totalMs})`, p90: sql<number>`percentile_cont(0.9) within group (order by ${processingRuns.totalMs})` })
        .from(processingRuns)
        .where(and(inWindow, isNotNull(processingRuns.totalMs))),
      // Served by inbound_unprocessed_idx, the same partial index the cron uses.
      db.select({ n: count() }).from(inboundMessages).where(sql`${inboundMessages.processedAt} is null`),
      // A spent prepaid balance fails every quote and fixes itself for nobody,
      // so it gets its own light rather than hiding in the message log.
      db
        .select({ n: count() })
        .from(processingRuns)
        .where(
          and(
            gte(processingRuns.at, new Date(startOfDay.getTime() - 86_400_000)),
            sql`(${processingRuns.error} ilike '%insufficient_quota%' or ${processingRuns.error} ilike '%exceeded your current quota%' or ${processingRuns.error} ilike '%billing hard limit%')`,
          ),
        ),
      getSetting("ibot.instance_status"),
      getSetting("ibot.last_webhook_at"),
      keysConfigured(),
    ]);

  const tiles = [
    ["הצעות היום", today.n],
    ["הצעות החודש", month.n],
    ["משתמשים", usersCount.n],
    [`עלות AI (${WINDOW_DAYS} יום)`, `${Number(ai.cost ?? 0).toFixed(2)} ₪`],
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
      <p className="text-xs text-muted">
        עלות, זמני עיבוד וכשלי תמלול מחושבים על {WINDOW_DAYS} הימים האחרונים. מכסת ה-AI שנותרה נמצאת
        בלשונית ספקי AI.
      </p>

      <div className="grid md:grid-cols-2 gap-3">
        <Status ok={instanceStatus === "connected"} unknown={instanceStatus === "unknown"} title="iBot instance">
          סטטוס: {instanceStatus} · webhook אחרון: {lastWebhook ? new Date(lastWebhook).toLocaleString("he-IL") : "טרם התקבל"}
        </Status>
        <Status ok={keys.llm && keys.transcription && noCredit.n === 0} title="מפתחות AI">
          {noCredit.n > 0
            ? `נגמר הקרדיט אצל ספק ה-AI - ${noCredit.n} הצעות נכשלו ב-24 השעות האחרונות. טען יתרה, אין מה לחכות.`
            : keys.llm && keys.transcription
              ? "מפתח LLM ומפתח תמלול מוגדרים"
              : `חסר מפתח ${[!keys.llm && "LLM", !keys.transcription && "תמלול"].filter(Boolean).join(" ו")} - להגדיר בלשונית ספקי AI`}
        </Status>
      </div>
    </div>
  );
}

function Status({ ok, unknown, title, children }: { ok: boolean; unknown?: boolean; title: string; children: React.ReactNode }) {
  const cls = unknown ? "border-line" : ok ? "border-ok/40 bg-ok/5" : "border-danger/40 bg-danger/5";
  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <div className="font-semibold flex items-center gap-2">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${unknown ? "bg-muted" : ok ? "bg-ok" : "bg-danger"}`} />
        {title}
      </div>
      <div className="text-sm text-muted mt-1">{children}</div>
    </div>
  );
}
