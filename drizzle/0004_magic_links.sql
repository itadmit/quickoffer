CREATE TABLE "magic_links" (
	"code" text PRIMARY KEY NOT NULL,
	"purpose" text NOT NULL,
	"subject" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "magic_links_subject_idx" ON "magic_links" USING btree ("purpose","subject");