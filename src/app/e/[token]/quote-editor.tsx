"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, MessageCircle, Trash2, TriangleAlert, Wrench } from "lucide-react";
import { UNITS } from "@/lib/ai/types";
import { formatPhone, isMobile, normalizePhone, waLink } from "@/lib/phone";
import { calcTotals, formatMoney } from "@/lib/quotes/calc";
import { customerMessageText, daysUntil } from "@/lib/quotes/customer-message";
import { QuoteDocument, type QuoteView } from "@/components/quote-document";
import { StatusBadge } from "@/components/status-badge";
import { claimDeviceAction, deleteQuoteAction, markSentAction, saveAsJobAction, saveQuoteAction } from "./actions";
import type { QuoteForm } from "./schema";

type Props = {
  token: string;
  quote: {
    number: number;
    status: "draft" | "sent" | "viewed" | "approved" | "rejected" | "expired";
    publicUrl: string;
    /** business default, used when the quote has no explicit validity date */
    defaultValidDays: number;
    vatRate: number;
    transcript: string | null;
    business: QuoteView["business"];
    createdAt: string;
    template: QuoteView["template"];
  };
  initial: QuoteForm;
};

type Item = QuoteForm["items"][number];

const emptyItem = (): Item => ({ description: "", quantity: 1, unit: "יח׳", unitPrice: 0, needsReview: false });

