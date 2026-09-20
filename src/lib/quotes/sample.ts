import type { QuoteView } from "@/components/quote-document";
import type { QuoteTemplateSpec } from "./template-spec";

/** The canonical demo quote (same one as the LLM connection test) - used for template previews. */
export function sampleQuoteView(template?: QuoteTemplateSpec, opts: { approved?: boolean } = {}): QuoteView {
  const createdAt = new Date("2026-09-20T10:02:00+03:00");
  return {
    number: 1042,
    customerName: "דני כהן",
    title: "התקנת תאורה בסלון",
    createdAt,
    validUntil: new Date(createdAt.getTime() + 14 * 86_400_000),
    items: [
      { description: "התקנת גוף תאורה", quantity: 3, unit: "יח׳", unitPrice: 150, lineTotal: 450, needsReview: false },
      { description: "ביקור", quantity: 1, unit: "יח׳", unitPrice: 200, lineTotal: 200, needsReview: false },
    ],
    subtotal: 650,
    discountAmount: 0,
    vatRate: 0.18,
    vatIncluded: false,
    vatAmount: 117,
    total: 767,
    paymentTerms: "50% מקדמה, היתרה בסיום העבודה",
    notes: ["לא כולל חומרים", "אחריות שנה על העבודה"],
    business: {
      businessName: "יוסי חשמל",
      logoUrl: null,
      businessPhone: "972501234567",
      address: "הרצל 12, חולון",
      taxId: "312345678",
      vatStatus: "registered",
    },
    approval: opts.approved ? { signerName: "דני כהן", signatureUrl: null, at: "2026-09-20T10:47:00+03:00" } : null,
    template,
  };
}
