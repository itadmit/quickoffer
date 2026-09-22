CREATE TABLE "saved_job_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) DEFAULT 1 NOT NULL,
	"unit" text DEFAULT 'יח׳' NOT NULL,
	"unit_price" numeric(12, 2) DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"times_used" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_job_items" ADD CONSTRAINT "saved_job_items_job_id_saved_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."saved_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_job_items_job_idx" ON "saved_job_items" USING btree ("job_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_jobs_user_key_idx" ON "saved_jobs" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "saved_jobs_user_rank_idx" ON "saved_jobs" USING btree ("user_id","times_used","last_used_at");