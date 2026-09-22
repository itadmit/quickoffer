CREATE TYPE "public"."checkout_status" AS ENUM('pending', 'completed', 'failed', 'expired');--> statement-breakpoint
CREATE TABLE "billing_checkouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan" "plan" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"hub_customer_id" text NOT NULL,
	"hub_session_id" text NOT NULL,
	"status" "checkout_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "billing_checkouts_hub_session_id_unique" UNIQUE("hub_session_id")
);
--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"user_id" uuid,
	"payload" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "billing_customer_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "billing_subscription_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "billing_email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "billing_past_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_checkouts" ADD CONSTRAINT "billing_checkouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_checkouts_user_idx" ON "billing_checkouts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "billing_events_user_at_idx" ON "billing_events" USING btree ("user_id","at");