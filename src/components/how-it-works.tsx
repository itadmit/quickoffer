"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BadgeCheck, Check, Forward, Mic, Zap } from "lucide-react";
import { VAT_RATE, calcTotals, formatMoney, formatQty } from "@/lib/quotes/calc";

/**
 * "How it works", as a scroll-driven film instead of three cards.
 *
 * One sticky stage, three acts, scrubbed by the scroll position: the voice note
 * is recorded and transcribed letter by letter, the sentence is taken apart into
 * a priced quote, and the customer signs it on their phone.
 *
 * Two channels drive it, on purpose:
 *  - continuous motion (fades, draws, the counter) rides CSS custom properties
 *    that a rAF loop writes straight onto the section, so scrolling never waits
 *    for React;
 *  - discrete milestones (which letter, which line, which act) are React state,
 *    and only change a few dozen times across the whole section.
 *
 * Under prefers-reduced-motion the acts un-stack into a plain vertical
 * storyboard (globals.css) and nothing is bound to the scroll at all.
 */

// ------------------------------------------------------------------ the script

type Part = "who" | "item0" | "item1" | "vat";

/** The spoken sentence, split so act 2 can light up the phrase behind each line. */
const SCRIPT: { t: string; part?: Part }[] = [
  { t: "הצעת מחיר " },
  { t: "לדני כהן", part: "who" },
  { t: " - " },
  { t: "שלוש נקודות חשמל 180 שקל ליחידה", part: "item0" },
  { t: ", " },
  { t: "ביקור 200", part: "item1" },
  { t: ", " },
  { t: "לפני מע״מ", part: "vat" },
];

const OFFSETS: number[] = [];
const SCRIPT_LEN = SCRIPT.reduce((n, s) => {
  OFFSETS.push(n);
  return n + s.t.length;
}, 0);

const ITEMS = [
  { description: "נקודת חשמל", quantity: 3, unit: "יח׳", unitPrice: 180 },
  { description: "ביקור טכנאי", quantity: 1, unit: "יח׳", unitPrice: 200 },
];

// The same maths the product runs, so the landing page can never show a total
// the quote itself would not produce.
const TOTALS = calcTotals(ITEMS, { vatRate: VAT_RATE, vatIncluded: false, discount: 0 });

/** Always two decimals: the total counts up, and tabular figures must not jump. */
const counting = (n: number) =>
  n.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₪";

const STEPS = [
  {
    title: "מקליטים",
    text: "הודעה קולית של 20 שניות, מהרכב או מהסולם. בלי להקליד, בלי טפסים, בלי אפליקציה להתקין.",
  },
  {
    title: "מקבלים הצעה מוכנה",
    text: "הבוט מזהה את הלקוח, את הפריטים ואת המחירים, מחשב מע״מ, ומחזיר הצעה מעוצבת והודעה נקייה להעברה.",
  },
  {
    title: "הלקוח מאשר וחותם",
    text: "הלקוח פותח מהטלפון, מאשר וחותם באצבע. אתה מקבל התראה ב-WhatsApp באותו רגע.",
  },
];

/**
 * Speech-shaped waveform. Rounded to three places and kept as a string: Node
 * and the browser can disagree on the last bit of Math.sin, and that alone is
 * enough to fail hydration on 44 inline custom properties.
 */
const BARS = Array.from({ length: 44 }, (_, i) => {
  const envelope = Math.sin((i / 43) * Math.PI) ** 0.4;
  const voice =
    0.45 + 0.28 * Math.sin(i * 0.8) + 0.18 * Math.sin(i * 2.1 + 1.3) + 0.14 * Math.sin(i * 0.33 + 2.4);
  return (Math.max(0.12, Math.min(1, voice)) * envelope).toFixed(3);
});

// ----------------------------------------------------------------- the timeline

/**
 * Where every beat sits on the section's 0..1 scroll. Act 1 hands over at .34,
 * act 2 at .72 - roughly a screen of scrolling each.
 */
