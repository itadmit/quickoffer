"use server";
import { resolveLink } from "@/lib/quotes/links";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { quotes } from "@/lib/db/schema";
import { learnFromItems } from "@/lib/quotes/price-book-store";
import { addEvent, deleteQuote, getQuote, markSent, replaceItemsAndRecalc } from "@/lib/quotes/service";
import { QuoteFormSchema, type QuoteForm } from "./schema";


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
  // A price typed by hand is the strongest signal there is - remember it.
  await learnFromItems(q.userId, f.items.map((it) => ({ ...it, unit: it.unit as string })));
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
