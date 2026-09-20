import { QuoteDocument } from "./quote-document";
import { sampleQuoteView } from "@/lib/quotes/sample";
import type { QuoteTemplateSpec } from "@/lib/quotes/template-spec";

const FULL_WIDTH = 420;

/**
 * A scaled-down, non-interactive render of the sample quote in a template.
 * Height is clipped: enough to see the header, items and the total.
 */
export function TemplateThumb({ template, width = 210, height = 240 }: { template: QuoteTemplateSpec; width?: number; height?: number }) {
  const scale = width / FULL_WIDTH;
  return (
    <div className="relative overflow-hidden rounded-xl bg-surface" style={{ width, height }} aria-hidden>
      <div className="absolute top-0 pointer-events-none select-none" style={{ right: 0, width: FULL_WIDTH, transform: `scale(${scale})`, transformOrigin: "top right" }}>
        <QuoteDocument q={sampleQuoteView(template)} plain />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-surface to-transparent" />
    </div>
  );
}
