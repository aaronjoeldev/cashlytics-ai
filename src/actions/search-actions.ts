'use server';

import { db } from '@/lib/db';
import { accounts, expenses, incomes, transfers, dailyExpenses, categories } from '@/lib/db/schema';
import { or, ilike, sql } from 'drizzle-orm';

export interface SearchResult {
  id: string;
  type: 'account' | 'expense' | 'daily_expense' | 'income' | 'transfer';
  title: string;
  subtitle?: string;
  amount?: string;
  href: string;
  icon?: string;
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const searchTerm = `%${query.trim()}%`;
  const results: SearchResult[] = [];

  // Search accounts
  const accountResults = await db
    .select()
    .from(accounts)
    .where(ilike(accounts.name, searchTerm));

  for (const account of accountResults) {
    results.push({
      id: account.id,
      type: 'account',
      title: account.name,
      subtitle: account.type === 'checking' ? 'Girokonto' : account.type === 'savings' ? 'Sparkonto' : 'ETF-Konto',
      amount: account.balance,
      href: `/accounts/${account.id}`,
      icon: account.type === 'checking' ? '🏦' : account.type === 'savings' ? '🐷' : '📈',
    });
  }

  // Search expenses (periodic)
  const expenseResults = await db
    .select({
      id: expenses.id,
      name: expenses.name,
      amount: expenses.amount,
      accountId: expenses.accountId,
      categoryId: expenses.categoryId,
    })
    .from(expenses)
    .leftJoin(categories, sql`${expenses.categoryId} = ${categories.id}`)
    .where(ilike(expenses.name, searchTerm));

  for (const expense of expenseResults) {
    results.push({
      id: expense.id,
      type: 'expense',
      title: expense.name,
      subtitle: 'Periodische Ausgabe',
      amount: expense.amount,
      href: `/expenses`,
      icon: '💸',
    });
  }

  // Search daily expenses
  const dailyExpenseResults = await db
    .select({
      id: dailyExpenses.id,
      description: dailyExpenses.description,
      amount: dailyExpenses.amount,
      date: dailyExpenses.date,
    })
    .from(dailyExpenses)
    .where(ilike(dailyExpenses.description, searchTerm));

  for (const expense of dailyExpenseResults) {
    results.push({
      id: expense.id,
      type: 'daily_expense',
      title: expense.description,
      subtitle: `Tägliche Ausgabe`,
      amount: expense.amount,
      href: `/expenses`,
      icon: '🧾',
    });
  }

  // Search incomes
  const incomeResults = await db
    .select()
    .from(incomes)
    .where(ilike(incomes.source, searchTerm));

  for (const income of incomeResults) {
    results.push({
      id: income.id,
      type: 'income',
      title: income.source,
      subtitle: 'Einnahme',
      amount: income.amount,
      href: `/income`,
      icon: '💰',
    });
  }

  // Search transfers
  const transferResults = await db
    .select()
    .from(transfers)
    .where(ilike(transfers.description, searchTerm));

  for (const transfer of transferResults) {
    results.push({
      id: transfer.id,
      type: 'transfer',
      title: transfer.description || 'Transfer',
      subtitle: 'Umbuchung',
      amount: transfer.amount,
      href: `/transfers`,
      icon: '🔄',
    });
  }

  // Sort by type and limit results
  const typeOrder = { account: 0, income: 1, expense: 2, daily_expense: 3, transfer: 4 };
  results.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);

  return results.slice(0, 20);
}
