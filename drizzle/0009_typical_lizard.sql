CREATE TABLE "exchange_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"base_currency" text NOT NULL,
	"target_currency" text NOT NULL,
	"rate" numeric(10, 6) NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "exchange_rates_base_currency_target_currency_unique" UNIQUE("base_currency","target_currency")
);
--> statement-breakpoint
ALTER TABLE "daily_expenses" ADD COLUMN "currency" text DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_expenses" ADD COLUMN "original_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "daily_expenses" ADD COLUMN "exchange_rate" numeric(10, 6);--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "currency" text DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "original_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "exchange_rate" numeric(10, 6);--> statement-breakpoint
ALTER TABLE "incomes" ADD COLUMN "currency" text DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
ALTER TABLE "incomes" ADD COLUMN "original_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "incomes" ADD COLUMN "exchange_rate" numeric(10, 6);--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "source_currency" text DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "target_currency" text DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "target_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "exchange_rate" numeric(10, 6);