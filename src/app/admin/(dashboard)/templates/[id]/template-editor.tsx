"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QuoteDocument } from "@/components/quote-document";
import { sampleQuoteView } from "@/lib/quotes/sample";
import { LAYOUT_LABELS, normalizeTemplateSpec, PLAN_LABELS, PLANS, QUOTE_LAYOUTS } from "@/lib/quotes/template-spec";
import { deleteTemplateAction, saveTemplateAction, type TemplateForm } from "../actions";

const PRESET_COLORS = ["#0f766e", "#0f172a", "#1d4ed8", "#7c3aed", "#b91c1c", "#c2410c", "#15803d", "#0e7490"];

export function TemplateEditor({ id, initial }: { id: string | null; initial: TemplateForm }) {
  const [form, setForm] = useState<TemplateForm>(initial);
  const [approved, setApproved] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const update = <K extends keyof TemplateForm>(k: K, v: TemplateForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const spec = normalizeTemplateSpec(form);

  const save = () =>
    start(async () => {
      const r = await saveTemplateAction(id, form);
      if (r.ok) {
        setMsg({ ok: true, text: "נשמר" });
        if (!id) router.replace(`/admin/templates/${r.id}`);
      } else setMsg({ ok: false, text: r.error });
      setTimeout(() => setMsg(null), 3000);
    });

  const remove = () => {
    if (!id || !confirm(`למחוק את התבנית "${form.name}"? משתמשים שבחרו בה יחזרו לברירת המחדל.`)) return;
    start(async () => {
      const r = await deleteTemplateAction(id);
      if (r && !r.ok) setMsg({ ok: false, text: r.error });
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">{id ? `תבנית: ${initial.name}` : "תבנית חדשה"}</h1>
        <Link href="/admin/templates" className="text-sm text-muted ms-auto">← כל התבניות</Link>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6 items-start">
        <div className="space-y-4">
          <section className="rounded-2xl border border-line bg-card p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="label">שם (מוצג לבעל המקצוע)</span>
                <input className="input" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="מודרני" />
              </label>
              <label>
                <span className="label">key</span>
                <input className="input" dir="ltr" value={form.key} onChange={(e) => update("key", e.target.value.toLowerCase())} placeholder="modern-blue" />
              </label>
            </div>
            <label>
              <span className="label">תיאור קצר</span>
              <input className="input" value={form.description ?? ""} onChange={(e) => update("description", e.target.value)} />
            </label>

            <div>
              <span className="label">מבנה (layout)</span>
              <div className="grid grid-cols-3 gap-2">
                {QUOTE_LAYOUTS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => update("layout", l)}
                    className={`rounded-xl border px-3 py-2.5 text-sm ${form.layout === l ? "border-brand bg-brand-soft text-brand font-semibold" : "border-line bg-card"}`}
                  >
                    {LAYOUT_LABELS[l]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="label">צבע מותג</span>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => update("accent", c)}
                    className={`h-8 w-8 rounded-full border-2 ${form.accent.toLowerCase() === c ? "border-ink" : "border-transparent"}`}
                    style={{ background: c }}
                  />
                ))}
                <input type="color" value={spec.accent} onChange={(e) => update("accent", e.target.value)} className="h-8 w-10 rounded-lg border border-line bg-card p-0.5" />
                <input className="input w-28 font-mono text-sm" dir="ltr" value={form.accent} onChange={(e) => update("accent", e.target.value)} />
              </div>
            </div>

            <label>
              <span className="label">טקסט תחתית (תנאים כלליים, מופיע בכל הצעה בתבנית זו)</span>
              <textarea className="input" rows={3} value={form.footerText ?? ""} onChange={(e) => update("footerText", e.target.value)} placeholder="המחירים אינם כוללים חומרים אלא אם צוין אחרת." />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="label">זמינה מתוכנית</span>
                <select className="input" value={form.isDefault ? "trial" : form.minPlan} disabled={form.isDefault} onChange={(e) => update("minPlan", e.target.value as TemplateForm["minPlan"])}>
                  {PLANS.map((p) => (
                    <option key={p} value={p}>{p === "trial" ? "כולם (גם ניסיון)" : `${PLAN_LABELS[p]} ומעלה`}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label">סדר</span>
                <input className="input text-end" dir="ltr" type="number" min={0} value={form.sortOrder} onChange={(e) => update("sortOrder", Number(e.target.value) || 0)} />
              </label>
            </div>
            <div className="flex gap-6">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.enabled || form.isDefault} disabled={form.isDefault} onChange={(e) => update("enabled", e.target.checked)} />
                פעילה (ניתנת לבחירה)
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isDefault} onChange={(e) => update("isDefault", e.target.checked)} />
                ברירת מחדל (זמינה לכולם)
              </label>
            </div>
          </section>

          <div className="flex items-center gap-3">
            <button onClick={save} disabled={pending || !form.name.trim() || !form.key.trim()} className="btn-primary">
              {pending ? "שומר…" : id ? "שמור" : "צור תבנית"}
            </button>
            {id && !initial.isDefault && (
              <button onClick={remove} disabled={pending} className="btn-ghost text-danger">מחק</button>
            )}
            {msg && <span className={`text-sm ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</span>}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm text-muted">
            <span>תצוגה מקדימה - הצעה לדוגמה, כמו שהלקוח רואה</span>
            <label className="inline-flex items-center gap-1.5 ms-auto">
              <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} /> אחרי חתימה
            </label>
          </div>
          <div className="max-w-lg mx-auto">
            <QuoteDocument q={sampleQuoteView(spec, { approved })} />
          </div>
        </div>
      </div>
    </div>
  );
}
