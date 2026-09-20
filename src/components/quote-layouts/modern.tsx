import { TriangleAlert } from "lucide-react";
import { formatMoney, formatQty } from "@/lib/quotes/calc";
import { Approval, BusinessMeta, dateFmt, Footer, Logo, TermsAndNotes, totalLabel, totalsRows, type LayoutProps } from "./shared";

/** Accent band on top, items as cards, one big total. */
export function ModernLayout({ q, t, showReviewFlags, plain }: LayoutProps) {
  const b = q.business;
  const total = totalLabel(q);
  return (
    <article className="bg-card rounded-3xl shadow-sm overflow-hidden" style={{ boxShadow: `0 0 0 1px ${t.accent}22` }}>
      <header className="p-5 text-white" style={{ background: t.accent }}>
        <div className="flex items-center gap-4">
          <Logo q={q} className="h-14 w-14 bg-white/15 text-white" />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-tight truncate">{b.businessName ?? "הצעת מחיר"}</h1>
            <BusinessMeta q={q} plain={plain} className="text-sm text-white/80" />
          </div>
        </div>
        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <div className="text-white/70 text-xs">הצעת מחיר</div>
            <h2 className="text-2xl font-bold leading-tight">#{q.number}</h2>
          </div>
          <div className="text-end text-sm">
            {q.customerName && <div className="font-semibold">{q.customerName}</div>}
            <div className="text-white/80">{dateFmt.format(q.createdAt)}</div>
          </div>
        </div>
      </header>

      <section className="p-4 space-y-2">
        {q.title && <p className="px-1 pb-1 text-muted">{q.title}</p>}
        {q.items.map((it, i) => (
          <div
            key={i}
            className={`rounded-2xl border px-4 py-3 flex items-center gap-3 ${showReviewFlags && it.needsReview ? "bg-warn border-warn-ink/20" : "bg-surface/60 border-line/70"}`}
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {it.description}
                {showReviewFlags && it.needsReview && <TriangleAlert className="inline h-3.5 w-3.5 ms-1 text-warn-ink" />}
              </div>
              <div className="text-xs text-muted">
                {formatQty(it.quantity)} {it.unit} × {formatMoney(it.unitPrice)}
              </div>
            </div>
            <div className="font-semibold whitespace-nowrap">{formatMoney(it.lineTotal)}</div>
          </div>
        ))}
      </section>

      <section className="px-4 pb-4">
        <div className="rounded-2xl p-4 space-y-1 text-sm" style={{ background: `${t.accent}12` }}>
          {totalsRows(q).map((r) => (
            <div key={r.label} className="flex justify-between gap-4 text-muted">
              <span>{r.label}</span>
              <span className="whitespace-nowrap">{r.value}</span>
            </div>
          ))}
          <div className="flex justify-between items-end gap-4 pt-2">
            <span className="font-semibold">
              {total.label}
              {total.note && <span className="block text-xs font-normal text-muted">{total.note}</span>}
            </span>
            <span className="text-2xl font-bold whitespace-nowrap" style={{ color: t.accent }}>
              {formatMoney(q.total)}
            </span>
          </div>
        </div>
        {q.validUntil && <p className="text-xs text-muted text-center pt-2">ההצעה בתוקף עד {dateFmt.format(q.validUntil)}</p>}
      </section>

      <TermsAndNotes q={q} className="px-5 pb-5 space-y-3 text-sm" />

      {q.approval && (
        <section className="px-4 pb-4">
          <Approval q={q} />
        </section>
      )}

      {t.footerText && (
        <footer className="px-5 py-4 border-t border-line">
          <Footer t={t} />
        </footer>
      )}
    </article>
  );
}
