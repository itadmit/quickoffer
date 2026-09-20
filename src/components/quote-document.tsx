import { BadgeCheck, TriangleAlert } from "lucide-react";
import { formatMoney, formatQty } from "@/lib/quotes/calc";

export type QuoteView = {
  number: number;
  customerName: string | null;
  title: string | null;
  createdAt: Date;
  validUntil: Date | null;
  items: {
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    lineTotal: number;
    needsReview: boolean;
  }[];
  subtotal: number;
  discountAmount: number;
  vatRate: number;
  vatIncluded: boolean;
  vatAmount: number;
  total: number;
  paymentTerms: string | null;
  notes: string[];
  business: {
    businessName: string | null;
    logoUrl: string | null;
    businessPhone: string | null;
    address: string | null;
    taxId: string | null;
    vatStatus: "exempt" | "registered";
  };
  approval?: {
    signerName: string;
    signatureUrl: string | null;
    signatureData?: string;
    at: string;
  } | null;
};

const dateFmt = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" });

export function QuoteDocument({ q, showReviewFlags = false }: { q: QuoteView; showReviewFlags?: boolean }) {
  const b = q.business;
  const netAfterDiscount = q.subtotal - q.discountAmount;
  return (
    <article className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
      {/* header */}
      <header className="p-5 flex items-center gap-4 border-b border-line">
        {b.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.logoUrl} alt="" className="h-14 w-14 rounded-xl object-contain bg-surface" />
        ) : (
          <div className="h-14 w-14 rounded-xl bg-brand-soft text-brand grid place-items-center text-2xl font-bold">
            {(b.businessName ?? "?").slice(0, 1)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold leading-tight truncate">{b.businessName ?? "הצעת מחיר"}</h1>
          <div className="text-sm text-muted flex flex-wrap gap-x-3">
            {b.businessPhone && (
              <a href={`tel:+${b.businessPhone.replace(/\D/g, "")}`} className="hover:underline" dir="ltr">
                {formatPhone(b.businessPhone)}
              </a>
            )}
            {b.taxId && <span>{b.vatStatus === "exempt" ? "ע.מ." : "ח.פ./ע.מ."} {b.taxId}</span>}
          </div>
          {b.address && <div className="text-sm text-muted truncate">{b.address}</div>}
        </div>
      </header>

      {/* title */}
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

      {/* items */}
      <section className="px-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted text-xs border-b border-line">
              <th className="text-start py-2 font-medium">פירוט</th>
              <th className="text-center py-2 font-medium w-16">כמות</th>
              <th className="text-end py-2 font-medium w-24">מחיר</th>
              <th className="text-end py-2 font-medium w-24">סה״כ</th>
            </tr>
          </thead>
          <tbody>
            {q.items.map((it, i) => (
              <tr key={i} className={`border-b border-line/60 ${showReviewFlags && it.needsReview ? "bg-warn" : ""}`}>
                <td className="py-2.5 pe-2">
                  {it.description}
                  {showReviewFlags && it.needsReview && <TriangleAlert className="inline h-3.5 w-3.5 ms-1 text-warn-ink" />}
                </td>
                <td className="py-2.5 text-center text-muted whitespace-nowrap">
                  {formatQty(it.quantity)} {it.unit}
                </td>
                <td className="py-2.5 text-end whitespace-nowrap">{formatMoney(it.unitPrice)}</td>
                <td className="py-2.5 text-end font-medium whitespace-nowrap">{formatMoney(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* totals */}
      <section className="p-5">
        <dl className="ms-auto max-w-xs space-y-1 text-sm">
          {q.discountAmount > 0 && (
            <>
              <Row label="סה״כ פריטים" value={formatMoney(q.subtotal)} />
              <Row label="הנחה" value={`−${formatMoney(q.discountAmount)}`} />
            </>
          )}
          {q.vatRate === 0 ? (
            <Row label="סה״כ לתשלום" value={formatMoney(q.total)} strong note="עוסק פטור - ללא מע״מ" />
          ) : q.vatIncluded ? (
            <>
              <Row label="לפני מע״מ" value={formatMoney(q.total - q.vatAmount)} />
              <Row label={`מע״מ ${Math.round(q.vatRate * 100)}%`} value={formatMoney(q.vatAmount)} />
              <Row label="סה״כ כולל מע״מ" value={formatMoney(q.total)} strong />
            </>
          ) : (
            <>
              <Row label="סה״כ לפני מע״מ" value={formatMoney(netAfterDiscount)} />
              <Row label={`מע״מ ${Math.round(q.vatRate * 100)}%`} value={formatMoney(q.vatAmount)} />
              <Row label="סה״כ לתשלום" value={formatMoney(q.total)} strong />
            </>
          )}
        </dl>
      </section>

      {(q.paymentTerms || q.notes.length > 0) && (
        <section className="px-5 pb-5 space-y-3 text-sm">
          {q.paymentTerms && (
            <div>
              <div className="font-semibold">תנאי תשלום</div>
              <div className="text-muted">{q.paymentTerms}</div>
            </div>
          )}
          {q.notes.length > 0 && (
            <div>
              <div className="font-semibold">הערות</div>
              <ul className="list-disc ps-5 text-muted space-y-0.5">
                {q.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {q.approval && (
        <section className="px-5 pb-5">
          <div className="rounded-xl border border-ok/30 bg-ok/5 p-4 flex items-center gap-4">
            <div className="flex-1 text-sm">
              <div className="font-semibold text-ok flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4" /> אושר ונחתם
              </div>
              <div>{q.approval.signerName}</div>
              <div className="text-muted">
                {new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short" }).format(
                  new Date(q.approval.at),
                )}
              </div>
            </div>
            {(q.approval.signatureUrl || q.approval.signatureData) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={q.approval.signatureUrl ?? q.approval.signatureData}
                alt="חתימה"
                className="h-16 w-32 object-contain bg-white rounded-lg border border-line"
              />
            )}
          </div>
        </section>
      )}
    </article>
  );
}

function Row({ label, value, strong, note }: { label: string; value: string; strong?: boolean; note?: string }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "text-base font-bold pt-2 border-t border-line" : ""}`}>
      <dt className="text-muted">
        {label}
        {note && <span className="block text-xs font-normal">{note}</span>}
      </dt>
      <dd className="whitespace-nowrap">{value}</dd>
    </div>
  );
}

export function formatPhone(p: string): string {
  const d = p.replace(/\D/g, "");
  if (d.startsWith("972") && d.length === 12) return `0${d.slice(3, 5)}-${d.slice(5, 8)}-${d.slice(8)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return p;
}
