import { Approval, BusinessMeta, dateFmt, Footer, ItemsTable, Logo, TermsAndNotes, Totals, type LayoutProps } from "./shared";

/** The original design: business header, table, totals. */
export function ClassicLayout({ q, t, showReviewFlags, plain }: LayoutProps) {
  const b = q.business;
  return (
    <article className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
      <header className="p-5 flex items-center gap-4 border-b border-line">
        <Logo q={q} style={{ background: `${t.accent}1f`, color: t.accent }} />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold leading-tight truncate">{b.businessName ?? "הצעת מחיר"}</h1>
          <BusinessMeta q={q} plain={plain} />
        </div>
      </header>

      <section className="p-5 space-y-1">
        <h2 className="text-xl font-bold">
          הצעת מחיר #{q.number}
          {q.customerName ? ` ל${q.customerName}` : ""}
        </h2>
        {q.title && <p className="text-muted">{q.title}</p>}
        <p className="text-sm text-muted">
          {dateFmt.format(q.createdAt)}
          {q.validUntil && ` · בתוקף עד ${dateFmt.format(q.validUntil)}`}
        </p>
      </section>

      <section className="px-5">
        <ItemsTable q={q} showReviewFlags={showReviewFlags} />
      </section>

      <section className="p-5">
        <Totals q={q} accent={t.accent} />
      </section>

      <TermsAndNotes q={q} className="px-5 pb-5 space-y-3 text-sm" />

      {q.approval && (
        <section className="px-5 pb-5">
          <Approval q={q} />
        </section>
      )}

      {t.footerText && (
        <footer className="px-5 pb-5">
          <Footer t={t} />
        </footer>
      )}
    </article>
  );
}
