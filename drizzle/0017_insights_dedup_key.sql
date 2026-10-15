ALTER TABLE "insights" ADD COLUMN "dedup_key" text;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_user_id_dedup_key_unique" UNIQUE("user_id","dedup_key");--> statement-breakpoint
-- Earlier runs added a copy on every run. Unread generated insights are recreated with a key on
-- the next run, so the copies can go.
DELETE FROM "insights" WHERE "dedup_key" IS NULL AND "is_read" = false AND "type" IN ('spending_anomaly', 'budget_warning');
