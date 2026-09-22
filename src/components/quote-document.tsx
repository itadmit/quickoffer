import { DEFAULT_TEMPLATE, type QuoteLayout } from "@/lib/quotes/template-spec";
import { ClassicLayout } from "./quote-layouts/classic";
import { MinimalLayout } from "./quote-layouts/minimal";
import { ModernLayout } from "./quote-layouts/modern";
import type { LayoutProps, QuoteView } from "./quote-layouts/shared";

export { formatPhone } from "./quote-layouts/shared";
export type { QuoteView } from "./quote-layouts/shared";

const LAYOUTS: Record<QuoteLayout, (p: LayoutProps) => React.ReactNode> = {
  classic: ClassicLayout,
  modern: ModernLayout,
  minimal: MinimalLayout,
};

/**
 * Renders a quote in its template. Shared by the customer page, the editor
 * preview and /admin/templates.
 *
 * `doc-surface` pins the document to the paper palette: the page around it
 * follows the system theme, but the quote is a document and stays on white, so
 * it matches the print and the professional's chosen accent stays true.
 */
export function QuoteDocument({ q, showReviewFlags = false, plain = false }: { q: QuoteView; showReviewFlags?: boolean; plain?: boolean }) {
  const t = q.template ?? DEFAULT_TEMPLATE;
  const Layout = LAYOUTS[t.layout] ?? ClassicLayout;
  return (
    <div className="doc-surface">
      <Layout q={q} t={t} showReviewFlags={showReviewFlags} plain={plain} />
    </div>
  );
}
