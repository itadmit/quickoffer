import { normalizePhone } from "../phone";

/**
 * The professional's customer book, learned from the quotes they write.
 *
 * Pure (no DB) so it can be unit-tested and imported anywhere; persistence is
 * in ./contacts-store.ts. Sibling of ./price-book.ts, and for the same reason:
 * a detail the professional already told us once should never be asked twice.
 *
 * What it buys: "הצעה למריה" on Tuesday arrives already sendable, because on
 * Monday they said "הטלפון של מריה 054...". Before this, that number helped
 * exactly one quote and then died with it.
 */

export type ContactEntry = {
  key: string;
  name: string;
  phone: string | null;
  quoteCount: number;
};

const GERESH = /[׳'’‘`]/g;
const GERSHAYIM = /[״"“”]/g;
const NIQQUD = /[֑-ׇ]/g;

/**
 * Words that appear around a name without being part of it. Kept deliberately
 * short: over-stripping merges two real customers, which is far worse than
 * failing to match one. "מר" and "גברת" are titles, not names.
 */
const NOISE = new Set(["מר", "גב", "גברת", "הלקוח", "הלקוחה", "לקוח", "לקוחה", "של"]);

/**
 * Match key for a customer name.
 *
 * Conservative on purpose. Two spellings of one person should collapse
 * ("מריה סוחין" / "מריה  סוחין'"), but two different people must not - filling
 * in the wrong phone number would send one customer's quote to another, which
 * is the worst failure this product can have.
 */
export function contactKey(name: string): string {
  return name
    .normalize("NFKC")
    .replace(NIQQUD, "")
    .replace(GERESH, "")
    .replace(GERSHAYIM, "")
    .toLowerCase()
    .split(/[\s\-–—,.:;/\\()[\]]+/u)
    .filter((w) => w && !NOISE.has(w))
    .join(" ")
    .trim();
}

/** A name worth remembering: a real name, not a placeholder. */
export function isLearnableContact(name: string | null | undefined): boolean {
  if (!name) return false;
  const key = contactKey(name);
  // One character is a typo, not a customer; 80 is already a sentence.
  return key.length >= 2 && key.length <= 80;
}

/**
 * The phone we know for this customer, if we know one.
 *
 * Returns null rather than a guess when the name does not match exactly after
 * normalization. Fuzzy matching belongs nowhere near a field that decides who
 * receives the quote.
 */
export function findPhoneFor(
  name: string | null | undefined,
  book: ContactEntry[],
): ContactEntry | null {
  if (!name) return null;
  const key = contactKey(name);
  if (!key) return null;
  const hit = book.find((c) => c.key === key);
  return hit && normalizePhone(hit.phone) ? hit : null;
}
