CREATE TABLE "plan_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"everyday_budget" numeric(12, 2),
	"currency" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_settings" ADD CONSTRAINT "plan_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;