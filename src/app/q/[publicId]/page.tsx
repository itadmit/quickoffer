import type { Metadata } from "next";
import { after } from "next/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { QuoteDocument, type QuoteView } from "@/components/quote-document";
import { totalLabel } from "@/components/quote-layouts/shared";
import { formatMoney } from "@/lib/quotes/calc";
import { recordView } from "@/lib/quotes/customer-actions";
import { appUrl } from "@/lib/quotes/links";
import { contactPhone, getQuoteByPublicId } from "@/lib/quotes/service";
import { normalizeTemplateSpec, type QuoteTemplateSpec } from "@/lib/quotes/template-spec";
import { getTemplateForUser } from "@/lib/quotes/templates";
import { CustomerActions } from "./customer-actions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ publicId: string }> };

/**
 * What WhatsApp renders in the forwarded message. The og:image comes from the
 * sibling opengraph-image.tsx; this supplies the text around it.
 *
 * Deliberately no index/follow: a quote is a private document between two
 * people (the root layout's robots directive carries down).
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { publicId } = await params;
  const q = await getQuoteByPublicId(publicId);
  if (!q) return { title: "הצעת מחיר" };

  const business = q.user.businessName ?? "QuickOffer";
  const title = `הצעת מחיר #${q.number}${q.customerName ? ` ל${q.customerName}` : ""} - ${business}`;
  const description = [q.title, `סה״כ ${formatMoney(q.total)}`, "לצפייה ולאישור"]
    .filter(Boolean)
    .join(" · ");

  return {
    title,
    description,
    // Absolute base for the sibling opengraph-image.
    metadataBase: await appUrlBase(),
    openGraph: { title, description, type: "website", locale: "he_IL", siteName: business },
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
          businessPhone: contactPhone(q.user),
          address: q.user.address,
          taxId: q.user.taxId,
          vatStatus: q.user.vatStatus,
        },
        approval: null,
        template: await getTemplateForUser(q.user),
      };

  const showBadge = q.user.plan === "trial" || q.user.plan === "basic";
  const open = !frozen && q.status !== "rejected" && !expired;
  const label = totalLabel(view);

  return (
    // Bottom padding clears the sticky decision bar while it is on screen.
    <main className={`flex-1 w-full max-w-lg mx-auto p-4 space-y-4 ${open ? "pb-44" : "pb-10"}`}>
      <QuoteDocument q={view} />

      <CustomerActions
        publicId={publicId}
        status={q.status}
        expired={expired}
        businessName={view.business.businessName}
        businessPhone={view.business.businessPhone}
        totalLabel={formatMoney(view.total)}
        totalNote={label.note ?? label.label}
      />

      {showBadge && (
        <p className="text-center text-xs text-muted pt-4">
          נוצר ב-<span className="font-semibold">QuickOffer</span> · הצעות מחיר מהודעה קולית
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
  template?: QuoteTemplateSpec;
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
    template: normalizeTemplateSpec(s.template),
  };
}
