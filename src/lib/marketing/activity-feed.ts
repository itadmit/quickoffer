/**
 * The floating "someone just made a quote" bubbles on the landing page
 * (components/activity-toast.tsx).
 *
 * ⚠️ These items are **generated here**, not read from `quotes`. That is a
 * deliberate product decision and it is the whole reason this file has a
 * comment this long:
 *
 *  - Nothing identifies a real person. The name is two Hebrew letters picked at
 *    random, which is not an initial of anybody in particular, and no customer
 *    of any professional on the platform is described.
 *  - The "ברגע זה / לפני X דקות" line is generated with the rest of the item.
 *    It is the piece that claims the most and can be defended the least, so it
 *    stays coarse - whole minutes inside a quarter of an hour, never a clock
 *    time, never a date, and never tied to a row anybody could go looking for.
 *  - `marketing.activity` = "off" in `app_settings` removes the whole thing
 *    without a deploy, and it is the switch to reach for rather than editing
 *    the copy if the claim ever needs to stop.
 *
 * The honest version of this widget reads the last few rows of `quotes`,
 * anonymised, and it is the one to move to once the volume carries it: the
 * shape below is exactly what such a query would return, so the component does
 * not change. Today the table holds a couple of dozen rows, most of them our
 * own tests against the same customer name - a real feed would advertise how
 * quiet it is.
 */

import { TRADES, type Trade } from "./trades";

export type ActivityItem = { name: string; trade: Trade; minutesAgo: number };

/**
 * How far back the bubbles are allowed to reach. Fifteen minutes because the
 * run itself is about two: a page that keeps announcing quotes from an hour ago
 * is describing a quiet morning, which is the opposite of the point.
 */
const MINUTES_WINDOW = 15;

/**
 * The line on the left of the bubble. Hebrew counts one and two apart from the
 * rest, and "לפני 2 דקות" is the kind of phrasing that tells a visitor a
 * machine wrote the sentence.
 */
export function relativeTime(minutesAgo: number): string {
  if (minutesAgo <= 0) return "ברגע זה";
  if (minutesAgo === 1) return "לפני דקה";
  if (minutesAgo === 2) return "לפני שתי דקות";
  return `לפני ${minutesAgo} דקות`;
}

/**
 * Initials shown as `<letter>***`. Hebrew letters that actually open names,
 * so the pair reads like a censored one rather than a random string.
 */
const LETTERS = [
  "א", "ב", "ג", "ד", "ה", "ז", "ח", "ט", "י", "כ",
  "ל", "מ", "נ", "ס", "ע", "פ", "צ", "ר", "ש", "ת",
];

function shuffled<T>(xs: readonly T[], rand: () => number): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * One visit's worth of bubbles. Everything inside a run is distinct - a trade
 * or a pair of initials coming round twice is what gives a rotating widget
 * away, and a visitor who notices the loop stops believing the rest of the
 * page too.
 */
export function buildFeed(count: number, rand: () => number = Math.random): ActivityItem[] {
  const trades = shuffled(TRADES, rand).slice(0, Math.max(0, Math.min(count, TRADES.length)));
  const used = new Set<string>();
  // Drawn from a pool rather than one at a time, for the same reason as the
  // trades: two bubbles that both say "לפני 6 דקות" read as one template with
  // the words swapped. The pool grows if the run is longer than the window, so
  // distinctness never quietly depends on how many bubbles were asked for.
  const minutes = shuffled(
    Array.from({ length: Math.max(trades.length, MINUTES_WINDOW) }, (_, i) => i),
    rand,
  );
  return trades.map((trade, i) => {
    let name = "";
    // 400 pairs against at most 16 draws, so this settles on the first or
    // second try. Bounded anyway: a widget must not be able to hang a tab.
    for (let tries = 0; tries < 50; tries++) {
      const pick = () => LETTERS[Math.floor(rand() * LETTERS.length)];
      name = `${pick()}*** ${pick()}***`;
      if (!used.has(name)) break;
    }
    used.add(name);
    return { name, trade, minutesAgo: minutes[i] };
  });
}
