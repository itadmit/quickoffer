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
 *  - Nothing states a time. The bubble says a quote was created, not that it
 *    happened this minute, because that is the claim we could not stand behind.
 *  - `marketing.activity` = "off" in `app_settings` removes the whole thing
 *    without a deploy.
 *
 * The honest version of this widget reads the last few rows of `quotes`,
 * anonymised, and it is the one to move to once the volume carries it: the
 * shape below is exactly what such a query would return, so the component does
 * not change. Today the table holds a couple of dozen rows, most of them our
 * own tests against the same customer name - a real feed would advertise how
 * quiet it is.
 */

import { TRADES, type Trade } from "./trades";

export type ActivityItem = { name: string; trade: Trade };

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
  return trades.map((trade) => {
    let name = "";
    // 400 pairs against at most 16 draws, so this settles on the first or
    // second try. Bounded anyway: a widget must not be able to hang a tab.
    for (let tries = 0; tries < 50; tries++) {
      const pick = () => LETTERS[Math.floor(rand() * LETTERS.length)];
      name = `${pick()}*** ${pick()}***`;
      if (!used.has(name)) break;
    }
    used.add(name);
    return { name, trade };
  });
}
