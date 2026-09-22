import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { LinkExpired } from "@/components/link-expired";
import { UNITS } from "@/lib/ai/types";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { publicLink, resolveLink } from "@/lib/quotes/links";
import { contactPhone, getQuote } from "@/lib/quotes/service";
import { getTemplateForUser } from "@/lib/quotes/templates";
import { QuoteEditor } from "./quote-editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "עריכת הצעה - QuickOffer" };

export default async function EditQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const subject = await resolveLink(token, "e");
  const q = subject ? await getQuote(subject) : null;

  if (!q) {
    return <LinkExpired hint="קישורי עריכה תקפים ל-7 ימים. שלח “ערוך” ב-WhatsApp לקבלת קישור חדש." />;
  }

  const user = (await db.query.users.findFirst({ where: eq(users.id, q.userId) }))!;

  return (
    <QuoteEditor
      token={token}
      quote={{
        number: q.number,
        status: q.status,
        publicUrl: await publicLink(q.publicId),
        defaultValidDays: user.defaultValidDays,
        vatRate: q.vatRate,
        transcript: q.transcript,
        business: {
          businessName: user.businessName,
          logoUrl: user.logoUrl,
          businessPhone: contactPhone(user),
          address: user.address,
          taxId: user.taxId,
          vatStatus: user.vatStatus,
        },
        createdAt: q.createdAt.toISOString(),
        template: await getTemplateForUser(user),
      }}
      initial={{
        customerName: q.customerName,
        customerPhone: q.customerPhone,
        title: q.title,
        items: q.items.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unit: (UNITS as readonly string[]).includes(it.unit) ? (it.unit as (typeof UNITS)[number]) : "יח׳",
          unitPrice: it.unitPrice,
          needsReview: it.needsReview,
        })),
        discountAmount: q.discountAmount,
        vatIncluded: q.vatIncluded,
        paymentTerms: q.paymentTerms,
        validUntil: q.validUntil ? q.validUntil.toISOString().slice(0, 10) : null,
        notes: q.notes ?? [],
      }}
    />
  );
}
