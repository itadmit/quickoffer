import { z } from "zod";

/** PRODUCT.md §7.2 - allowed units. Default is יח׳. */
export const UNITS = ["יח׳", "מ״ר", "מ״א", "שעה", "יום", "קומפלט", "נקודה"] as const;

export const QuoteItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unit: z.enum(UNITS),
  /** 0 when the price was not said. Never guessed. */
  unitPrice: z.number(),
  priceConfidence: z.enum(["high", "low", "missing"]),
});

export const QuoteJSONSchema = z.object({
  customerName: z.string().nullable(),
  customerPhone: z.string().nullable(),
  title: z.string().nullable(),
  items: z.array(QuoteItemSchema),
  discount: z.number().nullable(),
  /** null = not said → use the business default */
  vatIncluded: z.boolean().nullable(),
  paymentTerms: z.string().nullable(),
  validDays: z.number().nullable(),
  notes: z.array(z.string()),
  /** item descriptions (or field names) the professional should check */
  needsReview: z.array(z.string()),
});
export type QuoteJSON = z.infer<typeof QuoteJSONSchema>;
export type QuoteItemJSON = z.infer<typeof QuoteItemSchema>;

export const CorrectionResultSchema = z.object({
  quote: QuoteJSONSchema,
  /** Human-readable Hebrew lines for the chat summary, e.g. "ביקור - 250 ₪ (היה 200)" */
  changes: z.array(z.string()),
});
export type CorrectionResult = z.infer<typeof CorrectionResultSchema>;

export const COMMANDS = [
  "list",
  "mark_sent",
  "pdf",
  "cancel",
  "new",
  "settings",
  "help",
  "edit",
] as const;
export type Command = (typeof COMMANDS)[number];

export const IntentSchema = z.object({
  intent: z.enum(["greeting", "correction", "new_quote", "command", "question", "unclear"]),
  command: z.enum(COMMANDS).nullable(),
});
export type Intent = z.infer<typeof IntentSchema>;

export const OnboardingAnswerSchema = z.object({
  /** for the name step */
  acceptsSuggestedName: z.boolean().nullable(),
  businessName: z.string().nullable(),
  /** for the vat step */
  vatStatus: z.enum(["exempt", "registered"]).nullable(),
  /** for the logo step */
  skipLogo: z.boolean().nullable(),
  /** the message is actually a quote, not an answer */
  looksLikeQuote: z.boolean(),
});
export type OnboardingAnswer = z.infer<typeof OnboardingAnswerSchema>;

export type BusinessProfile = {
  businessName: string | null;
  vatStatus: "exempt" | "registered";
  defaultPaymentTerms: string | null;
  defaultValidDays: number;
  defaultNotes: string[];
};

export type Usage = {
  provider: string;
  model: string;
  ms: number;
  inputTokens?: number;
  outputTokens?: number;
  /** ILS, rough */
  cost: number;
  raw?: unknown;
};

export type TranscribeResult = { text: string; usage: Usage };
export type WithUsage<T> = { result: T; usage: Usage };

export interface TranscriptionProvider {
  transcribe(
    audio: Buffer,
    opts: { language: "he"; hints: string[]; fileName?: string; mimetype?: string },
  ): Promise<TranscribeResult>;
}

export interface LLMProvider {
  structureQuote(
    transcript: string,
    profile: BusinessProfile,
  ): Promise<WithUsage<QuoteJSON>>;
  applyCorrection(
    quote: QuoteJSON,
    instruction: string,
    profile: BusinessProfile,
  ): Promise<WithUsage<CorrectionResult>>;
  classifyMessage(
    text: string,
    ctx: { hasActiveDraft: boolean; draftCustomer: string | null },
  ): Promise<WithUsage<Intent>>;
  parseOnboardingAnswer(
    text: string,
    step: "name" | "vat" | "logo",
    suggestedName: string | null,
  ): Promise<WithUsage<OnboardingAnswer>>;
}
