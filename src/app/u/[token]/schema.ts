// Zod schemas live outside the "use server" module: such modules may only export async functions.
import { z } from "zod";
import { PLANS } from "@/lib/quotes/template-spec";

export const CheckoutSchema = z.object({
  plan: z.enum(PLANS).refine((p) => p !== "trial", { message: "not a paid plan" }),
  email: z.string().trim().toLowerCase().email().max(200),
  /** Optional on the invoice, but a business that has one wants it there. */
  vatNumber: z.string().trim().max(20).nullable(),
  /** Grow requires the card-storage consent to be explicit and recorded. */
  accept: z.literal(true),
});
export type CheckoutForm = z.infer<typeof CheckoutSchema>;
