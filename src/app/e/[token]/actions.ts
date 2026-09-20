"use server";
import { resolveLink } from "@/lib/quotes/links";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { UNITS } from "@/lib/ai/types";
import { db } from "@/lib/db";
import { quotes } from "@/lib/db/schema";
import { addEvent, deleteQuote, getQuote, markSent, replaceItemsAndRecalc } from "@/lib/quotes/service";

const ItemSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.number().min(0).max(100000),
  unit: z.enum(UNITS),
  unitPrice: z.number().min(0).max(10_000_000),
  needsReview: z.boolean(),
});

export const QuoteFormSchema = z.object({
  customerName: z.string().trim().max(120).nullable(),
  customerPhone: z.string().trim().max(30).nullable(),
  title: z.string().trim().max(200).nullable(),
  items: z.array(ItemSchema).max(50),
  discountAmount: z.number().min(0).max(10_000_000),
  vatIncluded: z.boolean(),
  paymentTerms: z.string().trim().max(500).nullable(),
  validUntil: z.string().nullable(), // yyyy-mm-dd
  notes: z.array(z.string().trim().max(300)).max(20),
});
export type QuoteForm = z.infer<typeof QuoteFormSchema>;

async function authorize(token: string) {
  const subject = await resolveLink(token, "e");
  if (!subject) return null;
  const q = await getQuote(subject);
  if (!q) return null;
  return q;
}

export async function saveQuoteAction(token: string, form: QuoteForm) {
  const q = await authorize(token);
  if (!q) return { ok: false as const, error: "unauthorized" };
  if (q.status === "approved" || q.status === "rejected") {
    return { ok: false as const, error: "locked" };
  }
  const parsed = QuoteFormSchema.safeParse(form);
  if (!parsed.success) return { ok: false as const, error: "invalid" };
  const f = parsed.data;

  await db
    .update(quotes)
    .set({
      customerName: f.customerName || null,
      customerPhone: f.customerPhone || null,
      title: f.title || null,
      discountAmount: f.discountAmount,
      vatIncluded: f.vatIncluded,
      paymentTerms: f.paymentTerms || null,
      validUntil: f.validUntil ? new Date(`${f.validUntil}T23:59:59`) : null,
      notes: f.notes.filter(Boolean),
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, q.id));
  const totals = await replaceItemsAndRecalc(q.id, f.items, {
    vatIncluded: f.vatIncluded,
    vatRate: q.vatRate,
    discountAmount: f.discountAmount,
  });
  await addEvent(q.id, "edited", { via: "web" });
  revalidatePath(`/q/${q.publicId}`);
  return { ok: true as const, totals };
}

export async function markSentAction(token: string) {
  const q = await authorize(token);
  if (!q) return { ok: false as const };
  await markSent(q.id);
  return { ok: true as const };
}

export async function deleteQuoteAction(token: string) {
  const q = await authorize(token);
  if (!q) return { ok: false as const };
  if (q.status === "approved") return { ok: false as const };
  await deleteQuote(q.id);
  return { ok: true as const };
}
