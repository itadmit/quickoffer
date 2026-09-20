"use client";

import { useState, useTransition } from "react";
import { saveSettingsAction, telegramSetWebhookAction, telegramTestAction } from "../actions";

type Props = { current: { token: { value: string; source: string }; secretSet: boolean; username: string; appUrl: string } };

export function TelegramForm({ current }: Props) {
  const [token, setToken] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <section className="rounded-2xl border border-line bg-card p-4 space-y-3">
        <h2 className="font-bold">הגדרות</h2>
        <label className="block">
          <span className="label">Bot token <span className="text-xs">· נוכחי: <code dir="ltr">{current.token.value || "—"}</code> ({current.token.source})</span></span>
          <input className="input" dir="ltr" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456:ABC-DEF…" />
        </label>
        <div className="text-sm text-muted space-y-1">
          <div>Bot: {current.username ? <a href={`https://t.me/${current.username}`} target="_blank" className="underline" dir="ltr">@{current.username}</a> : "—"}</div>
          <div>Webhook secret: {current.secretSet ? "מוגדר" : "ייווצר אוטומטית בלחיצה על 'הגדר webhook'"}</div>
          <div>Webhook URL: <code dir="ltr">{current.appUrl.replace(/\/$/, "")}/api/webhooks/telegram</code></div>
        </div>
        <button disabled={pending || !token} onClick={() => start(async () => { await saveSettingsAction({ "telegram.bot_token": token }); setToken(""); setResult("הטוקן נשמר ✓"); })} className="btn-primary">שמור טוקן</button>
      </section>
      <section className="rounded-2xl border border-line bg-card p-4 space-y-3">
        <h2 className="font-bold">חיבור</h2>
        <div className="flex flex-wrap gap-2">
          <button disabled={pending} onClick={() => start(async () => { const r = await telegramTestAction(); setResult(r.ok ? `getMe ✓ ${JSON.stringify(r.me)}` : `נכשל: ${r.error}`); })} className="btn-secondary">בדוק טוקן (getMe)</button>
          <button disabled={pending} onClick={() => start(async () => { const r = await telegramSetWebhookAction(); setResult(r.ok ? `webhook הוגדר ✓ @${r.username} → ${r.url}` : `נכשל: ${r.error}`); })} className="btn-primary">הגדר webhook</button>
        </div>
        <p className="text-xs text-muted">ה-webhook חייב כתובת HTTPS ציבורית (Vercel, או ngrok מקומית) - עדכן קודם את &quot;כתובת האפליקציה&quot; בלשונית iBot.</p>
        {result && <pre dir="ltr" className="text-xs bg-surface rounded-xl p-3 whitespace-pre-wrap">{result}</pre>}
      </section>
    </div>
  );
}
