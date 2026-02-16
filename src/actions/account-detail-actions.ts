'use server';

import { db } from '@/lib/db';
import { accounts, incomes, expenses, dailyExpenses, categories } from '@/lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import type { ApiResponse, AccountDetail, IncomeWithAccount, ExpenseWithDetails, DailyExpenseWithDetails } from '@/types/database';

function getMonthDateRange(month: number, year: number): { startDate: Date; endDate: Date } {
  const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);
  return { startDate, endDate };
}

export async function getAccountTransactions(
  accountId: string,
  month?: number,
  year?: number
): Promise<ApiResponse<AccountDetail>> {
  try {
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (!account) {
      return { success: false, error: 'Konto nicht gefunden.' };
    }

    let dateFilter: { startDate: Date; endDate: Date } | null = null;
    if (month !== undefined && year !== undefined) {
      dateFilter = getMonthDateRange(month, year);
    }

    const incomeConditions = [eq(incomes.accountId, accountId)];
    const expenseConditions = [eq(expenses.accountId, accountId)];
    const dailyExpenseConditions = [eq(dailyExpenses.accountId, accountId)];

    if (dateFilter) {
      incomeConditions.push(gte(incomes.startDate, dateFilter.startDate));
      incomeConditions.push(lte(incomes.startDate, dateFilter.endDate));
      expenseConditions.push(gte(expenses.startDate, dateFilter.startDate));
      expenseConditions.push(lte(expenses.startDate, dateFilter.endDate));
      dailyExpenseConditions.push(gte(dailyExpenses.date, dateFilter.startDate));
      dailyExpenseConditions.push(lte(dailyExpenses.date, dateFilter.endDate));
    }

    const [incomesResult, expensesResult, dailyExpensesResult] = await Promise.all([
      db
        .select({
          income: incomes,
          account: accounts,
        })
        .from(incomes)
        .leftJoin(accounts, eq(incomes.accountId, accounts.id))
        .where(and(...incomeConditions)),

      db
        .select({
          expense: expenses,
          category: categories,
          account: accounts,
        })
        .from(expenses)
        .leftJoin(categories, eq(expenses.categoryId, categories.id))
        .leftJoin(accounts, eq(expenses.accountId, accounts.id))
        .where(and(...expenseConditions)),

      db
        .select({
          dailyExpense: dailyExpenses,
          category: categories,
          account: accounts,
        })
        .from(dailyExpenses)
        .leftJoin(categories, eq(dailyExpenses.categoryId, categories.id))
        .leftJoin(accounts, eq(dailyExpenses.accountId, accounts.id))
        .where(and(...dailyExpenseConditions)),
    ]);

    const incomesWithAccount: IncomeWithAccount[] = incomesResult.map((r) => ({
      ...r.income,
      account: r.account,
    }));

    const expensesWithDetails: ExpenseWithDetails[] = expensesResult.map((r) => ({
      ...r.expense,
      category: r.category,
      account: r.account,
    }));

    const dailyExpensesWithDetails: DailyExpenseWithDetails[] = dailyExpensesResult.map((r) => ({
      ...r.dailyExpense,
      category: r.category,
      account: r.account,
    }));

    const totalIncome = incomesWithAccount.reduce(
      (sum, income) => sum + parseFloat(income.amount),
      0
    );
    const totalExpenses = expensesWithDetails.reduce(
      (sum, expense) => sum + parseFloat(expense.amount),
      0
    );
    const totalDailyExpenses = dailyExpensesWithDetails.reduce(
      (sum, expense) => sum + parseFloat(expense.amount),
      0
    );
    const balance = totalIncome - totalExpenses - totalDailyExpenses;

    return {
      success: true,
      data: {
        account,
        incomes: incomesWithAccount,
        expenses: expensesWithDetails,
        dailyExpenses: dailyExpensesWithDetails,
        summary: {
          totalIncome,
          totalExpenses,
          totalDailyExpenses,
          balance,
        },
      },
    };
  } catch (error) {
    console.error('Failed to fetch account transactions:', error);
    return { success: false, error: 'Transaktionen konnten nicht geladen werden.' };
  }
}
