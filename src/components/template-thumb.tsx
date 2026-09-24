"use client";

import { useEffect, useRef, useState } from "react";
import { QuoteDocument } from "./quote-document";
import { sampleQuoteView } from "@/lib/quotes/sample";
import type { QuoteTemplateSpec } from "@/lib/quotes/template-spec";

const FULL_WIDTH = 420;

/**
 * A scaled-down, non-interactive render of the sample quote in a template.
 * Height is clipped: enough to see the header, items and the total.
 *
 * Fluid: `width`/`height` are the *largest* size and the aspect to keep. The box
 * fills its column and the document is scaled to whatever the column actually
 * is, so a thumb in a narrow grid cell never spills sideways and drags the page
 * into horizontal scroll.
 *
 * `fill` drops the width cap for callers that give the thumb a column of its
 * own: a box narrower than its cell sits at the inline-start, which in RTL
 * leaves the slack on the left and pushes the thumb out of line with the label
 * under it. Still capped at FULL_WIDTH so the render never scales past 1:1.
 */
export function TemplateThumb({ template, width = 210, height = 240, fill = false }: { template: QuoteTemplateSpec; width?: number; height?: number; fill?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [actual, setActual] = useState(width);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setActual(e.contentRect.width || width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  const scale = actual / FULL_WIDTH;
  return (
    <div
      ref={box}
      className="relative overflow-hidden rounded-xl bg-surface w-full"
      style={{ maxWidth: fill ? FULL_WIDTH : width, aspectRatio: `${width} / ${height}` }}
      aria-hidden
    >
      <div className="absolute top-0 pointer-events-none select-none" style={{ right: 0, width: FULL_WIDTH, transform: `scale(${scale})`, transformOrigin: "top right" }}>
        <QuoteDocument q={sampleQuoteView(template)} plain />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-surface to-transparent" />
    </div>
  );
}
