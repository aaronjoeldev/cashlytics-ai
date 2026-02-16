import { pgTable, uuid, text, decimal, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const accountTypeEnum = pgEnum('account_type', ['checking', 'savings', 'etf']);
export const recurrenceTypeEnum = pgEnum('recurrence_type', [
  'once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'
]);
export const incomeRecurrenceTypeEnum = pgEnum('income_recurrence_type', ['once', 'monthly', 'yearly']);
export const transferRecurrenceTypeEnum = pgEnum('transfer_recurrence_type', ['once', 'monthly', 'quarterly', 'yearly']);

export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  type: accountTypeEnum('type').notNull(),
  balance: decimal('balance', { precision: 12, scale: 2 }).notNull().default('0'),
  currency: text('currency').default('EUR').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  icon: text('icon'),
  color: text('color'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const expenses = pgTable('expenses', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => categories.id),
  name: text('name').notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  recurrenceType: recurrenceTypeEnum('recurrence_type').notNull(),
  recurrenceInterval: integer('recurrence_interval'),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const incomes = pgTable('incomes', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
  source: text('source').notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  recurrenceType: incomeRecurrenceTypeEnum('recurrence_type').notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const dailyExpenses = pgTable('daily_expenses', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => categories.id),
  description: text('description').notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  date: timestamp('date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const transfers = pgTable('transfers', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceAccountId: uuid('source_account_id').references(() => accounts.id, { onDelete: 'cascade' }).notNull(),
  targetAccountId: uuid('target_account_id').references(() => accounts.id, { onDelete: 'cascade' }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  description: text('description'),
  recurrenceType: transferRecurrenceTypeEnum('recurrence_type').notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const accountsRelations = relations(accounts, ({ many }) => ({
  expenses: many(expenses),
  incomes: many(incomes),
  dailyExpenses: many(dailyExpenses),
  outgoingTransfers: many(transfers, { relationName: 'sourceAccount' }),
  incomingTransfers: many(transfers, { relationName: 'targetAccount' }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  expenses: many(expenses),
  dailyExpenses: many(dailyExpenses),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  account: one(accounts, {
    fields: [expenses.accountId],
    references: [accounts.id],
  }),
  category: one(categories, {
    fields: [expenses.categoryId],
    references: [categories.id],
  }),
}));

export const incomesRelations = relations(incomes, ({ one }) => ({
  account: one(accounts, {
    fields: [incomes.accountId],
    references: [accounts.id],
  }),
}));

export const dailyExpensesRelations = relations(dailyExpenses, ({ one }) => ({
  account: one(accounts, {
    fields: [dailyExpenses.accountId],
    references: [accounts.id],
  }),
  category: one(categories, {
    fields: [dailyExpenses.categoryId],
    references: [categories.id],
  }),
}));

export const transfersRelations = relations(transfers, ({ one }) => ({
  sourceAccount: one(accounts, {
    fields: [transfers.sourceAccountId],
    references: [accounts.id],
    relationName: 'sourceAccount',
  }),
  targetAccount: one(accounts, {
    fields: [transfers.targetAccountId],
    references: [accounts.id],
    relationName: 'targetAccount',
  }),
}));

export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull().default('Neuer Chat'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));
