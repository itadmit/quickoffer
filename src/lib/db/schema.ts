import { sql } from "drizzle-orm";
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
  // the bot nudged the professional that this quote went quiet
  "reminded",
]);
/** A quote nobody can act on any more. */
export const CLOSED_QUOTE_STATUSES = ["approved", "rejected", "expired"] as const;
/**
 * A quote still in play - what the cron expires and nudges.
 *
 * Derived rather than written out, and asserted in tests, because the partial
 * predicate of `quotes_open_valid_until_idx` spells the same set literally: a
 * new status added to the enum has to reach the index too, or the tick goes
 * back to scanning every quote ever written.
 */
export const OPEN_QUOTE_STATUSES = quoteStatusEnum.enumValues.filter(
  (s): s is Exclude<(typeof quoteStatusEnum.enumValues)[number], (typeof CLOSED_QUOTE_STATUSES)[number]> =>
    !(CLOSED_QUOTE_STATUSES as readonly string[]).includes(s),
);

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
  // Billing Hub (quick-billing). The hub owns the money; we only mirror
  // enough to know which plan is in force and who to talk to about it.
  billingCustomerId: text("billing_customer_id"),
  billingSubscriptionId: text("billing_subscription_id"),
  /** Required by the hub and by an Israeli invoice; collected at checkout. */
  billingEmail: text("billing_email"),
  /** Set when a charge fails, cleared when it recovers - drives the chat nudge. */
  billingPastDueAt: timestamp("billing_past_due_at", { withTimezone: true }),
  onboardingState: onboardingStateEnum("onboarding_state")
    .notNull()
    .default("name"),
  blocked: boolean("blocked").notNull().default(false),
  // null = the default template
  templateId: uuid("template_id").references(() => quoteTemplates.id, {
    onDelete: "set null",
  }),
  // Activation nudges (lib/conversation/activation.ts): finished setup, never
  // wrote a quote. Bounded by the counter so a user who is simply not
  // interested is asked twice and then left alone.
  activationNudges: integer("activation_nudges").notNull().default(0),
  activationNudgeAt: timestamp("activation_nudge_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  // The cron's activation sweep, every five minutes forever. Partial, because
  // the users it can ever touch are the ones who finished setup and still owe
  // the counter a nudge - a set that empties itself as people either start
  // quoting or get their two messages.
  index("users_activation_idx")
    .on(t.lastActiveAt)
    .where(sql`${t.onboardingState} = 'done' and ${t.blocked} = false and ${t.activationNudges} < 2`),
  // Its sibling for people who stopped mid-setup: one nudge, so `= 0`.
  index("users_onboarding_nudge_idx")
    .on(t.lastActiveAt)
    .where(sql`${t.onboardingState} <> 'done' and ${t.blocked} = false and ${t.activationNudges} = 0`),
]);

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
    // Follow-up nudges (§6.6). Bounded by remindersSent so we never nag.
    lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),
    remindersSent: integer("reminders_sent").notNull().default(0),
  },
  (t) => [
    uniqueIndex("quotes_user_number_idx").on(t.userId, t.number),
    index("quotes_user_created_idx").on(t.userId, t.createdAt),
    // The admin's "today / this month" counters, which have no user to filter
    // by and so cannot use the index above.
    index("quotes_created_idx").on(t.createdAt),
    // The cron tick expires and nudges every five minutes, forever. Both
    // queries only ever look at quotes that are still open, which is the
    // shrinking minority once the table has some history - so both indexes are
    // partial, and neither grows with the archive.
    index("quotes_open_valid_until_idx")
      .on(t.validUntil)
      .where(sql`${t.status} in ('draft', 'sent', 'viewed')`),
    index("quotes_followup_idx")
      .on(t.lastReminderAt, t.createdAt)
      .where(sql`${t.status} in ('sent', 'viewed') and ${t.remindersSent} < 2`),
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
  (t) => [
    index("inbound_user_at_idx").on(t.userPhone, t.at),
    // The cron's "stuck messages" query. Partial, so it holds only the handful
    // of rows that are actually in flight rather than every message ever.
    index("inbound_unprocessed_idx").on(t.at).where(sql`${t.processedAt} is null`),
    // Retention sweep.
    index("inbound_at_idx").on(t.at),
  ],
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
  (t) => [
    index("outbound_user_at_idx").on(t.userPhone, t.at),
    // Retention sweep and the admin's "last 10 sent".
    index("outbound_at_idx").on(t.at),
  ],
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
  (t) => [
    index("processing_runs_quote_idx").on(t.quoteId),
    // Every admin counter is "since <date>", and the retention sweep is too.
    index("processing_runs_at_idx").on(t.at),
  ],
);

