import type { Metadata } from "next";
import { after } from "next/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { QuoteDocument, type QuoteView } from "@/components/quote-document";
import { recordView } from "@/lib/quotes/customer-actions";
import { getQuoteByPublicId } from "@/lib/quotes/service";
import { CustomerActions } from "./customer-actions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ publicId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { publicId } = await params;
  const q = await getQuoteByPublicId(publicId);
  if (!q) return { title: "הצעת מחיר" };
  return {
    title: `הצעת מחיר #${q.number}${q.customerName ? ` ל${q.customerName}` : ""} - ${q.user.businessName ?? "QuickVoice"}`,
    description: q.title ?? undefined,
  };
}

export default async function CustomerQuotePage({ params }: Props) {
  const { publicId } = await params;
  const q = await getQuoteByPublicId(publicId);
  if (!q) notFound();

  const h = await headers();
  const meta = {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    ua: h.get("user-agent"),
  };
  // View tracking after the response (§8.2) - never blocks the customer.
  after(() => recordView(publicId, meta).catch((e) => console.error("[recordView]", e)));

  const expired =
    q.status === "expired" || (q.validUntil ? q.validUntil < new Date() : false);
  const frozen = q.status === "approved" && q.approvedSnapshot;

  // Frozen snapshot after approval; live data otherwise (§8.2)
  const view: QuoteView = frozen
    ? snapshotToView(q.approvedSnapshot as Snapshot)
    : {
        number: q.number,
        customerName: q.customerName,
        title: q.title,
        createdAt: q.createdAt,
        validUntil: q.validUntil,
        items: q.items,
        subtotal: q.subtotal,
        discountAmount: q.discountAmount,
        vatRate: q.vatRate,
        vatIncluded: q.vatIncluded,
        vatAmount: q.vatAmount,
        total: q.total,
        paymentTerms: q.paymentTerms,
        notes: q.notes ?? [],
        business: {
          businessName: q.user.businessName,
          logoUrl: q.user.logoUrl,
          businessPhone: q.user.businessPhone ?? q.user.phone,
          address: q.user.address,
          taxId: q.user.taxId,
          vatStatus: q.user.vatStatus,
        },
        approval: null,
      };

  const showBadge = q.user.plan === "trial" || q.user.plan === "basic";

  return (
    <main className="flex-1 w-full max-w-lg mx-auto p-4 pb-10 space-y-4">
      <QuoteDocument q={view} />

      <CustomerActions
        publicId={publicId}
        status={q.status}
        expired={expired}
        businessName={view.business.businessName}
        businessPhone={view.business.businessPhone}
      />

      {showBadge && (
        <p className="text-center text-xs text-muted pt-4">
          נוצר ב-<span className="font-semibold">QuickVoice</span> · הצעות מחיר מהודעה קולית
        </p>
      )}
    </main>
  );
}

type Snapshot = {
  quote: QuoteView & Record<string, unknown>;
  items: QuoteView["items"];
  business: QuoteView["business"];
  approval: NonNullable<QuoteView["approval"]>;
};

function snapshotToView(s: Snapshot): QuoteView {
  const qq = s.quote;
  return {
    number: qq.number,
    customerName: qq.customerName,
    title: qq.title,
    createdAt: new Date(qq.createdAt),
    validUntil: qq.validUntil ? new Date(qq.validUntil) : null,
    items: s.items,
    subtotal: qq.subtotal,
    discountAmount: qq.discountAmount,
    vatRate: qq.vatRate,
    vatIncluded: qq.vatIncluded,
    vatAmount: qq.vatAmount,
    total: qq.total,
    paymentTerms: qq.paymentTerms,
    notes: (qq.notes as string[]) ?? [],
    business: s.business,
    approval: s.approval,
  };
}
