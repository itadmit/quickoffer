"use client";

import { useEffect, useState } from "react";

/**
 * The call to action that follows you down the page, on phones only.
 *
 * The landing page is long - the "how it works" film alone is about four
 * screens of scrolling - so between the hero button and the closing one there
 * is a stretch where nothing is tappable. This fills it, but only in that
 * stretch:
 *
 *  - it stays hidden until #cta-start has scrolled past, which is the end of
 *    the film. Showing it earlier would park a fixed bar over the bottom of
 *    the sticky stage, right where the act captions are;
 *  - it hides again once #cta-final is on screen, so the closing section is
 *    never two buttons saying the same thing.
 *
 * Desktop keeps the nav button in view instead.
 */
export function StickyCta({ href }: { href: string }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const start = document.getElementById("cta-start");
    const final = document.getElementById("cta-final");
    if (!start || !final) return;

    let passed = false;
    let atEnd = false;
    const sync = () => setShown(passed && !atEnd);

    // "Have I scrolled past this?" as an intersection: the root is stretched
    // into a tall band that ends at the top of the viewport, so the sentinel
    // intersects it exactly when it is above the fold. Watching the sentinel
    // itself would miss a fast flick or a deep-link - it can cross the whole
    // viewport between two frames without the observer ever seeing it inside.
    const after = new IntersectionObserver(
      ([e]) => {
        passed = e.isIntersecting;
        sync();
      },
      { rootMargin: "100000px 0px -100% 0px" },
    );
    const until = new IntersectionObserver(
      ([e]) => {
        atEnd = e.isIntersecting;
        sync();
      },
      { threshold: 0 },
    );
    after.observe(start);
    until.observe(final);
    return () => {
      after.disconnect();
      until.disconnect();
    };
  }, []);

  return (
    <div
      className={`sm:hidden fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/85 backdrop-blur-md px-4 pt-3 transition-transform duration-300 ease-out motion-reduce:transition-none ${
        shown ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      // Out of the tab order while it is off screen: a button nobody can see
      // should not be the next thing the keyboard lands on.
      inert={!shown}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener"
        className="flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-white font-semibold py-3.5 shadow-lg shadow-[#25D366]/30 active:scale-[0.99]"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
          <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.6c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z" />
        </svg>
        התחל ב-WhatsApp
      </a>
      <p className="text-center text-[11px] text-muted mt-1.5">5 הצעות ראשונות חינם</p>
    </div>
  );
}
