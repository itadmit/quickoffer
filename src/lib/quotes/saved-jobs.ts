/**
 * Repeat jobs saved by name (PRODUCT.md §6.8).
 *
 * A saved job is the skeleton of a quote without a customer: "התקנת מזגן" =
 * visit + installation + materials. It is always born from a quote the
 * professional already made ("תשמור את זה כהתקנת מזגן") - there is deliberately
 * no way to author one from scratch, because a template-authoring form is the
 * kind of system this product exists to avoid (§1, §6.8).
 *
 * Not to be confused with `quote_templates`, which are *design* templates.
 *
 * This module is pure (no DB) so it can be unit-tested; persistence lives in
 * ./saved-jobs-store.ts.
 */

import type { QuoteJSON } from "../ai/types";
import { UNITS } from "../ai/types";
import { priceKey } from "./price-book";

export type SavedJobItemInput = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};

export type SavedJobSummary = {
  id: string;
  name: string;
  key: string;
  itemCount: number;
  total: number;
};

/** Longest name we will store. Long enough for "התקנת מזגן עילי כולל צנרת". */
export const MAX_JOB_NAME = 60;

/** How many job names we may hand to the intent classifier (§6.8 token budget). */
export const JOB_NAMES_FOR_PROMPT = 10;

/** Reuse the price-book normalizer so "התקנת המזגן" and "התקנת מזגן" are one job. */
export function jobKey(name: string): string {
  return priceKey(name);
}

/**
 * Clean a name the professional said out loud. Strips the lead-in they
 * naturally use ("תשמור את זה בתור…") when the LLM hands it back verbatim,
 * plus surrounding quotes and trailing punctuation.
 */
export function normalizeJobName(raw: string): string {
  return raw
    .trim()
    .replace(/^(בתור|בשם|כ)\s+/u, "")
    .replace(/^["'״׳]|["'״׳]$/gu, "")
    .replace(/[.,;:!?]+$/u, "")
    .trim()
    .slice(0, MAX_JOB_NAME);
}

export function isValidJobName(name: string): boolean {
  const n = normalizeJobName(name);
  return n.length >= 2 && n.length <= MAX_JOB_NAME;
}

/**
 * Items worth saving. A zero price is allowed - the professional may keep a
 * job whose price changes per site - but an empty description is not.
 */
export function itemsForJob(
  items: { description: string; quantity: number; unit: string; unitPrice: number }[],
): SavedJobItemInput[] {
  return items
    .filter((it) => it.description.trim().length >= 2)
    .map((it) => ({
      description: it.description.trim(),
      quantity: it.quantity > 0 ? it.quantity : 1,
      unit: it.unit,
      unitPrice: Math.max(0, it.unitPrice),
    }));
}

export function jobTotal(items: Pick<SavedJobItemInput, "quantity" | "unitPrice">[]): number {
  return items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
}

const UNIT_SET = new Set<string>(UNITS);
function safeUnit(unit: string): QuoteJSON["items"][number]["unit"] {
  return (UNIT_SET.has(unit) ? unit : "יח׳") as QuoteJSON["items"][number]["unit"];
}

/**
 * Turn a saved job into the same `QuoteJSON` the LLM would have produced, so
 * job-started quotes go through `createQuoteFromJSON` like every other quote -
 * one creation path, one place that allocates numbers and counts quota (§6.8).
 *
 * A zero-price line keeps `missing` confidence so it still lands as
 * `needsReview` and gets flagged in the summary, exactly as a voice note would.
 */
export function jobToQuoteJSON(
  job: { name: string; items: SavedJobItemInput[] },
  customerName: string | null,
): QuoteJSON {
  return {
    customerName,
    customerPhone: null,
    title: job.name,
    items: job.items.map((it) => ({
      description: it.description,
      quantity: it.quantity,
      unit: safeUnit(it.unit),
      unitPrice: it.unitPrice,
      priceConfidence: it.unitPrice > 0 ? "high" : "missing",
    })),
    discount: null,
    vatIncluded: null,
    paymentTerms: null,
    validDays: null,
    notes: [],
    needsReview: job.items.filter((it) => it.unitPrice <= 0).map((it) => it.description),
  };
}

/**
 * Guard for §6.8: a message carrying prices or quantities is a new quote, even
 * when it happens to contain a saved job's name. Without this, "התקנת מזגן
 * לדני, 2 יחידות 1200" would silently drop the numbers the professional said.
 */
const HAS_DIGITS = /\d/u;

/**
 * Whole-word match only. JS `\b` is defined over ASCII `\w`, so it never fires
 * between Hebrew letters - a `\b…\b` regex here would silently match nothing
 * and every spelled-out quantity would slip through as a job name.
 */
const SPELLED_QTY = new Set([
  "שתי", "שניים", "שני", "שלוש", "שלושה", "ארבע", "ארבעה", "חמש", "חמישה",
  "שש", "שישה", "שבע", "שבעה", "שמונה", "תשע", "תשעה", "עשר", "עשרה",
]);

export function looksLikeNewQuote(text: string): boolean {
  if (HAS_DIGITS.test(text)) return true;
  return text
    .split(/[\s,.:;!?()[\]"'״׳-]+/u)
    .some((w) => SPELLED_QTY.has(w));
}

/** Find the job the professional named, by normalized key then by containment. */
export function matchJob<T extends { name: string; key: string }>(
  jobs: T[],
  spoken: string,
): T | null {
  const key = jobKey(spoken);
  if (!key) return null;
  const exact = jobs.find((j) => j.key === key);
  if (exact) return exact;
  const contained = jobs.filter((j) => key.includes(j.key) || j.key.includes(key));
  // Ambiguous match is worse than none - we would start the wrong job.
  return contained.length === 1 ? contained[0] : null;
}
