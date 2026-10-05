/**
 * The little markup the description fields accept - `quotes.description` and
 * `quote_items.details`.
 *
 * Three forms and no more: a heading, a paragraph, a bullet. They exist
 * because a real service quote is prose *with structure* - the one that
 * prompted this feature opened with a paragraph, then two headed sections and
 * four bullet lists - and `white-space: pre-wrap` renders all of that as one
 * grey wall. Anything richer would be a rich-text editor, which is the kind of
 * system this product exists to avoid (PRODUCT.md §1).
 *
 * Every non-empty line is its own block, because the text arrives pasted from
 * Google Docs and WhatsApp, where a paragraph *is* a line and blank lines
 * between them are not reliable. A line that merely wraps on screen is still
 * one line in the source, so nothing gets split that shouldn't.
 *
 * Pure (no DB, no React) so it can be unit-tested; the renderer lives in
 * components/quote-layouts/shared.tsx.
 */

import { priceKey } from "./price-book";

export type RichBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] };

/** `## כותרת` - one to three hashes, so a model that emits `#` or `###` still lands. */
const HEADING = /^#{1,3}\s+(.*)$/u;

/** `- פריט`. The space is required, so a sentence that opens with a dash stays prose. */
const BULLET = /^[-–—•*]\s+(.*)$/u;

/**
 * `**text**` / `__text__`. Stripped rather than rendered: bold is not one of
 * the three forms, and leaking raw asterisks onto a document the customer
 * reads is worse than losing the emphasis.
 */
const EMPHASIS = /(\*\*|__)(?=\S)(.+?)(?<=\S)\1/gu;

/**
 * A line made of nothing but markers: a stray `##`, a lone `-`, a `---` rule
 * pasted out of a markdown document. None of them carry content, and the
 * fall-through would otherwise print the markers themselves onto the document
 * the customer reads.
 */
const MARKER_ONLY = /^[#\-–—•*\s]+$/u;

function clean(s: string): string {
  return s.replace(EMPHASIS, "$2").trim();
}

export function parseRichText(raw: string | null | undefined): RichBlock[] {
  if (!raw) return [];
  const blocks: RichBlock[] = [];
  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || MARKER_ONLY.test(trimmed)) continue;

    const heading = HEADING.exec(trimmed);
    if (heading) {
      const text = clean(heading[1]);
      if (text) blocks.push({ kind: "heading", text });
      continue;
    }

    const bullet = BULLET.exec(trimmed);
    if (bullet) {
      const text = clean(bullet[1]);
      if (!text) continue;
      const last = blocks[blocks.length - 1];
      // Consecutive bullets are one list, so the gap between them is list
      // spacing rather than paragraph spacing.
      if (last?.kind === "list") last.items.push(text);
      else blocks.push({ kind: "list", items: [text] });
      continue;
    }

    const text = clean(trimmed);
    if (text) blocks.push({ kind: "paragraph", text });
  }
  return blocks;
}

/** Longest description we store on a quote. The quote that prompted this is ~1,400 chars. */
export const MAX_DESCRIPTION = 4000;

/** Longest per-item block. A paragraph or two about one line of the table. */
export const MAX_ITEM_DETAILS = 1000;

type WithDetails = { description: string; details?: string | null };

/**
 * Put back the prose the model dropped.
 *
 * A chat correction returns the whole quote, and the model is told to echo
 * `details` on lines it did not touch - but it is not reliable about it, and
 * "תשנה את המחיר ל-6000" silently deleting two paragraphs the professional
 * wrote is the worst failure this feature can have. So the carry-over happens
 * in code: a returned line with no prose inherits the prose of the line it
 * matches by `priceKey`, the same identity the price book matches on.
 *
 * Only ever adds. An explicit new wording in the correction wins, because a
 * non-null `details` is left alone.
 */
export function carryOverDetails<T extends WithDetails>(returned: T[], existing: WithDetails[]): T[] {
  const byKey = new Map<string, string>();
  for (const it of existing) {
    const text = it.details?.trim();
    if (!text) continue;
    const key = priceKey(it.description);
    if (key && !byKey.has(key)) byKey.set(key, text);
  }
  if (!byKey.size) return returned;
  return returned.map((it) =>
    it.details?.trim() ? it : { ...it, details: byKey.get(priceKey(it.description)) ?? null },
  );
}
