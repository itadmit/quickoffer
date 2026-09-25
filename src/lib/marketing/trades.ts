/**
 * The trades the landing page speaks to (PRODUCT.md §2).
 *
 * One list, two readers: the chips under "נבנה לבעלי מקצוע בשטח" and the
 * activity bubbles (activity-feed.ts). They have to agree - a visitor who sees
 * "מסגרות" float past and then cannot find it in the row of trades right above
 * has caught the page telling two different stories about who it is for.
 *
 * `as const` on purpose: the icon map in app/page.tsx is typed by this list, so
 * adding a trade here fails the build until it has an icon.
 */
export const TRADES = [
  "חשמל",
  "אינסטלציה",
  "מיזוג אוויר",
  "שיפוצים",
  "אלומיניום",
  "גינון",
  "התקנות",
  "צבע",
  "ריצוף",
  "גבס",
  "נגרות",
  "מנעולנות",
  "דלתות",
  "איטום וגגות",
  "מטבחים",
  "תריסים",
  "גדרות ופרגולות",
  "מצלמות ואזעקה",
  "טכנאי מכשירים",
  "הדברה",
] as const;

export type Trade = (typeof TRADES)[number];
