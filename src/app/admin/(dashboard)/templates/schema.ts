// Zod schemas live outside the "use server" module: such modules may only export async functions.
import { z } from "zod";
import { HEX_COLOR, PLANS, QUOTE_LAYOUTS } from "@/lib/quotes/template-spec";

export const TemplateSchema = z.object({
  key: z.string().trim().regex(/^[a-z0-9-]{2,40}$/, "key: a-z, 0-9, מקף"),
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(200).nullable(),
  layout: z.enum(QUOTE_LAYOUTS),
  accent: z.string().trim().regex(HEX_COLOR, "צבע בפורמט #rrggbb"),
  footerText: z.string().trim().max(1000).nullable(),
  enabled: z.boolean(),
  minPlan: z.enum(PLANS),
  isDefault: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
});
export type TemplateForm = z.infer<typeof TemplateSchema>;
