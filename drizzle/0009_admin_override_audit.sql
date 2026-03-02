CREATE TYPE "public"."admin_override_action" AS ENUM('extend_trial_end', 'adjust_ai_cap', 'set_ai_enabled', 'override_plan_status');--> statement-breakpoint
CREATE TABLE "admin_override_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"actor" text NOT NULL,
	"reason" text NOT NULL,
	"action_type" "admin_override_action" NOT NULL,
	"before_snapshot" jsonb NOT NULL,
	"after_snapshot" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_override_audit" ADD CONSTRAINT "admin_override_audit_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_override_audit_user_created_idx" ON "admin_override_audit" USING btree ("user_id","created_at");
