import {
  pgTable,
  uuid,
  text,
  decimal,
  numeric,
  timestamp,
  integer,
  serial,
  pgEnum,
  boolean,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { defaultCurrency } from "@/lib/currency";
import { defaultLocale } from "@/i18n/config";

export const accountTypeEnum = pgEnum("account_type", ["checking", "savings", "etf"]);
export const recurrenceTypeEnum = pgEnum("recurrence_type", [
  "once",
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "semiannual",
  "yearly",
  "custom",
]);
export const incomeRecurrenceTypeEnum = pgEnum("income_recurrence_type", [
  "once",
  "monthly",
  "yearly",
]);
export const transferRecurrenceTypeEnum = pgEnum("transfer_recurrence_type", [
  "once",
  "monthly",
  "quarterly",
  "yearly",
]);
export const importSessionStatusEnum = pgEnum("import_session_status", [
  "draft",
  "review",
  "confirmed",
  "cancelled",
]);
export const importConflictSuggestionEnum = pgEnum("import_conflict_suggestion", [
  "keep_both",
  "replace_existing",
  "skip_import_row",
  "needs_user_review",
]);
export const importDecisionEnum = pgEnum("import_decision", [
  "keep_both",
  "replace_existing",
  "skip_import_row",
]);

// Auth.js user table - extended with Auth.js adapter fields
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  name: text("name"),
  password: text("password"),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Auth.js accounts table (OAuth provider linking)
// Prefixed with "auth_" to avoid conflict with financial accounts table
export const authAccounts = pgTable("auth_accounts", {
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

// Auth.js sessions table (for database session strategy - future-proofing)
export const authSessions = pgTable("auth_sessions", {
  sessionToken: text("session_token").notNull().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

// Auth.js verification tokens (for password reset / magic links)
export const authVerificationTokens = pgTable(
  "auth_verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })]
);

// Password reset tokens (custom flow, NOT Auth.js managed)
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User relations - enables querying user's data with Drizzle relational queries
export const usersRelations = relations(users, ({ one, many }) => ({
  accounts: many(accounts),
  categories: many(categories),
  expenses: many(expenses),
  incomes: many(incomes),
  dailyExpenses: many(dailyExpenses),
  transfers: many(transfers),
  documents: many(documents),
  conversations: many(conversations),
  pushSubscriptions: many(pushSubscriptions),
  importSessions: many(importSessions),
  importRows: many(importRows),
  importConflicts: many(importConflicts),
  importDecisions: many(importDecisions),
  settings: one(userSettings, {
    fields: [users.id],
    references: [userSettings.userId],
  }),
}));

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  type: accountTypeEnum("type").notNull(),
  balance: decimal("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  currency: text("currency").default("EUR").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  icon: text("icon"),
  color: text("color"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const expenses = pgTable("expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").references(() => categories.id),
  name: text("name").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  recurrenceType: recurrenceTypeEnum("recurrence_type").notNull(),
  recurrenceInterval: integer("recurrence_interval"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  isSubscription: boolean("is_subscription").default(false).notNull(),
  currency: text("currency").default("EUR").notNull(),
  originalAmount: numeric("original_amount", { precision: 12, scale: 2 }),
  exchangeRate: numeric("exchange_rate", { precision: 10, scale: 6 }),
  info: text("info"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const incomes = pgTable("incomes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  recurrenceType: incomeRecurrenceTypeEnum("recurrence_type").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  currency: text("currency").default("EUR").notNull(),
  originalAmount: numeric("original_amount", { precision: 12, scale: 2 }),
  exchangeRate: numeric("exchange_rate", { precision: 10, scale: 6 }),
  info: text("info"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dailyExpenses = pgTable("daily_expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").references(() => categories.id),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  date: timestamp("date").notNull(),
  currency: text("currency").default("EUR").notNull(),
  originalAmount: numeric("original_amount", { precision: 12, scale: 2 }),
  exchangeRate: numeric("exchange_rate", { precision: 10, scale: 6 }),
  info: text("info"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transfers = pgTable("transfers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  sourceAccountId: uuid("source_account_id")
    .references(() => accounts.id, { onDelete: "cascade" })
    .notNull(),
  targetAccountId: uuid("target_account_id")
    .references(() => accounts.id, { onDelete: "cascade" })
    .notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  recurrenceType: transferRecurrenceTypeEnum("recurrence_type").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  sourceCurrency: text("source_currency").default("EUR").notNull(),
  targetCurrency: text("target_currency").default("EUR").notNull(),
  targetAmount: numeric("target_amount", { precision: 12, scale: 2 }),
  exchangeRate: numeric("exchange_rate", { precision: 10, scale: 6 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  expenseId: uuid("expense_id").references(() => expenses.id, { onDelete: "cascade" }),
  dailyExpenseId: uuid("daily_expense_id").references(() => dailyExpenses.id, {
    onDelete: "cascade",
  }),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  data: text("data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const importSessions = pgTable("import_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  accountId: uuid("account_id")
    .references(() => accounts.id, { onDelete: "cascade" })
    .notNull(),
  status: importSessionStatusEnum("status").notNull().default("draft"),
  sourceFileName: text("source_file_name").notNull(),
  sourceFileHash: text("source_file_hash"),
  totalRows: integer("total_rows").notNull().default(0),
  stagedRows: integer("staged_rows").notNull().default(0),
  conflictRows: integer("conflict_rows").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const importRows = pgTable("import_rows", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  sessionId: uuid("session_id")
    .references(() => importSessions.id, { onDelete: "cascade" })
    .notNull(),
  rowIndex: integer("row_index").notNull(),
  bookingDate: timestamp("booking_date"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").default("EUR").notNull(),
  description: text("description").notNull(),
  counterparty: text("counterparty"),
  senderAccount: text("sender_account"),
  receiverAccount: text("receiver_account"),
  balanceAfterBooking: decimal("balance_after_booking", { precision: 12, scale: 2 }),
  normalizedPayload: text("normalized_payload").notNull(),
  validationErrors: text("validation_errors"),
  excludedByUser: boolean("excluded_by_user").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const importConflicts = pgTable("import_conflicts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  sessionId: uuid("session_id")
    .references(() => importSessions.id, { onDelete: "cascade" })
    .notNull(),
  importRowId: uuid("import_row_id")
    .references(() => importRows.id, { onDelete: "cascade" })
    .notNull(),
  existingExpenseId: uuid("existing_expense_id").references(() => dailyExpenses.id, {
    onDelete: "cascade",
  }),
  existingIncomeId: uuid("existing_income_id").references(() => incomes.id, {
    onDelete: "cascade",
  }),
  similarityScore: decimal("similarity_score", { precision: 5, scale: 4 }),
  confidence: decimal("confidence", { precision: 5, scale: 4 }),
  explanation: text("explanation"),
  suggestion: importConflictSuggestionEnum("suggestion").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const importDecisions = pgTable("import_decisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  sessionId: uuid("session_id")
    .references(() => importSessions.id, { onDelete: "cascade" })
    .notNull(),
  conflictId: uuid("conflict_id")
    .references(() => importConflicts.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  decision: importDecisionEnum("decision").notNull(),
  decidedAt: timestamp("decided_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
  expenses: many(expenses),
  incomes: many(incomes),
  dailyExpenses: many(dailyExpenses),
  outgoingTransfers: many(transfers, { relationName: "sourceAccount" }),
  incomingTransfers: many(transfers, { relationName: "targetAccount" }),
  importSessions: many(importSessions),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, {
    fields: [categories.userId],
    references: [users.id],
  }),
  expenses: many(expenses),
  dailyExpenses: many(dailyExpenses),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  user: one(users, {
    fields: [expenses.userId],
    references: [users.id],
  }),
  account: one(accounts, {
    fields: [expenses.accountId],
    references: [accounts.id],
  }),
  category: one(categories, {
    fields: [expenses.categoryId],
    references: [categories.id],
  }),
  documents: many(documents),
}));

export const incomesRelations = relations(incomes, ({ one }) => ({
  user: one(users, {
    fields: [incomes.userId],
    references: [users.id],
  }),
  account: one(accounts, {
    fields: [incomes.accountId],
    references: [accounts.id],
  }),
}));

export const dailyExpensesRelations = relations(dailyExpenses, ({ one, many }) => ({
  user: one(users, {
    fields: [dailyExpenses.userId],
    references: [users.id],
  }),
  account: one(accounts, {
    fields: [dailyExpenses.accountId],
    references: [accounts.id],
  }),
  category: one(categories, {
    fields: [dailyExpenses.categoryId],
    references: [categories.id],
  }),
  documents: many(documents),
}));

export const transfersRelations = relations(transfers, ({ one }) => ({
  user: one(users, {
    fields: [transfers.userId],
    references: [users.id],
  }),
  sourceAccount: one(accounts, {
    fields: [transfers.sourceAccountId],
    references: [accounts.id],
    relationName: "sourceAccount",
  }),
  targetAccount: one(accounts, {
    fields: [transfers.targetAccountId],
    references: [accounts.id],
    relationName: "targetAccount",
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
  expense: one(expenses, {
    fields: [documents.expenseId],
    references: [expenses.id],
  }),
  dailyExpense: one(dailyExpenses, {
    fields: [documents.dailyExpenseId],
    references: [dailyExpenses.id],
  }),
}));

export const importSessionsRelations = relations(importSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [importSessions.userId],
    references: [users.id],
  }),
  account: one(accounts, {
    fields: [importSessions.accountId],
    references: [accounts.id],
  }),
  rows: many(importRows),
  conflicts: many(importConflicts),
  decisions: many(importDecisions),
}));

export const importRowsRelations = relations(importRows, ({ one, many }) => ({
  user: one(users, {
    fields: [importRows.userId],
    references: [users.id],
  }),
  session: one(importSessions, {
    fields: [importRows.sessionId],
    references: [importSessions.id],
  }),
  conflicts: many(importConflicts),
}));

export const importConflictsRelations = relations(importConflicts, ({ one }) => ({
  user: one(users, {
    fields: [importConflicts.userId],
    references: [users.id],
  }),
  session: one(importSessions, {
    fields: [importConflicts.sessionId],
    references: [importSessions.id],
  }),
  importRow: one(importRows, {
    fields: [importConflicts.importRowId],
    references: [importRows.id],
  }),
  existingExpense: one(dailyExpenses, {
    fields: [importConflicts.existingExpenseId],
    references: [dailyExpenses.id],
  }),
  existingIncome: one(incomes, {
    fields: [importConflicts.existingIncomeId],
    references: [incomes.id],
  }),
  decision: one(importDecisions, {
    fields: [importConflicts.id],
    references: [importDecisions.conflictId],
  }),
}));

export const importDecisionsRelations = relations(importDecisions, ({ one }) => ({
  user: one(users, {
    fields: [importDecisions.userId],
    references: [users.id],
  }),
  session: one(importSessions, {
    fields: [importDecisions.sessionId],
    references: [importSessions.id],
  }),
  conflict: one(importConflicts, {
    fields: [importDecisions.conflictId],
    references: [importConflicts.id],
  }),
}));

export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull().default("Neuer Chat"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id")
    .references(() => conversations.id, { onDelete: "cascade" })
    .notNull(),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

// Web Push subscriptions (VAPID-based push notifications)
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.userId],
    references: [users.id],
  }),
}));

// Exchange rate cache (for Phase 2 — Live-Rate-Cache)
export const exchangeRates = pgTable("exchange_rates", {
  id: serial("id").primaryKey(),
  baseCurrency: text("base_currency").notNull(),
  targetCurrency: text("target_currency").notNull(),
  rate: numeric("rate", { precision: 10, scale: 6 }).notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
}, (table) => ({
  uniquePair: unique().on(table.baseCurrency, table.targetCurrency),
}));

export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id").primaryKey(),
  baseCurrency: text("base_currency").default(defaultCurrency).notNull(),
  locale: text("locale").default(defaultLocale).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}));

// Type exports for all tables
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type Income = typeof incomes.$inferSelect;
export type NewIncome = typeof incomes.$inferInsert;
export type DailyExpense = typeof dailyExpenses.$inferSelect;
export type NewDailyExpense = typeof dailyExpenses.$inferInsert;
export type Transfer = typeof transfers.$inferSelect;
export type NewTransfer = typeof transfers.$inferInsert;
export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type NewExchangeRate = typeof exchangeRates.$inferInsert;
