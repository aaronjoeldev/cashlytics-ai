"use server";

import { db } from "@/lib/db";
import { accounts, incomes, expenses, dailyExpenses, categories } from "@/lib/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import type {
  ApiResponse,
  AccountDetail,
  IncomeWithAccount,
  ExpenseWithDetails,
  DailyExpenseWithDetails,
} from "@/types/database";
import { safeParseFloat } from "@/lib/safe-parse";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth/require-auth";
import { cookies } from "next/headers";
import { convertCurrency, defaultCurrency, currencies, type Currency } from "@/lib/currency";

async function getBaseCurrency(): Promise<Currency> {
  const cookieStore = await cookies();
  const value = cookieStore.get("currency")?.value;
  if (value && currencies.includes(value as Currency)) return value as Currency;
  return defaultCurrency;
}

function toBase(amount: number, fromCurrency: string | null | undefined, baseCurrency: Currency): number {
  const from = (fromCurrency && currencies.includes(fromCurrency as Currency))
    ? (fromCurrency as Currency)
    : baseCurrency;
  return convertCurrency(amount, from, baseCurrency);
}

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
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  try {
    const [account] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
      .limit(1);

    if (!account) {
      return { success: false, error: "Konto nicht gefunden." };
    }

    let dateFilter: { startDate: Date; endDate: Date } | null = null;
    if (month !== undefined && year !== undefined) {
      dateFilter = getMonthDateRange(month, year);
    }

    const incomeConditions = [eq(incomes.accountId, accountId), eq(incomes.userId, userId)];
    const expenseConditions = [eq(expenses.accountId, accountId), eq(expenses.userId, userId)];
    const dailyExpenseConditions = [
      eq(dailyExpenses.accountId, accountId),
      eq(dailyExpenses.userId, userId),
    ];

    if (dateFilter) {
      // Recurring items: started before/during the month AND not ended before the month
      incomeConditions.push(lte(incomes.startDate, dateFilter.endDate));
      incomeConditions.push(
        sql`(${incomes.endDate} IS NULL OR ${incomes.endDate} >= ${dateFilter.startDate.toISOString()})`
      );
      expenseConditions.push(lte(expenses.startDate, dateFilter.endDate));
      expenseConditions.push(
        sql`(${expenses.endDate} IS NULL OR ${expenses.endDate} >= ${dateFilter.startDate.toISOString()})`
      );
      // Daily expenses are one-off events, so exact date range match is correct
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

    const baseCurrency = await getBaseCurrency();

    const totalIncome = incomesWithAccount.reduce(
      (sum, income) => sum + toBase(safeParseFloat(income.amount), income.currency, baseCurrency),
      0
    );
    const totalExpenses = expensesWithDetails.reduce(
      (sum, expense) => sum + toBase(safeParseFloat(expense.amount), expense.currency, baseCurrency),
      0
    );
    const totalDailyExpenses = dailyExpensesWithDetails.reduce(
      (sum, expense) => sum + toBase(safeParseFloat(expense.amount), expense.currency, baseCurrency),
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
    logger.error("Failed to fetch account transactions", "getAccountTransactions", error);
    return { success: false, error: "Transaktionen konnten nicht geladen werden." };
  }
}
