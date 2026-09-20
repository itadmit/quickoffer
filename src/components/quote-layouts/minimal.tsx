import { formatMoney } from "@/lib/quotes/calc";
import { Approval, BusinessMeta, dateFmt, Footer, ItemsTable, TermsAndNotes, totalLabel, totalsRows, type LayoutProps } from "./shared";

/** Typographic, no boxes - reads like a printed document. */
export function MinimalLayout({ q, t, showReviewFlags, plain }: LayoutProps) {
  const b = q.business;
  const total = totalLabel(q);
  return (
    <article className="bg-card rounded-2xl shadow-sm px-6 py-7 space-y-6" style={{ borderTop: `4px solid ${t.accent}` }}>
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs tracking-wide text-muted">הצעת מחיר</div>
          <h2 className="font-display text-3xl font-bold leading-none mt-1">#{q.number}</h2>
          <div className="text-sm text-muted mt-2">
            {dateFmt.format(q.createdAt)}
            {q.validUntil && ` · בתוקף עד ${dateFmt.format(q.validUntil)}`}
          </div>
        </div>
        <div className="text-end min-w-0">
          {b.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.logoUrl} alt="" className="h-10 ms-auto mb-1 object-contain" />
          )}
          <h1 className="font-bold truncate">{b.businessName ?? ""}</h1>
          <BusinessMeta q={q} plain={plain} className="text-xs text-muted justify-end" />
        </div>
      </header>

      {(q.customerName || q.title) && (
        <section className="border-t border-line pt-4">
          {q.customerName && (
            <div className="text-sm">
              <span className="text-muted">לכבוד </span>
              <span className="font-semibold">{q.customerName}</span>
            </div>
          )}
          {q.title && <p className="text-muted text-sm mt-0.5">{q.title}</p>}
        </section>
      )}

      <section className="border-t border-line pt-2">
        <ItemsTable q={q} showReviewFlags={showReviewFlags} />
      </section>

      <section className="ms-auto w-fit min-w-56 text-sm">
        {totalsRows(q).map((r) => (
          <div key={r.label} className="flex justify-between gap-8 text-muted py-0.5">
            <span>{r.label}</span>
            <span className="whitespace-nowrap">{r.value}</span>
          </div>
        ))}
        <div className="flex justify-between items-baseline gap-8 pt-2 mt-1 border-t-2" style={{ borderColor: t.accent }}>
          <span className="font-semibold">
            {total.label}
            {total.note && <span className="block text-xs font-normal text-muted">{total.note}</span>}
          </span>
          <span className="text-xl font-bold whitespace-nowrap">{formatMoney(q.total)}</span>
        </div>
      </section>

      <TermsAndNotes q={q} className="border-t border-line pt-4 space-y-3 text-sm" />

      {q.approval && <Approval q={q} />}

      {t.footerText && <Footer t={t} className="text-xs text-muted border-t border-line pt-4" />}
    </article>
  );
}
