import {
  pgTable,
  uuid,
  text,
  decimal,
  timestamp,
  integer,
  pgEnum,
  boolean,
  primaryKey,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

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
export const billingPlanIntervalEnum = pgEnum("billing_plan_interval", ["monthly", "yearly"]);
export const billingEventOutcomeEnum = pgEnum("billing_event_outcome", [
  "processed",
  "duplicate",
  "ignored",
  "failed",
]);
export const usagePeriodTypeEnum = pgEnum("usage_period_type", ["daily", "monthly"]);
export const adminOverrideActionEnum = pgEnum("admin_override_action", [
  "extend_trial_end",
  "adjust_ai_cap",
  "set_ai_enabled",
  "override_plan_status",
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

// Stripe billing customer mapping (separate from financial app subscriptions)
export const billingCustomers = pgTable(
  "billing_customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("billing_customers_user_id_unique").on(t.userId),
    uniqueIndex("billing_customers_stripe_customer_id_unique").on(t.stripeCustomerId),
  ]
);

// Stripe billing subscription snapshot (separate from recurring expenses)
export const billingSubscriptions = pgTable(
  "billing_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    billingCustomerId: uuid("billing_customer_id")
      .notNull()
      .references(() => billingCustomers.id, { onDelete: "cascade" }),
    stripeSubscriptionId: text("stripe_subscription_id").notNull(),
    stripePriceId: text("stripe_price_id"),
    status: text("status").notNull().default("incomplete"),
    planInterval: billingPlanIntervalEnum("plan_interval"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    trialStartsAt: timestamp("trial_starts_at"),
    trialEndsAt: timestamp("trial_ends_at"),
    canceledAt: timestamp("canceled_at"),
    lastStripeEventCreatedAt: timestamp("last_stripe_event_created_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("billing_subscriptions_user_id_unique").on(t.userId),
    uniqueIndex("billing_subscriptions_stripe_subscription_id_unique").on(t.stripeSubscriptionId),
    index("billing_subscriptions_billing_customer_id_idx").on(t.billingCustomerId),
  ]
);

// Raw Stripe webhook event log for idempotency and replay safety
export const billingEvents = pgTable(
  "billing_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stripeEventId: text("stripe_event_id").notNull(),
    eventType: text("event_type").notNull(),
    stripeCreatedAt: timestamp("stripe_created_at").notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    outcome: billingEventOutcomeEnum("outcome").notNull().default("processed"),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("billing_events_stripe_event_id_unique").on(t.stripeEventId),
    index("billing_events_user_id_idx").on(t.userId),
    index("billing_events_stripe_customer_id_idx").on(t.stripeCustomerId),
    index("billing_events_stripe_subscription_id_idx").on(t.stripeSubscriptionId),
  ]
);

export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    requestId: text("request_id"),
    model: text("model").notNull(),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    inputCostEur: decimal("input_cost_eur", { precision: 12, scale: 6 }).notNull().default("0"),
    outputCostEur: decimal("output_cost_eur", { precision: 12, scale: 6 }).notNull().default("0"),
    totalCostEur: decimal("total_cost_eur", { precision: 12, scale: 6 }).notNull().default("0"),
    pricingVersion: text("pricing_version").notNull(),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("usage_events_user_id_idx").on(t.userId),
    index("usage_events_user_created_idx").on(t.userId, t.createdAt),
    index("usage_events_conversation_idx").on(t.conversationId),
    uniqueIndex("usage_events_user_request_unique").on(t.userId, t.requestId),
  ]
);

export const usagePeriods = pgTable(
  "usage_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    periodType: usagePeriodTypeEnum("period_type").notNull(),
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),
    totalPromptTokens: integer("total_prompt_tokens").notNull().default(0),
    totalCompletionTokens: integer("total_completion_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    totalCostEur: decimal("total_cost_eur", { precision: 12, scale: 6 }).notNull().default("0"),
    lastAggregatedAt: timestamp("last_aggregated_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("usage_periods_user_period_unique").on(t.userId, t.periodType, t.periodStart),
    index("usage_periods_user_id_idx").on(t.userId),
  ]
);

