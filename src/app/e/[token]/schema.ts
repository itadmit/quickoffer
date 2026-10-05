// Zod schemas live outside the "use server" module: such modules may only export async functions.
import { z } from "zod";
import { UNITS } from "@/lib/ai/types";
import { MAX_DESCRIPTION, MAX_ITEM_DETAILS } from "@/lib/quotes/rich-text";

const ItemSchema = z.object({
  description: z.string().trim().min(1).max(200),
  details: z.string().trim().max(MAX_ITEM_DETAILS).nullable(),
  quantity: z.number().min(0).max(100000),
  unit: z.enum(UNITS),
  unitPrice: z.number().min(0).max(10_000_000),
  needsReview: z.boolean(),
});

export const QuoteFormSchema = z.object({
  customerName: z.string().trim().max(120).nullable(),
  customerPhone: z.string().trim().max(30).nullable(),
  title: z.string().trim().max(200).nullable(),
  description: z.string().trim().max(MAX_DESCRIPTION).nullable(),
  items: z.array(ItemSchema).max(50),
  discountAmount: z.number().min(0).max(10_000_000),
  vatIncluded: z.boolean(),
  paymentTerms: z.string().trim().max(500).nullable(),
  validUntil: z.string().nullable(), // yyyy-mm-dd
  notes: z.array(z.string().trim().max(300)).max(20),
});
export type QuoteForm = z.infer<typeof QuoteFormSchema>;
