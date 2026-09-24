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

/** §6.8 - editing a saved job from the settings screen. */
export const JobItemSchema = z.object({
  description: z.string().trim().min(1).max(120),
  quantity: z.number().min(0.01).max(100_000),
  unit: z.string().trim().min(1).max(20),
  unitPrice: z.number().min(0).max(10_000_000),
});

export const JobFormSchema = z.object({
  name: z.string().trim().min(2).max(60),
  items: z.array(JobItemSchema).min(1).max(50),
});
export type JobForm = z.infer<typeof JobFormSchema>;

/** The customer book - learned from quotes, corrected here. */
export const ContactFormSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(30).nullable(),
});
export type ContactForm = z.infer<typeof ContactFormSchema>;
