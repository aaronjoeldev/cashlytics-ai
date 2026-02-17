CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_id" uuid,
	"daily_expense_id" uuid,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_expenses" ADD COLUMN "info" text;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "is_subscription" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "info" text;--> statement-breakpoint
ALTER TABLE "incomes" ADD COLUMN "info" text;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_daily_expense_id_daily_expenses_id_fk" FOREIGN KEY ("daily_expense_id") REFERENCES "public"."daily_expenses"("id") ON DELETE cascade ON UPDATE no action;