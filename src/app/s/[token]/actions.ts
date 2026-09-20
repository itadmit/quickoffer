"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { verifyToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { storeFile } from "@/lib/storage";

export const SettingsSchema = z.object({
  businessName: z.string().trim().min(1).max(120),
  businessPhone: z.string().trim().max(30).nullable(),
  address: z.string().trim().max(200).nullable(),
  taxId: z.string().trim().max(30).nullable(),
  vatStatus: z.enum(["exempt", "registered"]),
  defaultPaymentTerms: z.string().trim().max(500).nullable(),
  defaultNotes: z.array(z.string().trim().max(300)).max(20),
  defaultValidDays: z.number().int().min(1).max(365),
  nextQuoteNumber: z.number().int().min(1).max(999_999),
});
export type SettingsForm = z.infer<typeof SettingsSchema>;

async function authorize(token: string) {
  const payload = verifyToken(token, "s");
  if (!payload) return null;
  return db.query.users.findFirst({ where: eq(users.id, payload.s) });
}

export async function saveSettingsAction(token: string, form: SettingsForm) {
  const user = await authorize(token);
  if (!user) return { ok: false as const, error: "unauthorized" };
  const parsed = SettingsSchema.safeParse(form);
  if (!parsed.success) return { ok: false as const, error: "invalid" };
  const f = parsed.data;
  await db
    .update(users)
    .set({
      businessName: f.businessName,
      businessPhone: f.businessPhone || null,
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
