CREATE TYPE "public"."quote_layout" AS ENUM('classic', 'modern', 'minimal');--> statement-breakpoint
CREATE TABLE "quote_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"layout" "quote_layout" DEFAULT 'classic' NOT NULL,
	"accent" text DEFAULT '#0f766e' NOT NULL,
	"footer_text" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_templates_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "template_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_template_id_quote_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."quote_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "quote_templates" ("key", "name", "description", "layout", "accent", "footer_text", "enabled", "is_default", "sort_order") VALUES
	('classic', 'קלאסי', 'טבלה מסודרת עם כותרת עסק - מתאים לכל תחום', 'classic', '#0f766e', NULL, true, true, 0),
	('modern', 'מודרני', 'פס צבע בראש, פריטים ככרטיסים, סה"כ בולט', 'modern', '#0f766e', NULL, true, false, 1),
	('minimal', 'מינימלי', 'נקי וטיפוגרפי, בלי מסגרות - נראה כמו מסמך מודפס', 'minimal', '#0f172a', NULL, true, false, 2);
