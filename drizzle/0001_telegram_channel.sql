CREATE TYPE "public"."channel" AS ENUM('whatsapp', 'telegram');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "channel" "channel" DEFAULT 'whatsapp' NOT NULL;