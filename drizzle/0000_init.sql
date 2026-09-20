CREATE TYPE "public"."inbound_type" AS ENUM('text', 'audio', 'image', 'document', 'other');--> statement-breakpoint
CREATE TYPE "public"."onboarding_state" AS ENUM('name', 'vat', 'logo', 'done');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('trial', 'basic', 'pro', 'unlimited');--> statement-breakpoint
CREATE TYPE "public"."quote_event_type" AS ENUM('created', 'edited', 'sent', 'viewed', 'approved', 'rejected', 'question', 'pdf', 'expired');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'sent', 'viewed', 'approved', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."vat_status" AS ENUM('exempt', 'registered');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text,
	"is_secret" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "inbound_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"user_phone" text NOT NULL,
	"type" "inbound_type" NOT NULL,
	"text" text,
	"media_url" text,
	"raw" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbound_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_phone" text NOT NULL,
	"type" text NOT NULL,
	"body" text,
	"doc_url" text,
	"ibot_response" jsonb,
	"ok" boolean DEFAULT false NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processing_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inbound_message_id" text,
	"quote_id" uuid,
	"kind" text NOT NULL,
	"transcription_provider" text,
	"transcription_model" text,
	"transcription_ms" integer,
	"transcript" text,
	"llm_provider" text,
	"llm_model" text,
	"llm_ms" integer,
	"llm_input_tokens" integer,
	"llm_output_tokens" integer,
	"raw_llm_output" jsonb,
	"cost_estimate" numeric(10, 4),
	"total_ms" integer,
	"error" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"type" "quote_event_type" NOT NULL,
	"payload" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) DEFAULT 1 NOT NULL,
	"unit" text DEFAULT 'יח׳' NOT NULL,
	"unit_price" numeric(12, 2) DEFAULT 0 NOT NULL,
	"line_total" numeric(12, 2) DEFAULT 0 NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"status" "quote_status" DEFAULT 'draft' NOT NULL,
	"customer_name" text,
	"customer_phone" text,
	"title" text,
	"vat_included" boolean DEFAULT false NOT NULL,
	"vat_rate" numeric(4, 2) DEFAULT 0.18 NOT NULL,
	"discount_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"payment_terms" text,
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"valid_until" timestamp with time zone,
	"subtotal" numeric(12, 2) DEFAULT 0 NOT NULL,
	"vat_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"total" numeric(12, 2) DEFAULT 0 NOT NULL,
	"transcript" text,
	"audio_url" text,
	"approved_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"first_viewed_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	CONSTRAINT "quotes_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"display_name" text,
	"business_name" text,
	"logo_url" text,
	"business_phone" text,
	"address" text,
	"tax_id" text,
	"vat_status" "vat_status" DEFAULT 'registered' NOT NULL,
	"default_payment_terms" text,
	"default_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"default_valid_days" integer DEFAULT 14 NOT NULL,
	"next_quote_number" integer DEFAULT 1001 NOT NULL,
	"plan" "plan" DEFAULT 'trial' NOT NULL,
	"plan_expires_at" timestamp with time zone,
	"onboarding_state" "onboarding_state" DEFAULT 'name' NOT NULL,
	"blocked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "processing_runs" ADD CONSTRAINT "processing_runs_inbound_message_id_inbound_messages_id_fk" FOREIGN KEY ("inbound_message_id") REFERENCES "public"."inbound_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_runs" ADD CONSTRAINT "processing_runs_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_events" ADD CONSTRAINT "quote_events_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inbound_user_at_idx" ON "inbound_messages" USING btree ("user_phone","at");--> statement-breakpoint
CREATE INDEX "outbound_user_at_idx" ON "outbound_messages" USING btree ("user_phone","at");--> statement-breakpoint
CREATE INDEX "processing_runs_quote_idx" ON "processing_runs" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "quote_events_quote_idx" ON "quote_events" USING btree ("quote_id","at");--> statement-breakpoint
CREATE INDEX "quote_items_quote_idx" ON "quote_items" USING btree ("quote_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_user_number_idx" ON "quotes" USING btree ("user_id","number");--> statement-breakpoint
CREATE INDEX "quotes_user_created_idx" ON "quotes" USING btree ("user_id","created_at");