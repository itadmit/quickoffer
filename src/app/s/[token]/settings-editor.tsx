"use client";

import { useRef, useState, useTransition } from "react";
import { Check, ChevronLeft, Lock, Sparkles } from "lucide-react";
import { formatPhone } from "@/lib/phone";
import { TemplateThumb } from "@/components/template-thumb";
import type { QuoteTemplateSpec } from "@/lib/quotes/template-spec";
import { removeLogoAction, saveSettingsAction, uploadLogoAction } from "./actions";
import { JobsEditor, type Job } from "./jobs-editor";
import type { SettingsForm } from "./schema";

type Props = {
  token: string;
  phone: string | null;
  plan: string;
  logoUrl: string | null;
  quota: { used: number; limit: number; monthly: boolean } | null;
  /** lockedFor: the plan name required, when the user's plan cannot pick it */
  templates: { id: string; name: string; description: string | null; isDefault: boolean; lockedFor: string | null; spec: QuoteTemplateSpec }[];
  /** §6.8 saved jobs - managed here, created in the chat */
  jobs: Job[];
  /** false on the top plan - there is nothing to sell */
  canUpgrade: boolean;
  initial: SettingsForm;
};

const PLAN_LABEL: Record<string, string> = {
  trial: "ניסיון (5 הצעות)",
  basic: "Basic - 20 הצעות בחודש",
  pro: "Pro - 100 הצעות בחודש",
  unlimited: "Unlimited",
};

export function SettingsEditor({ token, phone, plan, logoUrl: initialLogo, quota, templates, jobs, canUpgrade, initial }: Props) {
  const [form, setForm] = useState<SettingsForm>(initial);
  const [logoUrl, setLogoUrl] = useState(initialLogo);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof SettingsForm>(k: K, v: SettingsForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = () =>
    start(async () => {
      const r = await saveSettingsAction(token, form);
      setMsg(
        r.ok
          ? { ok: true, text: "נשמר ✓" }
          : { ok: false, text: r.error === "template_locked" ? "התבנית שנבחרה לא זמינה בתוכנית שלך" : "לא נשמר - בדוק את השדות" },
      );
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
          {phone ? `${formatPhone(phone)} · ` : ""}<span dir="rtl">{PLAN_LABEL[plan] ?? plan}</span>
        </p>
        {quota && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-muted">
              <span>{quota.monthly ? "הצעות החודש" : "הצעות בניסיון"}</span>
              <span>{quota.used} / {quota.limit}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-line overflow-hidden">
              <div className={`h-full rounded-full ${quota.used >= quota.limit ? "bg-danger" : "bg-brand"}`} style={{ width: `${Math.min(100, (quota.used / quota.limit) * 100)}%` }} />
            </div>
          </div>
        )}
      </header>

      {canUpgrade && (
        <a
          href={`/u/${token}`}
          className={`flex items-center gap-3 rounded-2xl border p-4 ${
            quota && quota.used >= quota.limit
              ? "border-danger/40 bg-danger/5"
              : "border-brand/30 bg-brand-soft/40"
          }`}
        >
          <span className="grid place-items-center h-10 w-10 rounded-xl bg-brand text-brand-ink shrink-0">
            <Sparkles className="h-5 w-5" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-semibold">
              {quota && quota.used >= quota.limit ? "נגמרו ההצעות בחבילה" : "שדרוג חבילה"}
            </span>
            <span className="block text-xs text-muted">
              {quota && quota.used >= quota.limit
                ? "שדרוג פותח את ההצעות מיד"
                : "יותר הצעות, כל התבניות, בלי מיתוג QuickOffer"}
            </span>
          </span>
          <ChevronLeft className="h-5 w-5 text-muted shrink-0" />
        </a>
      )}

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
            <input className="input" dir="ltr" inputMode="tel" value={form.businessPhone ?? ""} onChange={(e) => update("businessPhone", e.target.value)} placeholder={phone ? formatPhone(phone) : "050-0000000"} />
            <span className="block text-xs text-muted mt-1">ריק = המספר של ה-WhatsApp שלך</span>
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
                {v === "registered" ? "מורשה / בע״מ (מע״מ 18%)" : "עוסק פטור (ללא מע״מ)"}
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

      {templates.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-bold">עיצוב ההצעה</h2>
          <p className="text-sm text-muted -mt-2">כך הלקוח יראה את ההצעה. אפשר להחליף בכל רגע - הצעות שכבר נחתמו לא משתנות.</p>
          <div className="grid grid-cols-2 gap-3">
            {templates.map((t) => {
              const selected = form.templateId === t.id || (form.templateId === null && t.isDefault);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    if (t.lockedFor) {
                      setMsg({ ok: false, text: `תבנית "${t.name}" זמינה בתוכנית ${t.lockedFor} ומעלה` });
                      setTimeout(() => setMsg(null), 3000);
                      return;
                    }
                    update("templateId", t.isDefault ? null : t.id);
                  }}
                  className={`relative text-start rounded-2xl border-2 p-2 space-y-2 ${selected ? "border-brand bg-brand-soft/40" : "border-line bg-card"} ${t.lockedFor ? "opacity-70" : ""}`}
                >
                  {t.lockedFor && (
                    <span className="absolute top-3 end-3 z-10 inline-flex items-center gap-1 rounded-full bg-ink/80 text-white text-[11px] px-2 py-0.5">
                      <Lock className="h-3 w-3" /> {t.lockedFor}
                    </span>
                  )}
                  {selected && (
                    <span className="absolute top-3 end-3 z-10 grid place-items-center h-6 w-6 rounded-full bg-brand text-brand-ink">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <TemplateThumb template={t.spec} width={200} height={170} fill />
                  <div className="px-1 pb-1">
                    <div className="font-semibold text-sm">{t.name}</div>
                    {t.description && <div className="text-xs text-muted leading-snug">{t.description}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <JobsEditor token={token} initial={jobs} />

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
