// Zod schemas live outside the "use server" module: such modules may only export async functions.
import { z } from "zod";
import { UNITS } from "@/lib/ai/types";

const ItemSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.number().min(0).max(100000),
  unit: z.enum(UNITS),
  unitPrice: z.number().min(0).max(10_000_000),
  needsReview: z.boolean(),
});

export const QuoteFormSchema = z.object({
  customerName: z.string().trim().max(120).nullable(),
  customerPhone: z.string().trim().max(30).nullable(),
  title: z.string().trim().max(200).nullable(),
  items: z.array(ItemSchema).max(50),
  discountAmount: z.number().min(0).max(10_000_000),
  vatIncluded: z.boolean(),
  paymentTerms: z.string().trim().max(500).nullable(),
  validUntil: z.string().nullable(), // yyyy-mm-dd
  notes: z.array(z.string().trim().max(300)).max(20),
});
export type QuoteForm = z.infer<typeof QuoteFormSchema>;
