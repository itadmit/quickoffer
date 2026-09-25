ALTER TABLE "users" ADD COLUMN "activation_nudges" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "activation_nudge_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "users_activation_idx" ON "users" USING btree ("last_active_at") WHERE "users"."onboarding_state" = 'done' and "users"."blocked" = false and "users"."activation_nudges" < 2;