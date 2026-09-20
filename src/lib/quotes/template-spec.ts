/**
 * The part of a quote template that the renderer needs. Pure - safe to import
 * from client components. DB access lives in ./templates.ts.
 */
export const QUOTE_LAYOUTS = ["classic", "modern", "minimal"] as const;
export type QuoteLayout = (typeof QUOTE_LAYOUTS)[number];

export const LAYOUT_LABELS: Record<QuoteLayout, string> = {
  classic: "קלאסי",
  modern: "מודרני",
  minimal: "מינימלי",
};

export type QuoteTemplateSpec = {
  layout: QuoteLayout;
  accent: string;
  footerText: string | null;
};

export const DEFAULT_TEMPLATE: QuoteTemplateSpec = {
  layout: "classic",
  accent: "#0f766e",
  footerText: null,
};

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function normalizeTemplateSpec(t: Partial<QuoteTemplateSpec> | null | undefined): QuoteTemplateSpec {
  return {
    layout: t?.layout && (QUOTE_LAYOUTS as readonly string[]).includes(t.layout) ? t.layout : DEFAULT_TEMPLATE.layout,
    accent: t?.accent && HEX_COLOR.test(t.accent) ? t.accent : DEFAULT_TEMPLATE.accent,
    footerText: t?.footerText?.trim() || null,
  };
}
