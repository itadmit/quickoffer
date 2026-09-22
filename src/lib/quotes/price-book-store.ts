import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { priceBook, type QuoteItem } from "../db/schema";
import { isLearnable, priceKey, type PriceBookItem } from "./price-book";

/** DB side of the price book. The matching/filling logic is in ./price-book.ts. */

/** How many entries we load per quote - enough to cover a trade, small enough to stay cheap. */
const LOAD_LIMIT = 60;

/** The professional's catalog, most-used first. */
export async function loadPriceBook(userId: string, limit = LOAD_LIMIT): Promise<PriceBookItem[]> {
  const rows = await db
    .select({
      key: priceBook.key,
      description: priceBook.description,
      unit: priceBook.unit,
      unitPrice: priceBook.unitPrice,
      timesUsed: priceBook.timesUsed,
    })
    .from(priceBook)
    .where(eq(priceBook.userId, userId))
    .orderBy(desc(priceBook.timesUsed), desc(priceBook.lastUsedAt))
    .limit(limit);
  return rows;
}

/**
 * Learn from items the professional stands behind.
 *
 * Called when a quote is created, on every chat correction, and on every save
 * in the edit screen - a price typed by hand is the strongest signal there is,
 * so it overwrites what we had. Items still flagged `needsReview` are skipped:
 * we only remember numbers they actually meant.
 *
 * `bump` counts a *use*, and only quote creation passes it. The edit screen
 * autosaves every 800ms, so counting there would let two minutes of typing
 * outrank a year of real jobs and wreck the catalog ordering.
 */
export async function learnFromItems(
  userId: string,
  items: Pick<QuoteItem, "description" | "unit" | "unitPrice" | "needsReview">[],
  { bump = false }: { bump?: boolean } = {},
): Promise<void> {
  // Last occurrence wins inside a single quote, and one row per key keeps the
  // upsert from hitting the same key twice in one statement.
  const byKey = new Map<string, { description: string; unit: string; unitPrice: number }>();
  for (const it of items) {
    if (it.needsReview || !isLearnable(it)) continue;
    const key = priceKey(it.description);
    if (!key) continue;
    byKey.set(key, {
      description: it.description.trim(),
      unit: it.unit,
      unitPrice: it.unitPrice,
    });
  }
  if (!byKey.size) return;

  try {
    await db
      .insert(priceBook)
      .values(
        [...byKey].map(([key, v]) => ({
          userId,
          key,
          description: v.description,
          unit: v.unit,
          unitPrice: v.unitPrice,
        })),
      )
      .onConflictDoUpdate({
        target: [priceBook.userId, priceBook.key],
        set: {
          description: sql`excluded.description`,
          unit: sql`excluded.unit`,
          unitPrice: sql`excluded.unit_price`,
          timesUsed: bump ? sql`${priceBook.timesUsed} + 1` : sql`${priceBook.timesUsed}`,
          lastUsedAt: new Date(),
        },
      });
  } catch (err) {
    // The price book is an enhancement - never fail a quote over it.
    console.error("[price-book] learn failed", err);
  }
}

export async function countPriceBook(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(priceBook)
    .where(eq(priceBook.userId, userId));
  return row?.count ?? 0;
}

export async function forgetPrice(userId: string, key: string): Promise<void> {
  await db.delete(priceBook).where(and(eq(priceBook.userId, userId), eq(priceBook.key, key)));
}
