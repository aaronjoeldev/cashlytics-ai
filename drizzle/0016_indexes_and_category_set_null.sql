ALTER TABLE "daily_expenses" DROP CONSTRAINT "daily_expenses_category_id_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_category_id_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "daily_expenses" ADD CONSTRAINT "daily_expenses_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "categories_user_id_idx" ON "categories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conversations_user_id_idx" ON "conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "daily_expenses_user_id_date_idx" ON "daily_expenses" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "daily_expenses_account_id_idx" ON "daily_expenses" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "daily_expenses_category_id_idx" ON "daily_expenses" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "documents_user_id_idx" ON "documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "documents_expense_id_idx" ON "documents" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "documents_daily_expense_id_idx" ON "documents" USING btree ("daily_expense_id");--> statement-breakpoint
CREATE INDEX "expenses_user_id_idx" ON "expenses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "expenses_account_id_idx" ON "expenses" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "expenses_category_id_idx" ON "expenses" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "import_conflicts_session_id_idx" ON "import_conflicts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "import_conflicts_import_row_id_idx" ON "import_conflicts" USING btree ("import_row_id");--> statement-breakpoint
CREATE INDEX "import_conflicts_existing_expense_id_idx" ON "import_conflicts" USING btree ("existing_expense_id");--> statement-breakpoint
CREATE INDEX "import_conflicts_existing_income_id_idx" ON "import_conflicts" USING btree ("existing_income_id");--> statement-breakpoint
CREATE INDEX "import_decisions_session_id_idx" ON "import_decisions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "import_rows_session_id_idx" ON "import_rows" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "import_sessions_user_id_idx" ON "import_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "import_sessions_account_id_idx" ON "import_sessions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "incomes_user_id_idx" ON "incomes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "incomes_account_id_idx" ON "incomes" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "insights_user_id_idx" ON "insights" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "merchant_categories_category_id_idx" ON "merchant_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_id_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transfers_user_id_idx" ON "transfers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transfers_source_account_id_idx" ON "transfers" USING btree ("source_account_id");--> statement-breakpoint
CREATE INDEX "transfers_target_account_id_idx" ON "transfers" USING btree ("target_account_id");--> statement-breakpoint
CREATE INDEX "users_email_lower_idx" ON "users" USING btree (lower("email"));