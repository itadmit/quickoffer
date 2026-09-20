"use client";

import { useState, useTransition } from "react";
import { saveSettingsAction, sendTestMessageAction } from "../actions";

type Cur = { value: string; source: string };
export function IbotForm({ current }: { current: { token: Cur; instanceId: string; webhookToken: Cur; baseUrl: string; appUrl: string; botPhone: string } }) {
  const [v, setV] = useState({ "ibot.token": "", "ibot.instance_id": current.instanceId, "ibot.webhook_token": "", "ibot.base_url": current.baseUrl, "app.url": current.appUrl, "bot.phone": current.botPhone });
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v, val: string) => setV((s) => ({ ...s, [k]: val }));
  const mask = (s: string) => (!s ? "—" : s.length <= 8 ? "••••" : `${s.slice(0, 3)}…${s.slice(-4)}`);

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <section className="rounded-2xl border border-line bg-card p-4 space-y-3">
        <h2 className="font-bold">הגדרות</h2>
        <label className="block"><span className="label">API token <span className="text-xs">· נוכחי: <code dir="ltr">{mask(current.token.value)}</code> ({current.token.source})</span></span>
          <input className="input" dir="ltr" type="password" autoComplete="off" value={v["ibot.token"]} onChange={(e) => set("ibot.token", e.target.value)} placeholder="הדבק כדי להחליף" /></label>
        <label className="block"><span className="label">instance_id</span>
          <input className="input" dir="ltr" value={v["ibot.instance_id"]} onChange={(e) => set("ibot.instance_id", e.target.value)} /></label>
        <label className="block"><span className="label">Webhook token (X-Webhook-Token) <span className="text-xs">· נוכחי: <code dir="ltr">{mask(current.webhookToken.value)}</code> ({current.webhookToken.source})</span></span>
          <input className="input" dir="ltr" type="password" autoComplete="off" value={v["ibot.webhook_token"]} onChange={(e) => set("ibot.webhook_token", e.target.value)} placeholder="הדבק כדי להחליף" /></label>
        <label className="block"><span className="label">iBot API base URL</span>
          <input className="input" dir="ltr" value={v["ibot.base_url"]} onChange={(e) => set("ibot.base_url", e.target.value)} /></label>
        <label className="block"><span className="label">מספר ה-WhatsApp של הבוט (לדף הנחיתה, ספרות בלבד)</span>
          <input className="input" dir="ltr" inputMode="tel" value={v["bot.phone"]} onChange={(e) => set("bot.phone", e.target.value.replace(/\D/g, ""))} placeholder="9725XXXXXXXX" /></label>
        <label className="block"><span className="label">כתובת האפליקציה (לקישורים ב-WhatsApp)</span>
          <input className="input" dir="ltr" value={v["app.url"]} onChange={(e) => set("app.url", e.target.value)} placeholder="https://quickvoice.vercel.app" /></label>
        <button disabled={pending} onClick={() => start(async () => { await saveSettingsAction(v); setV((s) => ({ ...s, "ibot.token": "", "ibot.webhook_token": "" })); setResult("נשמר ✓"); })} className="btn-primary">שמור</button>
      </section>
      <section className="rounded-2xl border border-line bg-card p-4 space-y-3">
        <h2 className="font-bold">שלח הודעת בדיקה</h2>
        <input className="input" dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9725XXXXXXXX" />
        <button disabled={pending || !phone} onClick={() => start(async () => { const r = await sendTestMessageAction(phone); setResult(r.ok ? `נשלח ✓ ${JSON.stringify(r.body)}` : `נכשל: ${r.error}`); })} className="btn-secondary">שלח</button>
        {result && <pre dir="ltr" className="text-xs bg-surface rounded-xl p-3 whitespace-pre-wrap">{result}</pre>}
      </section>
    </div>
  );
}
