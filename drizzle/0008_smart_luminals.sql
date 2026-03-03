CREATE TYPE "public"."billing_event_outcome" AS ENUM('processed', 'duplicate', 'ignored', 'failed');--> statement-breakpoint
CREATE TYPE "public"."billing_plan_interval" AS ENUM('monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."usage_period_type" AS ENUM('daily', 'monthly');--> statement-breakpoint
CREATE TABLE "billing_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"stripe_created_at" timestamp NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"user_id" uuid,
	"outcome" "billing_event_outcome" DEFAULT 'processed' NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"billing_customer_id" uuid NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"stripe_price_id" text,
	"status" text DEFAULT 'incomplete' NOT NULL,
	"plan_interval" "billing_plan_interval",
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"trial_starts_at" timestamp,
	"trial_ends_at" timestamp,
	"canceled_at" timestamp,
	"last_stripe_event_created_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"billing_subscription_id" uuid,
	"plan_code" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'inactive' NOT NULL,
	"ai_enabled" boolean DEFAULT false NOT NULL,
	"ai_hard_cap_eur" numeric(12, 2) DEFAULT '2.00' NOT NULL,
	"ai_spend_to_date_eur" numeric(12, 6) DEFAULT '0' NOT NULL,
	"trial_started_at" timestamp,
	"trial_ends_at" timestamp,
	"ai_blocked_reason" text,
	"last_stripe_event_id" text,
	"last_stripe_event_created_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" uuid,
	"request_id" text,
	"model" text NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"input_cost_eur" numeric(12, 6) DEFAULT '0' NOT NULL,
	"output_cost_eur" numeric(12, 6) DEFAULT '0' NOT NULL,
	"total_cost_eur" numeric(12, 6) DEFAULT '0' NOT NULL,
	"pricing_version" text NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"period_type" "usage_period_type" NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"total_prompt_tokens" integer DEFAULT 0 NOT NULL,
	"total_completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"total_cost_eur" numeric(12, 6) DEFAULT '0' NOT NULL,
	"last_aggregated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_billing_customer_id_billing_customers_id_fk" FOREIGN KEY ("billing_customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_billing_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("billing_subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_periods" ADD CONSTRAINT "usage_periods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_customers_user_id_unique" ON "billing_customers" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_customers_stripe_customer_id_unique" ON "billing_customers" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_events_stripe_event_id_unique" ON "billing_events" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE INDEX "billing_events_user_id_idx" ON "billing_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "billing_events_stripe_customer_id_idx" ON "billing_events" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "billing_events_stripe_subscription_id_idx" ON "billing_events" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_subscriptions_user_id_unique" ON "billing_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_subscriptions_stripe_subscription_id_unique" ON "billing_subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "billing_subscriptions_billing_customer_id_idx" ON "billing_subscriptions" USING btree ("billing_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entitlements_user_id_unique" ON "entitlements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "entitlements_trial_ends_at_idx" ON "entitlements" USING btree ("trial_ends_at");--> statement-breakpoint
CREATE INDEX "usage_events_user_id_idx" ON "usage_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "usage_events_user_created_idx" ON "usage_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "usage_events_conversation_idx" ON "usage_events" USING btree ("conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_events_user_request_unique" ON "usage_events" USING btree ("user_id","request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_periods_user_period_unique" ON "usage_periods" USING btree ("user_id","period_type","period_start");--> statement-breakpoint
CREATE INDEX "usage_periods_user_id_idx" ON "usage_periods" USING btree ("user_id");