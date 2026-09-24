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
  /** past tense - "שלחתי". The professional is telling us it already happened. */
  "mark_sent",
  /**
   * Imperative - "שלח למריה". Asking us to send it now, which is the opposite
   * of mark_sent and used to collapse into it: a request to send was answered
   * with "סומנה כנשלחה" and nothing reached anyone.
   */
  "send_to",
  /**
   * Bare "תקן", with nothing said about what to change. The bot's own
   * disambiguation prompt asks for exactly this word, so failing to understand
   * it looped the conversation forever.
   */
  "correct",
  "pdf",
  "cancel",
  "new",
  "settings",
  "help",
  "edit",
  /**
   * The *look* of the quote (layout, colour) - `quote_templates` in the DB.
   * Called `design` and not `template` on purpose: to the professional
   * "תבנית" now means a saved job (§6.8), so a command named `template`
   * sitting next to Hebrew "תבנית" strings would invite exactly the wrong fix.
   */
  "design",
  /** §6.8 layer 1 - repeat a previous quote ("כמו ההצעה של דני") */
  "repeat",
  /** §6.8 layer 2 */
  "jobs",
  "job_save",
  "job_use",
] as const;
export type Command = (typeof COMMANDS)[number];

export const IntentSchema = z.object({
  intent: z.enum(["greeting", "correction", "new_quote", "command", "question", "unclear"]),
  command: z.enum(COMMANDS).nullable(),
  /** for command=design: the design the user named ("מודרני"), null = show the list */
  designName: z.string().nullable(),
  /**
   * §6.8. For `repeat`: the quote being pointed at ("דני כהן" / "1042").
   * For `job_use` / `job_save`: the job name ("התקנת מזגן").
   */
  reference: z.string().nullable(),
  /** §6.8. Customer named in the same breath ("התקנת מזגן **לדני כהן**"). */
  customerName: z.string().nullable(),
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
  /**
   * Descriptions of work this professional has already priced, most-used
   * first (lib/quotes/price-book.ts). Used to keep phrasing stable across
   * quotes; the prices themselves are filled in code, not by the model.
   */
  catalog: string[];
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
    ctx: {
      hasActiveDraft: boolean;
      draftCustomer: string | null;
      designNames: string[];
      jobNames: string[];
    },
  ): Promise<WithUsage<Intent>>;
  parseOnboardingAnswer(
    text: string,
    step: "name" | "vat" | "logo",
    suggestedName: string | null,
  ): Promise<WithUsage<OnboardingAnswer>>;
}