const MARKS = {
  orb: [0.0, 0.05],
  rec: [0.02, 0.15],
  type: [0.09, 0.29],
  /** Act 1 out, act 2 in. The two fades are staggered inside this window
   *  (globals.css), so the acts hand over instead of sitting on top of
   *  each other half-transparent. */
  lift: [0.33, 0.42],
  who: [0.415, 0.45],
  item0: [0.46, 0.495],
  item1: [0.505, 0.54],
  tot: [0.56, 0.62],
  msg: [0.645, 0.695],
  act3: [0.73, 0.8],
  tap: [0.82, 0.86],
  sign: [0.86, 0.935],
  seal: [0.935, 0.96],
  note: [0.96, 1.0],
} as const;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const at = (t: number, m: readonly [number, number]) => clamp01((t - m[0]) / (m[1] - m[0]));
const easeOut = (x: number) => 1 - (1 - x) ** 3;
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

/** Milestones that change the DOM rather than a style: these live in React state. */
type Beats = {
  /** 0..2 - which act the rail is on */
  act: number;
  /** characters of SCRIPT revealed */
  typed: number;
  /** 0 none, 1 customer, 2 first line, 3 second line, 4 totals */
  built: number;
  /** phrase currently lit up in the recap */
  hot: Part | null;
  /** 0..1, quantised - drives the counting total */
  counted: number;
  seconds: number;
};

/** The finished state: what SSR, a JS-less browser and reduced motion all get. */
const DONE: Beats = { act: 2, typed: SCRIPT_LEN, built: 4, hot: null, counted: 1, seconds: 19 };

function beatsFor(t: number): Beats {
  return {
    act: t < 0.38 ? 0 : t < 0.765 ? 1 : 2,
    typed: Math.round(easeInOut(at(t, MARKS.type)) * SCRIPT_LEN),
    built:
      t >= MARKS.tot[0] ? 4 : t >= MARKS.item1[0] ? 3 : t >= MARKS.item0[0] ? 2 : t >= MARKS.who[0] ? 1 : 0,
    hot:
      t < MARKS.who[0] || t >= MARKS.msg[0]
        ? null
        : t < MARKS.item0[0]
          ? "who"
          : t < MARKS.item1[0]
            ? "item0"
            : t < MARKS.tot[0]
              ? "item1"
              : "vat",
    counted: Math.round(easeOut(at(t, MARKS.tot)) * 24) / 24,
    seconds: Math.round(at(t, MARKS.rec) * 19),
  };
}

const same = (a: Beats, b: Beats) =>
  a.act === b.act &&
  a.typed === b.typed &&
  a.built === b.built &&
  a.hot === b.hot &&
  a.counted === b.counted &&
  a.seconds === b.seconds;

// -------------------------------------------------------------------- component