export const entitlements = pgTable(
  "entitlements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    billingSubscriptionId: uuid("billing_subscription_id").references(
      () => billingSubscriptions.id,
      {
        onDelete: "set null",
      }
    ),
    planCode: text("plan_code").notNull().default("free"),
    status: text("status").notNull().default("inactive"),
    aiEnabled: boolean("ai_enabled").notNull().default(false),
    aiHardCapEur: decimal("ai_hard_cap_eur", { precision: 12, scale: 2 }).notNull().default("2.00"),
    aiSpendToDateEur: decimal("ai_spend_to_date_eur", { precision: 12, scale: 6 })
      .notNull()
      .default("0"),
    trialStartedAt: timestamp("trial_started_at"),
    trialEndsAt: timestamp("trial_ends_at"),
    aiBlockedReason: text("ai_blocked_reason"),
    lastStripeEventId: text("last_stripe_event_id"),
    lastStripeEventCreatedAt: timestamp("last_stripe_event_created_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("entitlements_user_id_unique").on(t.userId),
    index("entitlements_trial_ends_at_idx").on(t.trialEndsAt),
  ]
);

export const adminOverrideAudit = pgTable(
  "admin_override_audit",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actor: text("actor").notNull(),
    reason: text("reason").notNull(),
    actionType: adminOverrideActionEnum("action_type").notNull(),
    beforeSnapshot: jsonb("before_snapshot").notNull(),
    afterSnapshot: jsonb("after_snapshot").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("admin_override_audit_user_created_idx").on(t.userId, t.createdAt)]
);

// User relations - enables querying user's data with Drizzle relational queries
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  categories: many(categories),
  expenses: many(expenses),
  incomes: many(incomes),
  dailyExpenses: many(dailyExpenses),
  transfers: many(transfers),
  documents: many(documents),
  conversations: many(conversations),
  pushSubscriptions: many(pushSubscriptions),
  billingCustomers: many(billingCustomers),
  billingSubscriptions: many(billingSubscriptions),
  billingEvents: many(billingEvents),
  usageEvents: many(usageEvents),
  usagePeriods: many(usagePeriods),
  entitlements: many(entitlements),
  adminOverrideAudits: many(adminOverrideAudit),
}));

export const billingCustomersRelations = relations(billingCustomers, ({ one, many }) => ({
  user: one(users, {
    fields: [billingCustomers.userId],
    references: [users.id],
  }),
  subscriptions: many(billingSubscriptions),
}));

export const billingSubscriptionsRelations = relations(billingSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [billingSubscriptions.userId],
    references: [users.id],
  }),
  customer: one(billingCustomers, {
    fields: [billingSubscriptions.billingCustomerId],
    references: [billingCustomers.id],
  }),
}));

export const billingEventsRelations = relations(billingEvents, ({ one }) => ({
  user: one(users, {
    fields: [billingEvents.userId],
    references: [users.id],
  }),
}));

export const usageEventsRelations = relations(usageEvents, ({ one }) => ({
  user: one(users, {
    fields: [usageEvents.userId],
    references: [users.id],
  }),
  conversation: one(conversations, {
    fields: [usageEvents.conversationId],
    references: [conversations.id],
  }),
}));

export const usagePeriodsRelations = relations(usagePeriods, ({ one }) => ({
  user: one(users, {
    fields: [usagePeriods.userId],
    references: [users.id],
  }),
}));

export const entitlementsRelations = relations(entitlements, ({ one }) => ({
  user: one(users, {
    fields: [entitlements.userId],
    references: [users.id],
  }),
  subscription: one(billingSubscriptions, {
    fields: [entitlements.billingSubscriptionId],
    references: [billingSubscriptions.id],
  }),
}));

export const adminOverrideAuditRelations = relations(adminOverrideAudit, ({ one }) => ({
  user: one(users, {
    fields: [adminOverrideAudit.userId],
    references: [users.id],
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
  usageEvents: many(usageEvents),
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
