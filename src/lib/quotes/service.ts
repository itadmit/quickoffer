import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "../db";
import {
  quoteEvents,
  quoteItems,
  quotes,
  users,
  type Quote,
  type QuoteItem,
  type User,
} from "../db/schema";
import { newPublicId } from "../ids";
import type { QuoteJSON } from "../ai/types";
import { calcTotals, lineTotal, VAT_RATE } from "./calc";

export type QuoteWithItems = Quote & { items: QuoteItem[] };

/** Active draft (§6.1): last quote, created < 30 min ago, still draft. */
export const ACTIVE_DRAFT_WINDOW_MS = 30 * 60 * 1000;

export async function getQuote(id: string): Promise<QuoteWithItems | null> {
  const q = await db.query.quotes.findFirst({ where: eq(quotes.id, id) });
  if (!q) return null;
  const items = await db
    .select()
    .from(quoteItems)
    .where(eq(quoteItems.quoteId, id))
    .orderBy(quoteItems.position);
  return { ...q, items };
}

export async function getQuoteByPublicId(
  publicId: string,
): Promise<(QuoteWithItems & { user: User }) | null> {
  const q = await db.query.quotes.findFirst({ where: eq(quotes.publicId, publicId) });
  if (!q) return null;
  const [items, user] = await Promise.all([
    db.select().from(quoteItems).where(eq(quoteItems.quoteId, q.id)).orderBy(quoteItems.position),
    db.query.users.findFirst({ where: eq(users.id, q.userId) }),
  ]);
  if (!user) return null;
  return { ...q, items, user };
}

export async function getActiveDraft(userId: string): Promise<QuoteWithItems | null> {
  const since = new Date(Date.now() - ACTIVE_DRAFT_WINDOW_MS);
  const q = await db.query.quotes.findFirst({
    where: and(eq(quotes.userId, userId), eq(quotes.status, "draft"), gt(quotes.updatedAt, since)),
    orderBy: desc(quotes.createdAt),
  });
  if (!q) return null;
  // Must also be the user's most recent quote
  const latest = await db.query.quotes.findFirst({
    where: eq(quotes.userId, userId),
    orderBy: desc(quotes.createdAt),
  });
  if (!latest || latest.id !== q.id) return null;
  return getQuote(q.id);
}

export async function getLatestQuote(userId: string): Promise<QuoteWithItems | null> {
  const q = await db.query.quotes.findFirst({
    where: eq(quotes.userId, userId),
    orderBy: desc(quotes.createdAt),
  });
  return q ? getQuote(q.id) : null;
}

export async function listRecentQuotes(userId: string, limit = 5): Promise<Quote[]> {
  return db
    .select()
    .from(quotes)
    .where(eq(quotes.userId, userId))
    .orderBy(desc(quotes.createdAt))
    .limit(limit);
}

export async function addEvent(
  quoteId: string,
  type: (typeof quoteEvents.$inferInsert)["type"],
  payload: Record<string, unknown> = {},
) {
  await db.insert(quoteEvents).values({ quoteId, type, payload });
}

type ItemInput = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  needsReview: boolean;
};

/** Replace items and recompute stored totals. Shared by AI flows and the edit screen. */
export async function replaceItemsAndRecalc(
  quoteId: string,
  items: ItemInput[],
  head: {
    vatIncluded: boolean;
    vatRate: number;
    discountAmount: number;
  },
) {
  const totals = calcTotals(items, {
    vatRate: head.vatRate,
    vatIncluded: head.vatIncluded,
    discount: head.discountAmount,
  });
  await db.delete(quoteItems).where(eq(quoteItems.quoteId, quoteId));
  if (items.length) {
    await db.insert(quoteItems).values(
      items.map((it, i) => ({
        quoteId,
        position: i,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unitPrice: it.unitPrice,
        lineTotal: lineTotal(it),
        needsReview: it.needsReview,
      })),
    );
  }
  await db
    .update(quotes)
    .set({
      subtotal: totals.subtotal,
      vatAmount: totals.vatAmount,
      total: totals.total,
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, quoteId));
  return totals;
}

function itemsFromJSON(json: QuoteJSON): ItemInput[] {
  return json.items.map((it) => ({
    description: it.description,
    quantity: it.quantity > 0 ? it.quantity : 1,
    unit: it.unit,
    unitPrice: Math.max(0, it.unitPrice),
    needsReview:
      it.priceConfidence !== "high" || json.needsReview.includes(it.description),
  }));
}

