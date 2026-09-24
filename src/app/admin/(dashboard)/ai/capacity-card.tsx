"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Gauge, RefreshCw } from "lucide-react";
import type { AiCapacity, ChannelUsage, RateLimit } from "@/lib/ai/limits";
import { TRANSCRIPTION_CHOICES, type TranscriptionChoice } from "@/lib/ai/transcription-choices";
import { probeAiCapacityAction, switchTranscriptionAction } from "../actions";

export type TodayUsage = {
  runs: number;
  llmTokens: number;
  transcriptions: number;
  cost: number;
};

const BOTTLENECK_TEXT: Record<NonNullable<AiCapacity["bottleneck"]>, string> = {
  "llm-tokens": "החסם הוא התקרה הדקתית של ה-LLM. גם אם נשארו בקשות ליום, מעבר לקצב הזה הודעות יקבלו 429.",
  "llm-requests": "החסם הוא מספר בקשות ה-LLM ליום.",
  "transcription-requests": "החסם הוא מספר בקשות התמלול ליום.",
};

export function CapacityCard({
  today,
  transcription,
}: {
  today: TodayUsage;
  transcription: { provider: string; model: string };
}) {
  const [data, setData] = useState<AiCapacity | null>(null);
  const [pending, start] = useTransition();
  const [switching, startSwitch] = useTransition();
  const [switchMsg, setSwitchMsg] = useState<string | null>(null);

  const active = (transcription.provider in TRANSCRIPTION_CHOICES
    ? transcription.provider
    : null) as TranscriptionChoice | null;
  const other: TranscriptionChoice | null =
    active === "groq" ? "openai" : active === "openai" ? "groq" : null;
  const cap = active ? TRANSCRIPTION_CHOICES[active].dailyLimit : null;

  const swap = (to: TranscriptionChoice) =>
    startSwitch(async () => {
      const r = await switchTranscriptionAction(to);
      setSwitchMsg(r.ok ? `הועבר ל-${TRANSCRIPTION_CHOICES[to].label}` : r.error);
    });

  const probe = () =>
    start(async () => {
      setData(await probeAiCapacityAction());
    });

  return (
    <section className="rounded-2xl border border-line bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Gauge className="h-4 w-4 text-brand" />
        <h2 className="font-bold">מכסה ושימוש</h2>
        <button type="button" onClick={probe} disabled={pending} className="btn-secondary text-sm ms-auto">
          <RefreshCw className={`h-3.5 w-3.5 inline-block me-1 ${pending ? "animate-spin" : ""}`} />
          {pending ? "בודק…" : "בדוק מכסה מול הספק"}
        </button>
      </div>

      <p className="text-sm text-muted">
        ל-Groq ול-OpenAI אין API ליתרה כספית. בתוכנית החינמית של Groq גם אין יתרה - יש תקרות קצב, והן מה
        שקובע אם ההודעה הקולית הבאה תקבל מענה. הנתונים למטה נקראים מכותרות ה-<code dir="ltr">x-ratelimit</code> של
        הספק. הבדיקה עצמה צורכת בקשה אחת מכל מכסה יומית, ולכן היא בלחיצה ולא בכל טעינת עמוד.
      </p>

      <div className="grid sm:grid-cols-4 gap-3">
        <Tile label="הצעות שעובדו היום" value={today.runs} />
        <Tile
          label="תמלולים היום"
          value={cap ? `${today.transcriptions} / ${cap.toLocaleString("he-IL")}` : today.transcriptions}
        />
        <Tile label="טוקנים היום" value={today.llmTokens.toLocaleString("he-IL")} />
        <Tile label="עלות AI היום" value={`${today.cost.toFixed(2)} ₪`} />
      </div>

      <TranscriptionEngine
        active={active}
        other={other}
        model={transcription.model}
        usedToday={today.transcriptions}
        cap={cap}
        onSwap={swap}
        busy={switching}
        message={switchMsg}
      />

      {data && (
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Tile
              label="הצעות שנותרו היום"
              value={data.quotesLeftToday ?? "לא ידוע"}
              hint={`לפי ${2} בקשות LLM ותמלול אחד להצעה`}
            />
            <Tile
              label="קצב מרבי"
              value={data.quotesPerMinute !== null ? `${data.quotesPerMinute} הצעות/דקה` : "לא ידוע"}
              hint="מוגבל ע״י תקרת הטוקנים לדקה"
            />
          </div>

          {data.bottleneck && (
            <p className="text-sm rounded-xl border border-danger/40 bg-danger/5 p-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-danger" />
              <span>{BOTTLENECK_TEXT[data.bottleneck]}</span>
            </p>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <Channel title="LLM" usage={data.llm} />
            <Channel title="תמלול" usage={data.transcription} />
          </div>

          <p className="text-xs text-muted">
            נבדק ב-{new Date(data.checkedAt).toLocaleTimeString("he-IL")}. המכסות של Groq מתמלאות בזליגה ולא
            באיפוס בשעה קבועה, כך ששעה שקטה מחזירה חלק מהמכסה מעצמה.
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * The daily ceiling is the one number worth watching while a campaign runs, so
 * it is shown for free from processing_runs rather than only behind the probe.
 */
function TranscriptionEngine({
  active, other, model, usedToday, cap, onSwap, busy, message,
}: {
  active: TranscriptionChoice | null;
  other: TranscriptionChoice | null;
  model: string;
  usedToday: number;
  cap: number | null;
  onSwap: (to: TranscriptionChoice) => void;
  busy: boolean;
  message: string | null;
}) {
  const pct = cap ? Math.min(100, (usedToday / cap) * 100) : 0;
  const tight = cap !== null && pct >= 75;
  return (
    <div className={`rounded-xl border p-3 space-y-3 ${tight ? "border-danger/40 bg-danger/5" : "border-line"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">מנוע תמלול</span>
        <span className="text-xs text-muted" dir="ltr">{active ?? "?"} · {model}</span>
        {other && (
          <button
            type="button"
            onClick={() => onSwap(other)}
            disabled={busy}
            className="btn-secondary text-sm ms-auto"
          >
            {busy ? "מעביר…" : `העבר ל-${TRANSCRIPTION_CHOICES[other].label}`}
          </button>
        )}
      </div>

      {cap !== null ? (
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted">נוצלו היום</span>
            <span dir="ltr">{usedToday.toLocaleString("he-IL")} / {cap.toLocaleString("he-IL")}</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface overflow-hidden">
            <div className={`h-full rounded-full ${tight ? "bg-danger" : pct >= 50 ? "bg-warn-ink" : "bg-ok"}`} style={{ width: `${pct}%` }} />
          </div>
          {tight && (
            <p className="text-xs text-danger">
              מתקרב לתקרה. מעבר ל-{other ? TRANSCRIPTION_CHOICES[other].label : "OpenAI"} מסיר אותה.
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted">אין תקרה יומית אצל הספק הזה.</p>
      )}

      <div className="grid sm:grid-cols-2 gap-2 text-xs">
        {(Object.keys(TRANSCRIPTION_CHOICES) as TranscriptionChoice[]).map((k) => {
          const c = TRANSCRIPTION_CHOICES[k];
          return (
            <div key={k} className={`rounded-lg border p-2 ${k === active ? "border-brand/50 bg-brand/5" : "border-line"}`}>
              <div className="font-medium">
                {c.label}
                {k === active && <span className="text-brand"> · פעיל</span>}
              </div>
              <div className="text-muted mt-0.5">
                {c.agorotPer20s} אגורות להקלטה · {c.typicalMs}ms · {c.note}
              </div>
            </div>
          );
        })}
      </div>

      {message && <p className="text-sm">{message}</p>}
    </div>
  );
}

function Channel({ title, usage }: { title: string; usage: ChannelUsage }) {
  return (
    <div className="rounded-xl border border-line p-3 space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="font-semibold">{title}</span>
        <span className="text-xs text-muted" dir="ltr">
          {usage.provider} · {usage.model}
        </span>
      </div>
      {usage.error && <p className="text-sm text-danger">{usage.error}</p>}
      <Bar label="בקשות ליום" limit={usage.requests} />
      <Bar label="טוקנים לדקה" limit={usage.tokens} />
    </div>
  );
}

function Bar({ label, limit }: { label: string; limit: RateLimit }) {
  if (limit.limit === null || limit.remaining === null) {
    return (
      <div className="text-xs text-muted">
        {label}: הספק לא דיווח
      </div>
    );
  }
  const pct = Math.max(0, Math.min(100, (limit.remaining / limit.limit) * 100));
  const tone = pct < 15 ? "bg-danger" : pct < 40 ? "bg-warn-ink" : "bg-ok";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span dir="ltr">
          {limit.remaining.toLocaleString("he-IL")} / {limit.limit.toLocaleString("he-IL")}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface overflow-hidden">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      {limit.resetSeconds !== null && (
        <div className="text-xs text-muted">התחדשות מלאה של מה שנוצל: {formatReset(limit.resetSeconds)}</div>
      )}
    </div>
  );
}

function formatReset(seconds: number): string {
  if (seconds < 1) return `${Math.round(seconds * 1000)} מילישניות`;
  if (seconds < 60) return `${seconds.toFixed(1)} שניות`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} דקות`;
  return `${(seconds / 3600).toFixed(1)} שעות`;
}

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-xl font-bold mt-0.5">{value}</div>
      {hint && <div className="text-xs text-muted mt-0.5">{hint}</div>}
    </div>
  );
}
