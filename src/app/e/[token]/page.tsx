import type { Metadata } from "next";
import { Link2Off } from "lucide-react";
import { eq } from "drizzle-orm";
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
    return (
      <main className="flex-1 grid place-items-center p-6 text-center">
        <div className="space-y-2">
          <Link2Off className="h-10 w-10 mx-auto text-muted" />
          <h1 className="text-xl font-bold">הקישור לא תקף</h1>
          <p className="text-muted text-sm">
            קישורי עריכה תקפים ל-7 ימים. שלח &quot;ערוך&quot; ב-WhatsApp לקבלת קישור חדש.
          </p>
        </div>
      </main>
    );
  }

  const user = (await db.query.users.findFirst({ where: eq(users.id, q.userId) }))!;

  return (
    <QuoteEditor
      token={token}
      quote={{
        number: q.number,
        status: q.status,
        publicUrl: await publicLink(q.publicId),
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