export function QuoteEditor({ token, quote, initial }: Props) {
  const locked = quote.status === "approved" || quote.status === "rejected";
  const [form, setForm] = useState<QuoteForm>(initial);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState(quote.status);
  /** §6.8 feedback after "שמור כתבנית" */
  const [jobMsg, setJobMsg] = useState<string | null>(null);
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Whoever holds the edit link is the professional. Marking the browser here
  // keeps their own look at the public link out of the view notifications.
  useEffect(() => {
    void claimDeviceAction(token);
  }, [token]);

  const totals = useMemo(
    () =>
      calcTotals(form.items, {
        vatRate: quote.vatRate,
        vatIncluded: form.vatIncluded,
        discount: form.discountAmount,
      }),
    [form.items, form.vatIncluded, form.discountAmount, quote.vatRate],
  );

  // Auto-save, debounced 800ms (§8.1). Every edit goes through `change`.
  const latest = useRef(form);
  const scheduleSave = () => {
    if (locked) return;
    setSaveState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setSaveState("saving");
      const f = latest.current;
      const cleaned: QuoteForm = { ...f, items: f.items.filter((i) => i.description.trim()) };
      saveQuoteAction(token, cleaned).then((r) => setSaveState(r.ok ? "saved" : "error"));
    }, 800);
  };
  const change = (updater: (f: QuoteForm) => QuoteForm) => {
    setForm((prev) => {
      const next = updater(prev);
      latest.current = next;
      return next;
    });
    scheduleSave();
  };

  const update = <K extends keyof QuoteForm>(k: K, v: QuoteForm[K]) => change((f) => ({ ...f, [k]: v }));
  const updateItem = (i: number, patch: Partial<Item>) =>
    change((f) => ({
      ...f,
      items: f.items.map((it, j) => (j === i ? { ...it, ...patch, needsReview: patch.unitPrice !== undefined ? false : it.needsReview } : it)),
    }));
  const removeItem = (i: number) => change((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }));
  const moveItem = (i: number, dir: -1 | 1) =>
    change((f) => {
      const items = [...f.items];
      const j = i + dir;
      if (j < 0 || j >= items.length) return f;
      [items[i], items[j]] = [items[j], items[i]];
      return { ...f, items };
    });

  const previewView: QuoteView = {
    number: quote.number,
    customerName: form.customerName,
    title: form.title,
    createdAt: new Date(quote.createdAt),
    validUntil: form.validUntil ? new Date(form.validUntil) : null,
    items: form.items
      .filter((i) => i.description.trim())
      .map((i) => ({ ...i, lineTotal: Math.round(i.quantity * i.unitPrice * 100) / 100 })),
    subtotal: totals.subtotal,
    discountAmount: totals.discount,
    vatRate: quote.vatRate,
    vatIncluded: form.vatIncluded,
    vatAmount: totals.vatAmount,
    total: totals.total,
    paymentTerms: form.paymentTerms,
    notes: form.notes.filter(Boolean),
    business: quote.business,
    template: quote.template,
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(quote.publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  /**
   * One tap to the customer. With a mobile number we open their chat directly;
   * without one we fall back to the share sheet, then the wa.me composer.
   * Either way the message leaves from the professional's own number.
   *
   * The text is rebuilt from the live form, not from what the server rendered,
   * so a name or date fixed a second ago is the one the customer receives.
   */
  const directTo = isMobile(form.customerPhone) ? normalizePhone(form.customerPhone) : null;
  const outgoingText = customerMessageText({
    customerName: form.customerName,
    businessName: quote.business.businessName,
    publicUrl: quote.publicUrl,
    validDays: daysUntil(form.validUntil, quote.defaultValidDays),
  });

  const markSentQuietly = () =>
    void markSentAction(token).then((r) => {
      if (r.ok) setStatus("sent");
    });

  const share = async () => {
    if (directTo) {
      window.open(waLink(directTo, outgoingText), "_blank", "noopener");
      if (status === "draft") markSentQuietly();
      return;
    }
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text: outgoingText });
        return;
      } catch {
        /* cancelled - fall through */
      }
    }
    window.open(waLink(null, outgoingText), "_blank", "noopener");
  };

  return (
    <main className="flex-1 w-full max-w-lg mx-auto pb-32">
      {/* top bar */}
      <header className="sticky top-0 z-10 bg-surface/90 backdrop-blur border-b border-line px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-bold">הצעה #{quote.number}</div>
          <div className="text-xs text-muted">
            <StatusBadge status={status} />
            {!locked && (
              <span className="ms-2">
                {saveState === "saved" && "✓ נשמר"}
                {saveState === "dirty" && "…"}
                {saveState === "saving" && "שומר…"}
                {saveState === "error" && <span className="text-danger">שגיאה בשמירה</span>}
              </span>
            )}
          </div>
        </div>
        <div className="flex rounded-xl border border-line overflow-hidden text-sm">
          <button onClick={() => setTab("edit")} className={`px-3 py-1.5 ${tab === "edit" ? "bg-brand text-brand-ink" : "bg-card"}`}>
            עריכה
          </button>
          <button onClick={() => setTab("preview")} className={`px-3 py-1.5 ${tab === "preview" ? "bg-brand text-brand-ink" : "bg-card"}`}>
            תצוגה
          </button>
        </div>
      </header>

      {locked && (
        <div className="m-4 rounded-xl bg-warn text-warn-ink text-sm p-3">
          ההצעה {status === "approved" ? "אושרה ונחתמה" : "נדחתה"} - נעולה לעריכה.
        </div>
      )}

      {tab === "preview" ? (
        <div className="p-4">
          <QuoteDocument q={previewView} />
        </div>
      ) : (
        <div className="p-4 space-y-6">
          <fieldset disabled={locked} className="space-y-4">
            <section className="grid grid-cols-2 gap-3">
              <label className="col-span-2">
                <span className="label">שם הלקוח</span>
                <input className="input" value={form.customerName ?? ""} onChange={(e) => update("customerName", e.target.value)} placeholder="דני כהן" />
              </label>
              <label>
                <span className="label">טלפון (לא חובה)</span>
                <input className="input" dir="ltr" inputMode="tel" value={form.customerPhone ?? ""} onChange={(e) => update("customerPhone", e.target.value)} placeholder="050-0000000" />
              </label>
              <label>
                <span className="label">תוקף עד</span>
                <input className="input" type="date" value={form.validUntil ?? ""} onChange={(e) => update("validUntil", e.target.value || null)} />
              </label>
              <label className="col-span-2">
                <span className="label">כותרת העבודה</span>
                <input className="input" value={form.title ?? ""} onChange={(e) => update("title", e.target.value)} placeholder="התקנת גופי תאורה" />
              </label>
            </section>

            {/* items */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">פריטים</h2>
                {form.items.some((i) => i.needsReview) && (
                  <span className="inline-flex items-center gap-1 text-xs bg-warn text-warn-ink rounded-full px-2 py-0.5">
                    <TriangleAlert className="h-3 w-3" /> יש פריטים לבדיקה
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {form.items.map((it, i) => (
                  <div key={i} className={`rounded-xl border p-3 space-y-2 ${it.needsReview ? "border-warn-ink/40 bg-warn/60" : "border-line bg-card"}`}>
                    <div className="flex gap-2">
                      <input
                        className="input flex-1"
                        value={it.description}
                        onChange={(e) => updateItem(i, { description: e.target.value })}
                        placeholder="תיאור הפריט"
                      />
                      <div className="flex flex-col">
                        <button type="button" onClick={() => moveItem(i, -1)} className="text-muted px-1 leading-none" aria-label="למעלה">▲</button>
                        <button type="button" onClick={() => moveItem(i, 1)} className="text-muted px-1 leading-none" aria-label="למטה">▼</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-[1fr_1.2fr_1.4fr_auto] gap-2 items-end">
                      <label>
                        <span className="label">כמות</span>
                        <NumberInput value={it.quantity} onChange={(v) => updateItem(i, { quantity: v })} />
                      </label>
                      <label>
                        <span className="label">יחידה</span>
                        <select className="input" value={it.unit} onChange={(e) => updateItem(i, { unit: e.target.value as Item["unit"] })}>
                          {UNITS.map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span className="label">מחיר ליח׳ {it.needsReview && it.unitPrice === 0 && <span className="text-warn-ink">- חסר</span>}</span>
                        <NumberInput value={it.unitPrice} onChange={(v) => updateItem(i, { unitPrice: v })} />
                      </label>
                      <button type="button" onClick={() => removeItem(i)} className="btn-ghost text-danger" aria-label="מחק">✕</button>
                    </div>
                    <div className="text-end text-sm text-muted">
                      סה״כ שורה: <span className="font-medium text-ink">{formatMoney(Math.round(it.quantity * it.unitPrice * 100) / 100)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => change((f) => ({ ...f, items: [...f.items, emptyItem()] }))} className="btn-secondary w-full">
                + הוסף פריט
              </button>
            </section>

            {/* totals */}
            <section className="rounded-xl border border-line bg-card p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 items-end">
                <label>
                  <span className="label">הנחה (₪)</span>
                  <NumberInput value={form.discountAmount} onChange={(v) => update("discountAmount", v)} />
                </label>
                {quote.vatRate > 0 ? (
                  <label className="flex items-center gap-2 pb-2.5">
                    <input type="checkbox" checked={form.vatIncluded} onChange={(e) => update("vatIncluded", e.target.checked)} />
                    <span className="text-sm">המחירים כוללים מע״מ</span>
                  </label>
                ) : (
                  <div className="text-sm text-muted pb-2.5">עוסק פטור - ללא מע״מ</div>
                )}
              </div>
              <dl className="text-sm space-y-1">
                <div className="flex justify-between"><dt className="text-muted">לפני מע״מ</dt><dd>{formatMoney(totals.net)}</dd></div>
                {quote.vatRate > 0 && (
                  <div className="flex justify-between"><dt className="text-muted">מע״מ {Math.round(quote.vatRate * 100)}%</dt><dd>{formatMoney(totals.vatAmount)}</dd></div>
                )}
                <div className="flex justify-between font-bold text-base border-t border-line pt-2"><dt>סה״כ</dt><dd>{formatMoney(totals.total)}</dd></div>
              </dl>
            </section>

            <section className="space-y-3">
              <label>
                <span className="label">תנאי תשלום</span>
                <input className="input" value={form.paymentTerms ?? ""} onChange={(e) => update("paymentTerms", e.target.value)} placeholder="50% מקדמה, היתרה בסיום" />
              </label>
              <label>
                <span className="label">הערות (שורה לכל הערה)</span>
                <textarea
                  className="input"
                  rows={3}
                  value={form.notes.join("\n")}
                  onChange={(e) => update("notes", e.target.value.split("\n"))}
                  placeholder={"לא כולל חומרים\nאחריות שנה על העבודה"}
                />
              </label>
            </section>

            {quote.transcript && (
              <details className="text-sm text-muted">
                <summary className="cursor-pointer">מה שמעתי בהודעה הקולית</summary>
                <p className="mt-2 p-3 rounded-xl bg-card border border-line">{quote.transcript}</p>
              </details>
            )}
          </fieldset>
        </div>
      )}

      {/* bottom actions */}
      <div className="fixed bottom-0 inset-x-0 bg-card border-t border-line p-3">
        {jobMsg && (
          <p className="max-w-lg mx-auto text-sm text-muted pb-2" role="status">
            {jobMsg}
          </p>
        )}
        <div className="max-w-lg mx-auto flex gap-2">
          <button onClick={share} className="btn-primary flex-1 min-w-0">
            <MessageCircle className="h-5 w-5 shrink-0" />
            <span className="truncate">
              {directTo
                ? `שלח ל${form.customerName || formatPhone(directTo)}`
                : "שלח ללקוח ב-WhatsApp"}
            </span>
          </button>
          <button onClick={copyLink} className="btn-secondary" aria-label="העתק קישור ללקוח" title="העתק קישור ללקוח">
            {copied ? <span className="text-ok text-sm">הועתק</span> : <Link2 className="h-5 w-5" />}
          </button>
          {!locked && status === "draft" && (
            <button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await markSentAction(token);
                  if (r.ok) setStatus("sent");
                })
              }
              className="btn-secondary"
            >
              סמן כנשלחה
            </button>
          )}
          {!locked && form.items.some((it) => it.description.trim()) && (
            <button
              disabled={pending}
              onClick={() => {
                const suggested = form.title?.trim() || form.items[0]?.description?.trim() || "";
                const name = prompt("שם לתבנית (למשל: התקנת מזגן)", suggested);
                if (!name?.trim()) return;
                start(async () => {
                  const r = await saveAsJobAction(token, name);
                  setJobMsg(
                    r.ok
                      ? `${r.replaced ? "עודכן" : "נשמר"}: "${r.name}" ✓`
                      : "לא הצלחתי לשמור - בדוק שיש שם ופריטים",
                  );
                  setTimeout(() => setJobMsg(null), 3000);
                });
              }}
              className="btn-secondary"
              title="שמור את הפריטים כתבנית לעבודה חוזרת"
            >
              <Wrench className="h-4 w-4" /> שמור כתבנית
            </button>
          )}
          {!locked && (
            <button
              disabled={pending}
              onClick={() => {
                if (!confirm("למחוק את ההצעה? אי אפשר לשחזר.")) return;
                start(async () => {
                  const r = await deleteQuoteAction(token);
                  if (r.ok) router.push("/");
                });
              }}
              className="btn-ghost text-danger"
              aria-label="מחק"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);
  // Prop changed from outside (e.g. reorder) - resync the text (React "adjust state on prop change" pattern)
  if (value !== lastValue) {
    setLastValue(value);
    if (Number(text) !== value) setText(String(value));
  }
  return (
    <input
      className="input text-end"
      dir="ltr"
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(/,/g, "");
        setText(t);
        const n = Number(t);
        if (t !== "" && !Number.isNaN(n)) onChange(n);
        if (t === "") onChange(0);
      }}
      onBlur={() => setText(String(value))}
    />
  );
}
