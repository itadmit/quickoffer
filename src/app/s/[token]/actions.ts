"use server";
import { resolveLink } from "@/lib/quotes/links";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { planAllows } from "@/lib/quotes/template-spec";
import { getTemplate } from "@/lib/quotes/templates";
import { storeFile } from "@/lib/storage";
import { SettingsSchema, type SettingsForm } from "./schema";


async function authorize(token: string) {
  const subject = await resolveLink(token, "s");
  if (!subject) return null;
  return db.query.users.findFirst({ where: eq(users.id, subject) });
}

export async function saveSettingsAction(token: string, form: SettingsForm) {
  const user = await authorize(token);
  if (!user) return { ok: false as const, error: "unauthorized" };
  const parsed = SettingsSchema.safeParse(form);
  if (!parsed.success) return { ok: false as const, error: "invalid" };
  const f = parsed.data;
  // only an existing, enabled template the plan allows can be chosen
  const template = f.templateId ? await getTemplate(f.templateId) : null;
  if (f.templateId && !(template?.enabled && planAllows(user.plan, template.minPlan))) {
    return { ok: false as const, error: "template_locked" };
  }
  const templateId = template?.id ?? null;
  await db
    .update(users)
    .set({
      templateId,
      businessName: f.businessName,
      businessPhone: normalizePhone(f.businessPhone),
      address: f.address || null,
      taxId: f.taxId || null,
      vatStatus: f.vatStatus,
      defaultPaymentTerms: f.defaultPaymentTerms || null,
      defaultNotes: f.defaultNotes.filter(Boolean),
      defaultValidDays: f.defaultValidDays,
      // never move the counter backwards past an existing number
      nextQuoteNumber: Math.max(f.nextQuoteNumber, user.nextQuoteNumber > 1001 ? user.nextQuoteNumber : 1),
    })
    .where(eq(users.id, user.id));
  return { ok: true as const };
}

export async function uploadLogoAction(token: string, formData: FormData) {
  const user = await authorize(token);
  if (!user) return { ok: false as const, error: "unauthorized" };
  const file = formData.get("logo");
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return { ok: false as const, error: "invalid" };
  }
  if (file.size > 3 * 1024 * 1024) return { ok: false as const, error: "too_large" };
  const ext = file.type.split("/")[1] ?? "png";
  const url = await storeFile(`logos/${user.id}.${ext}`, Buffer.from(await file.arrayBuffer()), file.type);
  if (!url) return { ok: false as const, error: "storage" };
  await db.update(users).set({ logoUrl: url }).where(eq(users.id, user.id));
  return { ok: true as const, url };
}

export async function removeLogoAction(token: string) {
  const user = await authorize(token);
  if (!user) return { ok: false as const };
  await db.update(users).set({ logoUrl: null }).where(eq(users.id, user.id));
  return { ok: true as const };
}

/** "050-123-4567" / "+972 50..." → "972501234567"; anything unparseable is kept as typed. */
function normalizePhone(v: string | null): string | null {
  if (!v) return null;
  const d = v.replace(/\D/g, "");
  if (d.length === 10 && d.startsWith("0")) return `972${d.slice(1)}`;
  if (d.length === 9 && !d.startsWith("0")) return `972${d}`;
  return d || null;
}
