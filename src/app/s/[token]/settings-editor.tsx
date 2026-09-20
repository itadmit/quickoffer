"use client";

import { useRef, useState, useTransition } from "react";
import { formatPhone } from "@/components/quote-document";
import { removeLogoAction, saveSettingsAction, uploadLogoAction, type SettingsForm } from "./actions";

type Props = {
  token: string;
  phone: string;
  plan: string;
  logoUrl: string | null;
  initial: SettingsForm;
};

const PLAN_LABEL: Record<string, string> = {
  trial: "ניסיון (5 הצעות)",
  basic: "Basic — 20 הצעות בחודש",
  pro: "Pro — 100 הצעות בחודש",
  unlimited: "Unlimited",
};

export function SettingsEditor({ token, phone, plan, logoUrl: initialLogo, initial }: Props) {
  const [form, setForm] = useState<SettingsForm>(initial);
  const [logoUrl, setLogoUrl] = useState(initialLogo);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof SettingsForm>(k: K, v: SettingsForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = () =>
    start(async () => {
      const r = await saveSettingsAction(token, form);
      setMsg(r.ok ? { ok: true, text: "נשמר ✓" } : { ok: false, text: "לא נשמר — בדוק את השדות" });
      setTimeout(() => setMsg(null), 2500);
    });

  const onLogo = (file: File | undefined) => {
    if (!file) return;
    const fd = new FormData();
    fd.set("logo", file);
    start(async () => {
      const r = await uploadLogoAction(token, fd);
      if (r.ok) setLogoUrl(r.url);
      else setMsg({ ok: false, text: r.error === "storage" ? "אחסון קבצים לא מוגדר" : "הלוגו לא נשמר" });
    });
  };

  return (
    <main className="flex-1 w-full max-w-lg mx-auto p-4 pb-28 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">הגדרות העסק</h1>
        <p className="text-sm text-muted" dir="ltr">
          {formatPhone(phone)} · <span dir="rtl">{PLAN_LABEL[plan] ?? plan}</span>
        </p>
      </header>

      {/* logo */}
      <section className="rounded-2xl border border-line bg-card p-4 flex items-center gap-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="לוגו" className="h-16 w-16 rounded-xl object-contain bg-surface" />
        ) : (
          <div className="h-16 w-16 rounded-xl bg-brand-soft text-brand grid place-items-center text-2xl font-bold">
            {form.businessName.slice(0, 1) || "?"}
          </div>
        )}
        <div className="flex-1 space-y-1">
          <div className="font-semibold">לוגו</div>
          <div className="text-xs text-muted">מופיע בראש כל הצעה. אפשר גם לשלוח תמונה ב-WhatsApp.</div>
          <div className="flex gap-3 text-sm pt-1">
            <button type="button" className="text-brand font-medium" onClick={() => fileRef.current?.click()} disabled={pending}>
              {logoUrl ? "החלף" : "העלה"}
            </button>
            {logoUrl && (
              <button
                type="button"
                className="text-danger"
                onClick={() => start(async () => { const r = await removeLogoAction(token); if (r.ok) setLogoUrl(null); })}
              >
                הסר
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
        </div>
      </section>

      <section className="space-y-3">
        <label>
          <span className="label">שם העסק *</span>
          <input className="input" value={form.businessName} onChange={(e) => update("businessName", e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="label">טלפון להצעות</span>
            <input className="input" dir="ltr" inputMode="tel" value={form.businessPhone ?? ""} onChange={(e) => update("businessPhone", e.target.value)} placeholder={formatPhone(phone)} />
          </label>
          <label>
            <span className="label">ח.פ. / ע.מ.</span>
            <input className="input" dir="ltr" inputMode="numeric" value={form.taxId ?? ""} onChange={(e) => update("taxId", e.target.value)} />
          </label>
        </div>
        <label>
          <span className="label">כתובת</span>
          <input className="input" value={form.address ?? ""} onChange={(e) => update("address", e.target.value)} />
        </label>

        <div>
          <span className="label">סטטוס מע״מ</span>
          <div className="grid grid-cols-2 gap-2">
            {(["registered", "exempt"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => update("vatStatus", v)}
                className={`rounded-xl border px-3 py-2.5 text-sm ${form.vatStatus === v ? "border-brand bg-brand-soft text-brand font-semibold" : "border-line bg-card"}`}
              >
                {v === "registered" ? "עוסק מורשה (מע״מ 18%)" : "עוסק פטור (ללא מע״מ)"}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">ברירות מחדל להצעות</h2>
        <label>
          <span className="label">תנאי תשלום</span>
          <input className="input" value={form.defaultPaymentTerms ?? ""} onChange={(e) => update("defaultPaymentTerms", e.target.value)} placeholder="50% מקדמה, היתרה בסיום העבודה" />
        </label>
        <label>
          <span className="label">הערות קבועות (שורה לכל הערה)</span>
          <textarea
            className="input"
            rows={3}
            value={form.defaultNotes.join("\n")}
            onChange={(e) => update("defaultNotes", e.target.value.split("\n"))}
            placeholder={"לא כולל חומרים\nאחריות שנה על העבודה"}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="label">תוקף הצעה (ימים)</span>
            <input className="input text-end" dir="ltr" type="number" min={1} max={365} value={form.defaultValidDays} onChange={(e) => update("defaultValidDays", Number(e.target.value) || 14)} />
          </label>
          <label>
            <span className="label">מספר ההצעה הבאה</span>
            <input className="input text-end" dir="ltr" type="number" min={1} value={form.nextQuoteNumber} onChange={(e) => update("nextQuoteNumber", Number(e.target.value) || 1)} />
          </label>
        </div>
      </section>

      <div className="fixed bottom-0 inset-x-0 bg-card border-t border-line p-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={save} disabled={pending || !form.businessName.trim()} className="btn-primary flex-1">
            {pending ? "שומר…" : "שמור"}
          </button>
          {msg && <span className={`text-sm ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</span>}
        </div>
      </div>
    </main>
  );
}
