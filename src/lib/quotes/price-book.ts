/**
 * The professional's own price list, learned from the quotes they confirm.
 *
 * This module is pure (no DB) so it can be unit-tested and imported anywhere;
 * persistence lives in ./price-book-store.ts.
 *
 * Why it exists: a voice note often skips a price the professional charges the
 * same every time ("תוסיף גם נקודת חשמל"). The LLM must never guess a price
 * (PRODUCT.md §14), but *their own* last price is not a guess - so we fill it
 * in from here and say so in the summary.
 */

export type PriceBookItem = {
  key: string;
  description: string;
  unit: string;
  unitPrice: number;
  timesUsed: number;
};

export type FillableItem = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  needsReview: boolean;
};

/** An item whose price came from the book - surfaced in the chat summary. */
export type FilledFromBook = { description: string; unitPrice: number; timesUsed: number };

const GERESH = /[׳'’‘`]/g;
const GERSHAYIM = /[״"“”]/g;
const NIQQUD = /[֑-ׇ]/g;

/**
 * Match key for a description. Two phrasings of the same work must collapse to
 * the same key, while two different jobs must not.
 *
 * Deliberately conservative: we normalize punctuation, spacing and the
 * definite article, and nothing else. Stemming Hebrew would merge things like
 * "התקנת מזגן" and "פירוק מזגן", and a wrong price is worse than no price.
 */
export function priceKey(description: string): string {
  return description
    .normalize("NFKC")
    .replace(NIQQUD, "")
    .replace(GERESH, "")
    .replace(GERSHAYIM, "")
    .toLowerCase()
    .split(/[\s\-–—,.:;/\\()[\]]+/u)
    .map((w) => (w.length > 3 && w.startsWith("ה") ? w.slice(1) : w))
    .filter((w) => w && !STOP_WORDS.has(w))
    .join(" ")
    .trim();
}

// Filler that carries no meaning for matching. Kept tiny on purpose.
const STOP_WORDS = new Set(["של", "עם", "את", "או", "וכן", "בערך"]);

/** Entries worth remembering: a real price, a real description. */
export function isLearnable(item: { description: string; unitPrice: number }): boolean {
  const d = item.description.trim();
  return d.length >= 2 && d.length <= 120 && item.unitPrice > 0 && Number.isFinite(item.unitPrice);
}

/**
 * Fill prices the professional left out, from their own book.
 *
 * Only touches items with no price at all. An item the book filled stops being
 * `needsReview` - it is their own number, not our invention - but it is always
 * reported back so they can override it.
 */
export function applyPriceBook<T extends FillableItem>(
  items: T[],
  book: PriceBookItem[],
): { items: T[]; filled: FilledFromBook[] } {
  if (!book.length) return { items, filled: [] };
  const byKey = new Map(book.map((b) => [b.key, b]));
  const filled: FilledFromBook[] = [];

  const next = items.map((it) => {
    if (it.unitPrice > 0) return it;
    const hit = byKey.get(priceKey(it.description));
    if (!hit) return it;
    filled.push({ description: it.description, unitPrice: hit.unitPrice, timesUsed: hit.timesUsed });
    return { ...it, unitPrice: hit.unitPrice, needsReview: false };
  });

  return { items: next, filled };
}

/**
 * The descriptions handed to the structuring prompt (lib/ai/prompts.ts), so the
 * model phrases repeat work the way this professional already phrases it and
 * the keys line up for `applyPriceBook`.
 *
 * Prices stay out of the prompt on purpose: filling happens in code above,
 * where it is deterministic, testable and free in tokens - the Groq free tier
 * gives us ~8k tokens/minute and the prompt is already tight (CLAUDE.md).
 */
export const CATALOG_PROMPT_LIMIT = 25;

export function catalogNames(book: PriceBookItem[]): string[] {
  return book.slice(0, CATALOG_PROMPT_LIMIT).map((b) => b.description);
}