export function HowItWorks() {
  const track = useRef<HTMLDivElement>(null);
  const [b, setB] = useState<Beats>(DONE);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const render = () => {
      frame = 0;
      const el = track.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      const t = travel > 0 ? clamp01(-rect.top / travel) : 0;

      // Continuous channel: straight to the DOM, no re-render.
      const vars: Record<string, number> = {
        "--orb": easeOut(at(t, MARKS.orb)),
        "--rec": at(t, MARKS.rec),
        "--type": at(t, MARKS.type),
        "--lift": easeInOut(at(t, MARKS.lift)),
        "--act3": easeInOut(at(t, MARKS.act3)),
        "--msg": easeOut(at(t, MARKS.msg)),
        "--tap": at(t, MARKS.tap),
        "--sign": at(t, MARKS.sign),
        "--seal": easeOut(at(t, MARKS.seal)),
        "--note": easeOut(at(t, MARKS.note)),
        "--rail": t,
      };
      for (const k in vars) el.style.setProperty(k, vars[k].toFixed(4));

      // Discrete channel: only when a milestone actually moves.
      const next = beatsFor(t);
      setB((prev) => (same(prev, next) ? prev : next));
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };

    render();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div ref={track} className="hiw-track" aria-hidden>
      <div className="hiw-sticky">
        <Rail act={b.act} />
        <div className="hiw-stage">
          <Record typed={b.typed} seconds={b.seconds} />
          <Build built={b.built} hot={b.hot} counted={b.counted} />
          <Sign />
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------ parts

function Rail({ act }: { act: number }) {
  return (
    <div className="hiw-rail">
      <div className="hiw-rail-track">
        <div className="hiw-rail-fill" />
      </div>
      <ol className="hiw-rail-steps">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            className="hiw-rail-step"
            data-on={act === i ? "" : undefined}
            data-done={act > i ? "" : undefined}
          >
            <span className="hiw-rail-dot">{act > i ? <Check className="h-4 w-4" /> : i + 1}</span>
            <span className="hiw-rail-label">{s.title}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Act 1 - the voice note, transcribed letter by letter. */
function Record({ typed, seconds }: { typed: number; seconds: number }) {
  return (
    <div className="hiw-act hiw-act-record">
      <div className="hiw-orb">
        <Mic className="hiw-orb-icon" />
      </div>

      <div className="hiw-wave">
        {BARS.map((h, i) => (
          <span key={i} className="hiw-bar" style={{ "--i": String(i), "--bh": h } as CSSProperties} />
        ))}
      </div>

      <div className="hiw-timer">
        <span className="hiw-rec-dot" />
        <bdi dir="ltr">0:{String(seconds).padStart(2, "0")}</bdi>
      </div>

      <p className="hiw-line">
        <span className="hiw-mark">״</span>
        {SCRIPT.map((s, i) => {
          const shown = Math.max(0, Math.min(s.t.length, typed - OFFSETS[i]));
          const here = typed > OFFSETS[i] && typed < OFFSETS[i] + s.t.length;
          return (
            <span key={i}>
              {s.t.slice(0, shown)}
              {here && <i className="hiw-caret" />}
              <span className="hiw-ghost">{s.t.slice(shown)}</span>
            </span>
          );
        })}
        <span className="hiw-mark hiw-mark-end">״</span>
      </p>

      <p className="hiw-caption">{STEPS[0].text}</p>
    </div>
  );
}

/** Act 2 - the sentence taken apart into a priced quote. */
function Build({ built, hot, counted }: { built: number; hot: Part | null; counted: number }) {
  return (
    <div className="hiw-act hiw-act-build">
      <p className="hiw-recap">
        {SCRIPT.map((s, i) =>
          // Only the phrases that became something get the chip treatment; the
          // glue between them stays plain text, or the sentence grows gaps.
          s.part ? (
            <span key={i} className="hiw-part" data-hot={s.part === hot ? "" : undefined}>
              {s.t}
            </span>
          ) : (
            <span key={i}>{s.t}</span>
          ),
        )}
      </p>

      <div className="hiw-build-row">
        <div className="hiw-card">
          <div className="hiw-card-head">
            <span className="hiw-logo">
              <Zap className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="font-bold truncate">יוסי חשמל</div>
              <div className="hiw-dim">הצעה #1042</div>
            </div>
            <div className="hiw-who hiw-reveal" data-on={built >= 1 ? "" : undefined}>
              <div className="hiw-dim">עבור</div>
              <div className="font-semibold truncate">דני כהן</div>
            </div>
          </div>

          <ul className="hiw-items">
            {ITEMS.map((it, i) => (
              <li key={it.description} className="hiw-item hiw-reveal" data-on={built >= i + 2 ? "" : undefined}>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{it.description}</div>
                  <div className="hiw-dim">
                    <bdi>
                      {formatQty(it.quantity)} {it.unit} × {formatMoney(it.unitPrice)}
                    </bdi>
                  </div>
                </div>
                <div className="hiw-item-total">{formatMoney(it.quantity * it.unitPrice)}</div>
              </li>
            ))}
          </ul>

          <div className="hiw-totals hiw-reveal" data-on={built >= 4 ? "" : undefined}>
            <div className="hiw-total-line">
              <span>מע״מ {Math.round(VAT_RATE * 100)}%</span>
              <span>{formatMoney(TOTALS.vatAmount)}</span>
            </div>
            <div className="hiw-total-line hiw-total-final">
              <span>לתשלום</span>
              <span className="hiw-total-sum">{counting(TOTALS.total * counted)}</span>
            </div>
          </div>
        </div>

        <div className="hiw-bubble">
          <div className="hiw-bubble-head">
            <Forward className="h-3.5 w-3.5" />
            מוכן להעברה ללקוח
          </div>
          <div className="hiw-bubble-body">
            שלום דני, מצורפת הצעת מחיר מיוסי חשמל:
            <br />
            <span className="hiw-link">quickoffer.co.il/q/a8Hd3k</span>
            <br />
            ההצעה תקפה ל-14 יום.
          </div>
        </div>
      </div>

      <p className="hiw-caption">{STEPS[1].text}</p>
    </div>
  );
}

/** Act 3 - the customer approves and signs, and the notification comes back. */
function Sign() {
  return (
    <div className="hiw-act hiw-act-sign">
      <div className="hiw-sign-row">
        <div className="hiw-phone">
          <div className="hiw-screen doc-surface">
            <div className="hiw-doc">
              <div className="hiw-doc-head">
                <span className="hiw-logo">
                  <Zap className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <div className="font-bold truncate">יוסי חשמל</div>
                  <div className="hiw-dim truncate">הצעה #1042 · דני כהן</div>
                </div>
              </div>
              {ITEMS.map((it) => (
                <div key={it.description} className="hiw-doc-row">
                  <span className="truncate">
                    {it.description} <bdi>×{formatQty(it.quantity)}</bdi>
                  </span>
                  <span className="hiw-amount">{formatMoney(it.quantity * it.unitPrice)}</span>
                </div>
              ))}
              <div className="hiw-doc-row hiw-dim">
                <span className="truncate">מע״מ {Math.round(VAT_RATE * 100)}%</span>
                <span className="hiw-amount">{formatMoney(TOTALS.vatAmount)}</span>
              </div>
              <div className="hiw-doc-note">תוקף ההצעה: 14 יום</div>
              <div className="hiw-doc-total">
                <span>לתשלום</span>
                <span className="hiw-amount">{formatMoney(TOTALS.total)}</span>
              </div>
            </div>

            <div className="hiw-decision">
              <span className="hiw-approve">
                <Check className="h-3.5 w-3.5" />
                אישור וחתימה
              </span>
              <span className="hiw-tap" />
            </div>

            <div className="hiw-sheet">
              {/* One slot, two states: signing, then signed. */}
              <div className="hiw-sheet-status">
                <span className="hiw-sheet-title">חתימת הלקוח</span>
                <span className="hiw-seal">
                  <BadgeCheck className="h-4 w-4" />
                  אושר ונחתם
                </span>
              </div>
              <svg className="hiw-sig" viewBox="0 0 170 58" fill="none">
                <path
                  className="hiw-sig-path"
                  pathLength={1}
                  d="M8 45 C 13 25, 21 9, 30 11 C 39 13, 36 33, 29 42 C 23 50, 16 45, 22 36 C 31 24, 45 23, 53 34 C 59 42, 65 45, 71 36 C 77 27, 80 12, 89 15 C 96 18, 93 36, 86 43 C 98 45, 105 29, 113 23 C 119 19, 126 23, 125 32 C 124 41, 131 45, 139 38 C 147 31, 152 19, 163 21"
                  stroke="currentColor"
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="hiw-sheet-name">דני כהן</div>
            </div>
          </div>
        </div>

        <div className="hiw-note">
          <span className="hiw-note-icon">
            <BadgeCheck className="h-4 w-4" />
          </span>
          <div>
            <div className="font-semibold">WhatsApp · עכשיו</div>
            <div className="hiw-dim">
              דני כהן אישר וחתם על הצעה #1042 · <bdi className="hiw-amount">{formatMoney(TOTALS.total)}</bdi>
            </div>
          </div>
        </div>
      </div>

      <p className="hiw-caption">{STEPS[2].text}</p>
    </div>
  );
}