/** Create a quote from the LLM output (§6.3). Allocates the per-user number. */
export async function createQuoteFromJSON(
  user: User,
  json: QuoteJSON,
  source: { transcript: string | null; audioUrl: string | null },
): Promise<QuoteWithItems> {
  const vatRate = user.vatStatus === "exempt" ? 0 : VAT_RATE;
  const vatIncluded = json.vatIncluded ?? false;
  const validDays = json.validDays ?? user.defaultValidDays;

  // Atomically take the next number for this user
  const [{ number }] = await db
    .update(users)
    .set({ nextQuoteNumber: sql`${users.nextQuoteNumber} + 1`, lastActiveAt: new Date() })
    .where(eq(users.id, user.id))
    .returning({ number: sql<number>`${users.nextQuoteNumber} - 1` });

  const [q] = await db
    .insert(quotes)
    .values({
      publicId: newPublicId(),
      userId: user.id,
      number,
      customerName: json.customerName,
      customerPhone: json.customerPhone,
      title: json.title,
      vatIncluded,
      vatRate,
      discountAmount: json.discount ?? 0,
      paymentTerms: json.paymentTerms ?? user.defaultPaymentTerms,
      notes: [...(json.notes ?? []), ...(user.defaultNotes ?? [])],
      validUntil: new Date(Date.now() + validDays * 86_400_000),
      transcript: source.transcript,
      audioUrl: source.audioUrl,
    })
    .returning();

  await replaceItemsAndRecalc(q.id, itemsFromJSON(json), {
    vatIncluded,
    vatRate,
    discountAmount: json.discount ?? 0,
  });
  await addEvent(q.id, "created", { source: source.audioUrl ? "voice" : "text" });
  return (await getQuote(q.id))!;
}

/** Apply a corrected JSON to an existing draft (§6.4). */
export async function applyJSONToQuote(
  quote: QuoteWithItems,
  json: QuoteJSON,
  instruction: string,
): Promise<QuoteWithItems> {
  const vatIncluded = json.vatIncluded ?? quote.vatIncluded;
  await db
    .update(quotes)
    .set({
      customerName: json.customerName ?? quote.customerName,
      customerPhone: json.customerPhone ?? quote.customerPhone,
      title: json.title ?? quote.title,
      vatIncluded,
      discountAmount: json.discount ?? 0,
      paymentTerms: json.paymentTerms ?? quote.paymentTerms,
      notes: json.notes ?? quote.notes,
      validUntil: json.validDays
        ? new Date(Date.now() + json.validDays * 86_400_000)
        : quote.validUntil,
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, quote.id));
  await replaceItemsAndRecalc(quote.id, itemsFromJSON(json), {
    vatIncluded,
    vatRate: quote.vatRate,
    discountAmount: json.discount ?? 0,
  });
  await addEvent(quote.id, "edited", { via: "chat", instruction });
  return (await getQuote(quote.id))!;
}

/** DB row → the JSON shape the LLM works with (for corrections). */
export function quoteToJSON(q: QuoteWithItems): QuoteJSON {
  return {
    customerName: q.customerName,
    customerPhone: q.customerPhone,
    title: q.title,
    items: q.items.map((it) => ({
      description: it.description,
      quantity: it.quantity,
      unit: it.unit as QuoteJSON["items"][number]["unit"],
      unitPrice: it.unitPrice,
      priceConfidence: it.needsReview ? (it.unitPrice === 0 ? "missing" : "low") : "high",
    })),
    discount: q.discountAmount || null,
    vatIncluded: q.vatIncluded,
    paymentTerms: q.paymentTerms,
    validDays: null,
    notes: q.notes ?? [],
    needsReview: q.items.filter((it) => it.needsReview).map((it) => it.description),
  };
}

export async function markSent(quoteId: string) {
  await db
    .update(quotes)
    .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
    .where(and(eq(quotes.id, quoteId), eq(quotes.status, "draft")));
  await addEvent(quoteId, "sent", { via: "chat" });
}

export async function deleteQuote(quoteId: string) {
  await db.delete(quotes).where(eq(quotes.id, quoteId));
}

/** Snapshot used by the public page after approval (§6.3, §8.2). */
export function snapshotOf(q: QuoteWithItems & { user: User }) {
  return {
    quote: { ...q, user: undefined, items: undefined },
    items: q.items,
    business: {
      businessName: q.user.businessName,
      logoUrl: q.user.logoUrl,
      businessPhone: q.user.businessPhone ?? q.user.phone,
      address: q.user.address,
      taxId: q.user.taxId,
      vatStatus: q.user.vatStatus,
    },
  };
}
