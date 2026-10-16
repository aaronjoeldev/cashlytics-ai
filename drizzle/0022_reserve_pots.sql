CREATE TABLE "reserve_pots" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid,
	"balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" text NOT NULL,
	"balance_date" timestamp NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reserve_pots" ADD CONSTRAINT "reserve_pots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserve_pots" ADD CONSTRAINT "reserve_pots_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;