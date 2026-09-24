CREATE INDEX "inbound_unprocessed_idx" ON "inbound_messages" USING btree ("at") WHERE "inbound_messages"."processed_at" is null;--> statement-breakpoint
CREATE INDEX "inbound_at_idx" ON "inbound_messages" USING btree ("at");--> statement-breakpoint
CREATE INDEX "magic_links_expires_idx" ON "magic_links" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "outbound_at_idx" ON "outbound_messages" USING btree ("at");--> statement-breakpoint
CREATE INDEX "processing_runs_at_idx" ON "processing_runs" USING btree ("at");--> statement-breakpoint
CREATE INDEX "quotes_open_valid_until_idx" ON "quotes" USING btree ("valid_until") WHERE "quotes"."status" in ('draft', 'sent', 'viewed');--> statement-breakpoint
CREATE INDEX "quotes_followup_idx" ON "quotes" USING btree ("last_reminder_at","created_at") WHERE "quotes"."status" in ('sent', 'viewed') and "quotes"."reminders_sent" < 2;