"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { buildFeed, type ActivityItem } from "@/lib/marketing/activity-feed";

/**
 * The bubble that slides in at the side of the page while you scroll: someone
 * else just made a quote here. Booking's hotel counter, for trades.
 *
 * Three things keep it from reading as a widget:
 *
 *  - it never fires on a clock. Each gap is drawn fresh, so two visitors never
 *    see the same rhythm and neither does the same visitor twice;
 *  - nothing inside one visit repeats (lib/marketing/activity-feed.ts);
 *  - it stops. Six bubbles and the run is over - the page is not a slot
 *    machine, and a bubble that is still arriving on minute four is an ad.
 *
 * Out of the accessibility tree on purpose: it carries nothing a visitor needs
 * and nothing they can act on, and a toast that interrupts a screen reader
 * every twenty seconds is worse than one it never announces.
 */

/** Deep enough that the hero is behind them and they are reading. */
const ARM_AT_PX = 500;
const FIRST_DELAY: readonly [number, number] = [4_500, 8_000];
const GAP: readonly [number, number] = [12_000, 26_000];
const HOLD = 5_200;
const RUN_LENGTH = 6;

const between = ([lo, hi]: readonly [number, number]) => lo + Math.random() * (hi - lo);

export function ActivityToast() {
  const [item, setItem] = useState<ActivityItem | null>(null);
  const [visible, setVisible] = useState(false);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (armed) return;
    const check = () => {
      if (window.scrollY > ARM_AT_PX) setArmed(true);
    };
    // Also runs once now, for a reload that restored a scroll position halfway
    // down the page - there may never be another scroll event.
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, [armed]);

  useEffect(() => {
    if (!armed) return;
    const feed = buildFeed(RUN_LENGTH);
    let i = 0;
    let timer = 0;
    let stopped = false;

    const show = () => {
      if (stopped) return;
      // A bubble that lived and died in a background tab is a bubble the
      // visitor paid for and never saw. Hold the run until they come back.
      if (document.hidden) {
        timer = window.setTimeout(show, 3_000);
        return;
      }
      setItem(feed[i]);
      setVisible(true);
      timer = window.setTimeout(hide, HOLD);
    };
    const hide = () => {
      if (stopped) return;
      setVisible(false);
      i++;
      if (i >= feed.length) return;
      timer = window.setTimeout(show, between(GAP));
    };

    timer = window.setTimeout(show, between(FIRST_DELAY));
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [armed]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-30 start-3 sm:start-6 bottom-28 sm:bottom-6 w-[min(20rem,calc(100vw-1.5rem))] print:hidden"
    >
      <div
        className={`flex items-start gap-3 rounded-2xl border border-line bg-card/95 p-3 shadow-[var(--shadow-card)] backdrop-blur transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        {item && (
          <>
            <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
              <FileText className="h-4 w-4" />
              <span className="absolute -top-0.5 -end-0.5 h-2.5 w-2.5 rounded-full bg-[var(--ok)] ring-2 ring-card" />
            </span>
            <div className="text-[12.5px] leading-snug">
              <p className="font-semibold">נוצרה הצעת מחיר עבור {item.name}</p>
              <p className="text-muted mt-0.5">תחום העסק: {item.trade}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
