"use server";

import { db } from "@/lib/db";
import { accounts, expenses, incomes, transfers, dailyExpenses } from "@/lib/db/schema";
import { and, ilike, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/require-auth";

export interface SearchResult {
  id: string;
  type: "account" | "expense" | "daily_expense" | "income" | "transfer";
  title: string;
  subtitle?: string;
  amount?: string;
  /** Currency of `amount`; amounts are not converted. */
  currency?: string;
  href: string;
  icon?: string;
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  const auth = await requireAuth();
  if (auth.error) return [];
  const { userId } = auth;

  if (!query || query.trim().length < 2) {
    return [];
  }

  const searchTerm = `%${query.trim()}%`;
  const results: SearchResult[] = [];

  // Search accounts
  const accountResults = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), ilike(accounts.name, searchTerm)));

  for (const account of accountResults) {
    results.push({
      id: account.id,
      type: "account",
      title: account.name,
      subtitle:
        account.type === "checking"
          ? "Girokonto"
          : account.type === "savings"
            ? "Sparkonto"
            : "ETF-Konto",
      amount: account.balance,
      currency: account.currency,
      href: `/accounts/${account.id}`,
      icon: account.type === "checking" ? "🏦" : account.type === "savings" ? "🐷" : "📈",
    });
  }

  // Search expenses (periodic)
  const expenseResults = await db
    .select({
      id: expenses.id,
      name: expenses.name,
      amount: expenses.amount,
      currency: expenses.currency,
    })
    .from(expenses)
    .where(and(eq(expenses.userId, userId), ilike(expenses.name, searchTerm)));

  for (const expense of expenseResults) {
    results.push({
      id: expense.id,
      type: "expense",
      title: expense.name,
      subtitle: "Periodische Ausgabe",
      amount: expense.amount,
      currency: expense.currency,
      href: `/expenses`,
      icon: "💸",
    });
  }

  // Search daily expenses
  const dailyExpenseResults = await db
    .select({
      id: dailyExpenses.id,
      description: dailyExpenses.description,
      amount: dailyExpenses.amount,
      currency: dailyExpenses.currency,
    })
    .from(dailyExpenses)
    .where(and(eq(dailyExpenses.userId, userId), ilike(dailyExpenses.description, searchTerm)));

  for (const expense of dailyExpenseResults) {
    results.push({
      id: expense.id,
      type: "daily_expense",
      title: expense.description,
      subtitle: `Tägliche Ausgabe`,
      amount: expense.amount,
      currency: expense.currency,
      href: `/expenses`,
      icon: "🧾",
    });
  }

  // Search incomes
  const incomeResults = await db
    .select()
    .from(incomes)
    .where(and(eq(incomes.userId, userId), ilike(incomes.source, searchTerm)));

  for (const income of incomeResults) {
    results.push({
      id: income.id,
      type: "income",
      title: income.source,
      subtitle: "Einnahme",
      amount: income.amount,
      currency: income.currency,
      href: `/income`,
      icon: "💰",
    });
  }

  // Search transfers
  const transferResults = await db
    .select()
    .from(transfers)
    .where(and(eq(transfers.userId, userId), ilike(transfers.description, searchTerm)));

  for (const transfer of transferResults) {
    results.push({
      id: transfer.id,
      type: "transfer",
      title: transfer.description || "Transfer",
      subtitle: "Umbuchung",
      amount: transfer.amount,
      currency: transfer.sourceCurrency,
      href: `/transfers`,
      icon: "🔄",
    });
  }

  // Sort by type and limit results
  const typeOrder = { account: 0, income: 1, expense: 2, daily_expense: 3, transfer: 4 };
  results.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);

  return results.slice(0, 20);
}
