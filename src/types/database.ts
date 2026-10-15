import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import {
  accounts,
  categories,
  expenses,
  incomes,
  dailyExpenses,
  transfers,
  conversations,
  messages,
  documents,
  pushSubscriptions,
  importSessions,
  importRows,
  importConflicts,
  importDecisions,
} from "@/lib/db/schema";

export type Account = InferSelectModel<typeof accounts>;
export type NewAccount = InferInsertModel<typeof accounts>;

export type Category = InferSelectModel<typeof categories>;
export type NewCategory = InferInsertModel<typeof categories>;

export type Expense = InferSelectModel<typeof expenses>;
export type NewExpense = InferInsertModel<typeof expenses>;

export type Income = InferSelectModel<typeof incomes>;
export type NewIncome = InferInsertModel<typeof incomes>;

export type DailyExpense = InferSelectModel<typeof dailyExpenses>;
export type NewDailyExpense = InferInsertModel<typeof dailyExpenses>;

export type Transfer = InferSelectModel<typeof transfers>;
export type NewTransfer = InferInsertModel<typeof transfers>;

export type Document = InferSelectModel<typeof documents>;
export type NewDocument = InferInsertModel<typeof documents>;

export type Conversation = InferSelectModel<typeof conversations>;
export type NewConversation = InferInsertModel<typeof conversations>;
export type Message = InferSelectModel<typeof messages>;
export type NewMessage = InferInsertModel<typeof messages>;
export type ConversationWithMessages = Conversation & { messages: Message[] };

export type PushSubscription = InferSelectModel<typeof pushSubscriptions>;
export type NewPushSubscription = InferInsertModel<typeof pushSubscriptions>;

export type ImportSession = InferSelectModel<typeof importSessions>;
export type NewImportSession = InferInsertModel<typeof importSessions>;

export type ImportRow = InferSelectModel<typeof importRows>;
export type NewImportRow = InferInsertModel<typeof importRows>;

export type ImportConflict = InferSelectModel<typeof importConflicts>;
export type NewImportConflict = InferInsertModel<typeof importConflicts>;

export type ImportDecision = InferSelectModel<typeof importDecisions>;
export type NewImportDecision = InferInsertModel<typeof importDecisions>;

export type ExpenseWithDetails = Expense & {
  category: Category | null;
  account: Account | null;
};

export type DailyExpenseWithDetails = DailyExpense & {
  category: Category | null;
  account: Account | null;
};

export type IncomeWithAccount = Income & {
  account: Account | null;
};

export type TransferWithDetails = Transfer & {
  sourceAccount: Account | null;
  targetAccount: Account | null;
};

export type ApiResponse<T> = { success: true; data: T } | { success: false; error: string };

export type MonthlyOverview = {
  month: number;
  year: number;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  expenses: ExpenseWithDetails[];
  incomes: IncomeWithAccount[];
};

export type CategoryBreakdown = {
  category: Category;
  amount: number;
  percentage: number;
};

export type Forecast = {
  months: number;
  projectedIncome: number;
  projectedExpenses: number;
  projectedBalance: number;
  monthlyDetails: Array<{
    month: number;
    year: number;
    income: number;
    expenses: number;
    balance: number;
  }>;
};