/**
 * The professional's own price list, learned passively from the quotes they
 * confirm. Never shown to customers; used to fill in a price the voice note
 * left out, so "מחיר חסר" becomes "180 ₪ (כמו תמיד)".
 *
 * `key` is the normalized description (lib/quotes/price-book.ts) - the match
 * unit. `description` keeps the last human phrasing for display.
 */
export const priceBook = pgTable(
  "price_book",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    description: text("description").notNull(),
    unit: text("unit").notNull().default("יח׳"),
    unitPrice: money("unit_price").notNull(),
    timesUsed: integer("times_used").notNull().default(1),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("price_book_user_key_idx").on(t.userId, t.key),
    index("price_book_user_rank_idx").on(t.userId, t.timesUsed, t.lastUsedAt),
  ],
);

export const checkoutStatusEnum = pgEnum("checkout_status", [
  "pending",
  "completed",
  "failed",
  "expired",
]);

/**
 * One attempt to start paying. Created before we send the professional to the
 * hosted card page, completed by the hub's `payment_method.created` webhook.
 *
 * It exists because the webhook tells us a card was stored, not which plan the
 * professional picked - `hub_session_id` is the thread back to that intent.
 */
export const billingCheckouts = pgTable(
  "billing_checkouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    plan: planEnum("plan").notNull(),
    /** Price we quoted, in ILS before VAT - what the hosted page charges. */
    amount: money("amount").notNull(),
    hubCustomerId: text("hub_customer_id").notNull(),
    hubSessionId: text("hub_session_id").notNull().unique(),
    status: checkoutStatusEnum("status").notNull().default("pending"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("billing_checkouts_user_idx").on(t.userId, t.createdAt)],
);

/**
 * Every webhook the hub delivered, keyed by its delivery id.
 *
 * The hub retries up to five times with backoff, so the same event will arrive
 * again after any failure on our side - this is what keeps a retry from
 * charging a plan change twice.
 */
export const billingEvents = pgTable(
  "billing_events",
  {
    /** X-Quickcommerce-Delivery-Id */
    id: text("id").primaryKey(),
    eventType: text("event_type").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    payload: jsonb("payload"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    error: text("error"),
  },
  (t) => [index("billing_events_user_at_idx").on(t.userId, t.at)],
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
  (t) => [
    index("magic_links_subject_idx").on(t.purpose, t.subject),
    // purgeExpiredLinks, every five minutes.
    index("magic_links_expires_idx").on(t.expiresAt),
  ],
);

/**
 * A repeat job saved by name (PRODUCT.md §6.8) - the skeleton of a quote
 * without a customer. Born from a real quote via "תשמור את זה כ…", never
 * authored from scratch in a form.
 *
 * Distinct from `quote_templates`, which are *design* templates (layout,
 * colour). Nothing here affects how a quote looks.
 */
export const savedJobs = pgTable(
  "saved_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** normalized name, for matching what the professional says (price-book.ts priceKey) */
    key: text("key").notNull(),
    timesUsed: integer("times_used").notNull().default(0),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("saved_jobs_user_key_idx").on(t.userId, t.key),
    index("saved_jobs_user_rank_idx").on(t.userId, t.timesUsed, t.lastUsedAt),
  ],
);

export const savedJobItems = pgTable(
  "saved_job_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => savedJobs.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 2, mode: "number" })
      .notNull()
      .default(1),
    unit: text("unit").notNull().default("יח׳"),
    unitPrice: money("unit_price").notNull().default(0),
  },
  (t) => [index("saved_job_items_job_idx").on(t.jobId, t.position)],
);

/**
 * The professional's own customers, learned from the quotes they write.
 *
 * Same idea as price_book one table over: a detail said once should never have
 * to be said again. Telling the bot "הטלפון של מריה 054..." used to help
 * exactly one quote; now it makes the next quote for מריה sendable in one tap
 * without asking. Matching lives in lib/quotes/contacts.ts.
 */
export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Normalized form of the name - what two spellings of one customer collapse to. */
    key: text("key").notNull(),
    /** As last written by the professional, which is how they want to see it. */
    name: text("name").notNull(),
    phone: text("phone"),
    quoteCount: integer("quote_count").notNull().default(1),
    lastQuoteAt: timestamp("last_quote_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("contacts_user_key_idx").on(t.userId, t.key),
    index("contacts_user_recent_idx").on(t.userId, t.lastQuoteAt),
  ],
);

export type User = typeof users.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type SavedJob = typeof savedJobs.$inferSelect;
export type SavedJobItem = typeof savedJobItems.$inferSelect;
export type PriceBookEntry = typeof priceBook.$inferSelect;
export type BillingCheckout = typeof billingCheckouts.$inferSelect;
export type QuoteTemplate = typeof quoteTemplates.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type QuoteItem = typeof quoteItems.$inferSelect;
export type QuoteEvent = typeof quoteEvents.$inferSelect;
export type InboundMessage = typeof inboundMessages.$inferSelect;
export type ProcessingRun = typeof processingRuns.$inferSelect;
