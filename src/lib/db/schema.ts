import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// PRODUCT.md §9 - data model. Money is numeric(12,2) read as JS numbers.
const money = (name: string) =>
  numeric(name, { precision: 12, scale: 2, mode: "number" });

export const channelEnum = pgEnum("channel", ["whatsapp", "telegram"]);
export const vatStatusEnum = pgEnum("vat_status", ["exempt", "registered"]);
export const onboardingStateEnum = pgEnum("onboarding_state", [
  "name",
  "vat",
  "logo",
  "done",
]);
export const quoteStatusEnum = pgEnum("quote_status", [
  "draft",
  "sent",
  "viewed",
  "approved",
  "rejected",
  "expired",
]);
export const quoteEventTypeEnum = pgEnum("quote_event_type", [
  "created",
  "edited",
  "sent",
  "viewed",
  "approved",
  "rejected",
  "question",
  "pdf",
  "expired",
]);
export const inboundTypeEnum = pgEnum("inbound_type", [
  "text",
  "audio",
  "image",
  "document",
  "other",
]);

export const quoteLayoutEnum = pgEnum("quote_layout", ["classic", "modern", "minimal"]);
export const planEnum = pgEnum("plan", ["trial", "basic", "pro", "unlimited"]);

// Customer-facing quote designs. Rows are managed in /admin/templates; the
// layout is a React component (components/quote-layouts), the rest is styling.
export const quoteTemplates = pgTable("quote_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  layout: quoteLayoutEnum("layout").notNull().default("classic"),
  accent: text("accent").notNull().default("#0f766e"),
  footerText: text("footer_text"),
  enabled: boolean("enabled").notNull().default(true),
  // lowest plan that may pick this template (trial = everyone)
  minPlan: planEnum("min_plan").notNull().default("trial"),
  isDefault: boolean("is_default").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Logical PK / messaging address. WhatsApp: digits from the jid (972501234567).
  // Telegram: "tg:<chatId>". Everything that sends to a user passes this string to sendText().
  phone: text("phone").notNull().unique(),
  channel: channelEnum("channel").notNull().default("whatsapp"),
  displayName: text("display_name"),
  businessName: text("business_name"),
  logoUrl: text("logo_url"),
  businessPhone: text("business_phone"),
  address: text("address"),
  taxId: text("tax_id"),
  vatStatus: vatStatusEnum("vat_status").notNull().default("registered"),
  defaultPaymentTerms: text("default_payment_terms"),
  defaultNotes: jsonb("default_notes").$type<string[]>().notNull().default([]),
  defaultValidDays: integer("default_valid_days").notNull().default(14),
  nextQuoteNumber: integer("next_quote_number").notNull().default(1001),
  plan: planEnum("plan").notNull().default("trial"),
  planExpiresAt: timestamp("plan_expires_at", { withTimezone: true }),
  onboardingState: onboardingStateEnum("onboarding_state")
    .notNull()
    .default("name"),
  blocked: boolean("blocked").notNull().default(false),
  // null = the default template
  templateId: uuid("template_id").references(() => quoteTemplates.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publicId: text("public_id").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    status: quoteStatusEnum("status").notNull().default("draft"),
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    title: text("title"),
    vatIncluded: boolean("vat_included").notNull().default(false),
    vatRate: numeric("vat_rate", { precision: 4, scale: 2, mode: "number" })
      .notNull()
      .default(0.18),
    discountAmount: money("discount_amount").notNull().default(0),
    paymentTerms: text("payment_terms"),
    notes: jsonb("notes").$type<string[]>().notNull().default([]),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    subtotal: money("subtotal").notNull().default(0),
    vatAmount: money("vat_amount").notNull().default(0),
    total: money("total").notNull().default(0),
    transcript: text("transcript"),
    audioUrl: text("audio_url"),
    approvedSnapshot: jsonb("approved_snapshot"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    firstViewedAt: timestamp("first_viewed_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("quotes_user_number_idx").on(t.userId, t.number),
    index("quotes_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export const quoteItems = pgTable(
  "quote_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 2, mode: "number" })
      .notNull()
      .default(1),
    unit: text("unit").notNull().default("יח׳"),
    unitPrice: money("unit_price").notNull().default(0),
    lineTotal: money("line_total").notNull().default(0),
    needsReview: boolean("needs_review").notNull().default(false),
  },
  (t) => [index("quote_items_quote_idx").on(t.quoteId, t.position)],
);

export const quoteEvents = pgTable(
  "quote_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    type: quoteEventTypeEnum("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("quote_events_quote_idx").on(t.quoteId, t.at)],
);

export const inboundMessages = pgTable(
  "inbound_messages",
  {
    // iBot msgId - dedup key
    id: text("id").primaryKey(),
    userPhone: text("user_phone").notNull(),
    type: inboundTypeEnum("type").notNull(),
    text: text("text"),
    mediaUrl: text("media_url"),
    raw: jsonb("raw"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
  },
  (t) => [index("inbound_user_at_idx").on(t.userPhone, t.at)],
);

export const outboundMessages = pgTable(
  "outbound_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userPhone: text("user_phone").notNull(),
    type: text("type").notNull(), // text | doc | image
    body: text("body"),
    docUrl: text("doc_url"),
    ibotResponse: jsonb("ibot_response"),
    ok: boolean("ok").notNull().default(false),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("outbound_user_at_idx").on(t.userPhone, t.at)],
);

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  // Secrets are stored encrypted with prefix "enc:" (AES-256-GCM)
  value: text("value"),
  isSecret: boolean("is_secret").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedBy: text("updated_by"),
});

export const processingRuns = pgTable(
  "processing_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inboundMessageId: text("inbound_message_id").references(
      () => inboundMessages.id,
      { onDelete: "set null" },
    ),
    quoteId: uuid("quote_id").references(() => quotes.id, {
      onDelete: "set null",
    }),
    kind: text("kind").notNull(), // new_quote | correction | classify | onboarding
    transcriptionProvider: text("transcription_provider"),
    transcriptionModel: text("transcription_model"),
    transcriptionMs: integer("transcription_ms"),
    transcript: text("transcript"),
    llmProvider: text("llm_provider"),
    llmModel: text("llm_model"),
    llmMs: integer("llm_ms"),
    llmInputTokens: integer("llm_input_tokens"),
    llmOutputTokens: integer("llm_output_tokens"),
    rawLlmOutput: jsonb("raw_llm_output"),
    costEstimate: numeric("cost_estimate", {
      precision: 10,
      scale: 4,
      mode: "number",
    }),
    totalMs: integer("total_ms"),
    error: text("error"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("processing_runs_quote_idx").on(t.quoteId)],
);

/** Short codes behind /e/{code} and /s/{code}. 6 chars, no look-alikes, expiring. */
export const magicLinks = pgTable(
  "magic_links",
  {
    code: text("code").primaryKey(),
    purpose: text("purpose").notNull(), // e = edit quote, s = settings
    subject: text("subject").notNull(), // quote id / user id
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [index("magic_links_subject_idx").on(t.purpose, t.subject)],
);

export type User = typeof users.$inferSelect;
export type QuoteTemplate = typeof quoteTemplates.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type QuoteItem = typeof quoteItems.$inferSelect;
export type QuoteEvent = typeof quoteEvents.$inferSelect;
export type InboundMessage = typeof inboundMessages.$inferSelect;
export type ProcessingRun = typeof processingRuns.$inferSelect;
