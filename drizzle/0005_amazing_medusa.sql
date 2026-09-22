ALTER TYPE "public"."quote_event_type" ADD VALUE 'reminded';--> statement-breakpoint
CREATE TABLE "price_book" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"description" text NOT NULL,
	"unit" text DEFAULT 'יח׳' NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"times_used" integer DEFAULT 1 NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "last_reminder_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "reminders_sent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "price_book" ADD CONSTRAINT "price_book_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "price_book_user_key_idx" ON "price_book" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "price_book_user_rank_idx" ON "price_book" USING btree ("user_id","times_used","last_used_at");