"use server";

import { eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { quoteTemplates, users } from "@/lib/db/schema";
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

function revalidate() {
  revalidatePath("/admin/templates");
  revalidatePath("/admin/templates/[id]", "page");
}

export async function saveTemplateAction(id: string | null, form: TemplateForm) {
  await requireAdmin();
  const parsed = TemplateSchema.safeParse(form);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "invalid" };
  const f = parsed.data;
  const values = {
    key: f.key,
    name: f.name,
    description: f.description || null,
    layout: f.layout,
    accent: f.accent.toLowerCase(),
    footerText: f.footerText || null,
    enabled: f.isDefault ? true : f.enabled,
    // the default must be available to everyone
    minPlan: f.isDefault ? "trial" : f.minPlan,
    isDefault: f.isDefault,
    sortOrder: f.sortOrder,
    updatedAt: new Date(),
  };
  try {
    let savedId = id;
    if (id) {
      await db.update(quoteTemplates).set(values).where(eq(quoteTemplates.id, id));
    } else {
      const [row] = await db.insert(quoteTemplates).values(values).returning({ id: quoteTemplates.id });
      savedId = row.id;
    }
    // exactly one default
    if (f.isDefault && savedId) {
      await db.update(quoteTemplates).set({ isDefault: false }).where(ne(quoteTemplates.id, savedId));
    }
    revalidate();
    return { ok: true as const, id: savedId! };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false as const, error: msg.includes("quote_templates_key_unique") ? "ה-key כבר קיים" : msg };
  }
}

export async function deleteTemplateAction(id: string) {
  await requireAdmin();
  const t = await db.query.quoteTemplates.findFirst({ where: eq(quoteTemplates.id, id) });
  if (!t) return { ok: false as const, error: "not found" };
  if (t.isDefault) return { ok: false as const, error: "אי אפשר למחוק את תבנית ברירת המחדל - קבע אחרת קודם" };
  // users on this template fall back to the default (FK is ON DELETE SET NULL; be explicit anyway)
  await db.update(users).set({ templateId: null }).where(eq(users.templateId, id));
  await db.delete(quoteTemplates).where(eq(quoteTemplates.id, id));
  revalidate();
  redirect("/admin/templates");
}
