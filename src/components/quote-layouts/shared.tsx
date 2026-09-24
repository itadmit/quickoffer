import { BadgeCheck, TriangleAlert } from "lucide-react";
import { formatPhone } from "@/lib/phone";
import { formatMoney, qtyLabel } from "@/lib/quotes/calc";
import type { QuoteTemplateSpec } from "@/lib/quotes/template-spec";

// Building blocks shared by the quote layouts. Each layout arranges these
// differently; the data shape (QuoteView) is defined in quote-document.tsx.

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
  /** Design. Missing on pre-template snapshots - the renderer falls back to the default. */
  template?: QuoteTemplateSpec;
};

/** `plain`: no interactive elements (used for thumbnails nested inside links/buttons). */
export type LayoutProps = { q: QuoteView; t: QuoteTemplateSpec; showReviewFlags: boolean; plain: boolean };

export const dateFmt = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short" });

export { formatPhone } from "@/lib/phone";

export function Logo({ q, className = "h-14 w-14", style }: { q: QuoteView; className?: string; style?: React.CSSProperties }) {
  const b = q.business;
  return b.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={b.logoUrl} alt="" className={`${className} rounded-xl object-contain bg-surface`} />
  ) : (
    <div className={`${className} rounded-xl grid place-items-center text-2xl font-bold`} style={style}>
      {(b.businessName ?? "?").slice(0, 1)}
    </div>
  );
}

export function BusinessMeta({ q, plain, className = "text-sm text-muted" }: { q: QuoteView; plain: boolean; className?: string }) {
  const b = q.business;
  return (
    <>
      <div className={`${className} flex flex-wrap gap-x-3`}>
        {b.businessPhone && plain && <span dir="ltr">{formatPhone(b.businessPhone)}</span>}
        {b.businessPhone && !plain && (
          <a href={`tel:+${b.businessPhone.replace(/\D/g, "")}`} className="hover:underline" dir="ltr">
            {formatPhone(b.businessPhone)}
          </a>
        )}
        {b.taxId && <span>{b.vatStatus === "exempt" ? "ע.מ." : "ח.פ./ע.מ."} {b.taxId}</span>}
      </div>
      {b.address && <div className={`${className} truncate`}>{b.address}</div>}
    </>
  );
}

export function ItemsTable({ q, showReviewFlags, headless = false }: { q: QuoteView; showReviewFlags: boolean; headless?: boolean }) {
  return (
    <table className="w-full text-sm">
      <thead className={headless ? "sr-only" : undefined}>
        <tr className="text-muted text-xs border-b border-line">
          {/* The fixed column widths are a desktop nicety - on a phone they leave
              the description a sliver and it breaks one word per line, so there
              the numbers just take what they need. */}
          <th className="text-start py-2 font-medium">פירוט</th>
          <th className="text-center py-2 ps-3 font-medium sm:w-16">כמות</th>
          <th className="text-end py-2 ps-3 font-medium sm:w-24">מחיר</th>
          <th className="text-end py-2 ps-3 font-medium sm:w-24">סה״כ</th>
        </tr>
      </thead>
      <tbody>
        {q.items.map((it, i) => (
          <tr key={i} className={`border-b border-line/60 ${showReviewFlags && it.needsReview ? "bg-warn" : ""}`}>
            <td className="py-2.5 pe-2">
              {it.description}
              {showReviewFlags && it.needsReview && <TriangleAlert className="inline h-3.5 w-3.5 ms-1 text-warn-ink" />}
            </td>
            <td className="py-2.5 ps-3 text-center text-muted whitespace-nowrap">
              {qtyLabel(it.quantity, it.unit)}
            </td>
            <td className="py-2.5 ps-3 text-end whitespace-nowrap">{formatMoney(it.unitPrice)}</td>
            <td className="py-2.5 ps-3 text-end font-medium whitespace-nowrap">{formatMoney(it.lineTotal)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The VAT breakdown rows, without the final total (layouts style that themselves). */
export function totalsRows(q: QuoteView): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (q.discountAmount > 0) {
    rows.push({ label: "סה״כ פריטים", value: formatMoney(q.subtotal) });
    rows.push({ label: "הנחה", value: `−${formatMoney(q.discountAmount)}` });
  }
  if (q.vatRate === 0) return rows;
  if (q.vatIncluded) {
    rows.push({ label: "לפני מע״מ", value: formatMoney(q.total - q.vatAmount) });
  } else {
    rows.push({ label: "סה״כ לפני מע״מ", value: formatMoney(q.subtotal - q.discountAmount) });
  }
  rows.push({ label: `מע״מ ${Math.round(q.vatRate * 100)}%`, value: formatMoney(q.vatAmount) });
  return rows;
}

export function totalLabel(q: QuoteView): { label: string; note?: string } {
  if (q.vatRate === 0) return { label: "סה״כ לתשלום", note: "עוסק פטור - ללא מע״מ" };
  if (q.vatIncluded) return { label: "סה״כ כולל מע״מ" };
  return { label: "סה״כ לתשלום" };
}

export function Totals({ q, accent }: { q: QuoteView; accent?: string }) {
  const total = totalLabel(q);
  return (
    <dl className="ms-auto max-w-xs space-y-1 text-sm">
      {totalsRows(q).map((r) => (
        <Row key={r.label} label={r.label} value={r.value} />
      ))}
      <Row label={total.label} value={formatMoney(q.total)} strong note={total.note} accent={accent} />
    </dl>
  );
}

export function Row({ label, value, strong, note, accent }: { label: string; value: string; strong?: boolean; note?: string; accent?: string }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "text-base font-bold pt-2 border-t border-line" : ""}`}>
      <dt className="text-muted">
        {label}
        {note && <span className="block text-xs font-normal">{note}</span>}
      </dt>
      <dd className="whitespace-nowrap" style={strong && accent ? { color: accent } : undefined}>{value}</dd>
    </div>
  );
}

export function TermsAndNotes({ q, className = "space-y-3 text-sm" }: { q: QuoteView; className?: string }) {
  if (!q.paymentTerms && q.notes.length === 0) return null;
  return (
    <div className={className}>
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
    </div>
  );
}

export function Approval({ q }: { q: QuoteView }) {
  if (!q.approval) return null;
  const a = q.approval;
  return (
    <div className="rounded-xl border border-ok/30 bg-ok/5 p-4 flex items-center gap-4">
      <div className="flex-1 text-sm">
        <div className="font-semibold text-ok flex items-center gap-1.5">
          <BadgeCheck className="h-4 w-4" /> אושר ונחתם
        </div>
        <div>{a.signerName}</div>
        <div className="text-muted">{dateTimeFmt.format(new Date(a.at))}</div>
      </div>
      {(a.signatureUrl || a.signatureData) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.signatureUrl ?? a.signatureData} alt="חתימה" className="h-16 w-32 object-contain bg-white rounded-lg border border-line" />
      )}
    </div>
  );
}

export function Footer({ t, className = "text-xs text-muted" }: { t: QuoteTemplateSpec; className?: string }) {
  if (!t.footerText) return null;
  return <p className={`${className} whitespace-pre-wrap`}>{t.footerText}</p>;
}
