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

// ---- plan gating (§11). Order matters: index = rank.
export const PLANS = ["trial", "basic", "pro", "unlimited"] as const;
export type Plan = (typeof PLANS)[number];
export const PLAN_LABELS: Record<Plan, string> = { trial: "ניסיון", basic: "Basic", pro: "Pro", unlimited: "Unlimited" };

export function planAllows(userPlan: Plan, minPlan: Plan): boolean {
  return PLANS.indexOf(userPlan) >= PLANS.indexOf(minPlan);
}

/** Loose match of a spoken/typed template name ("מודרני", "תבנית מינימלית", "modern"). */
export function matchTemplateName<T extends { key: string; name: string }>(templates: T[], text: string): T | null {
  const norm = (v: string) => v.toLowerCase().replace(/^(תבנית|עיצוב|ה)\s*/u, "").replace(/[^\p{L}\p{N}]+/gu, "");
  const q = norm(text);
  if (!q) return null;
  return (
    templates.find((t) => norm(t.name) === q || t.key === q) ??
    templates.find((t) => norm(t.name).startsWith(q) || q.startsWith(norm(t.name))) ??
    null
  );
}
