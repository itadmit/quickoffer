// Zod schemas live outside the "use server" module: such modules may only export async functions.
import { z } from "zod";

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
  // null = default template
  templateId: z.string().uuid().nullable(),
});
export type SettingsForm = z.infer<typeof SettingsSchema>;
