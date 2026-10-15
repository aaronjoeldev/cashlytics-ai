"use server";

import { db } from "@/lib/db";
import { accounts, incomes, expenses, dailyExpenses, categories } from "@/lib/db/schema";
import { and, gte, lt, lte, sql, desc, eq } from "drizzle-orm";
import type { ApiResponse, Account, DailyExpenseWithDetails } from "@/types/database";
import { safeParseFloat } from "@/lib/safe-parse";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth/require-auth";
import { getBaseCurrency } from "@/lib/user-preferences";
import { convertCurrency, currencies, type Currency } from "@/lib/currency";
import {
  getBudgetedAmountForMonth,
  getDueAmountForMonth,
  getNextOccurrence,
  type RecurringItem,
} from "@/lib/recurrence";

function toBase(
  amount: number,
  fromCurrency: string | null | undefined,
  baseCurrency: Currency
): number {
  const from =
    fromCurrency && currencies.includes(fromCurrency as Currency)
      ? (fromCurrency as Currency)
      : baseCurrency;
  return convertCurrency(amount, from, baseCurrency);
}

interface DashboardStats {
  totalAssets: number;
  /** True when the user has accounts in more than one currency — used by UI to show ≈ prefix */
  hasMultiCurrency: boolean;
  reserveView: {
    monthlyIncome: number;
    monthlyExpenses: number;
    savingsRate: number;
    incomeTrend: number;
    expenseTrend: number;
  };
  cashflowView: {
    monthlyIncome: number;
    monthlyExpenses: number;
    savingsRate: number;
    incomeTrend: number;
    expenseTrend: number;
  };
}

function getMonthDateRange(reference: Date): { monthStart: Date; monthEnd: Date } {
  const monthStart = new Date(reference.getFullYear(), reference.getMonth(), 1, 0, 0, 0, 0);
  const monthEnd = new Date(reference.getFullYear(), reference.getMonth() + 1, 0, 23, 59, 59, 999);
  return { monthStart, monthEnd };
}

interface CategoryBreakdown {
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  total: number;
  percentage: number;
}

export async function getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  try {
    const baseCurrency = await getBaseCurrency();

    // Gesamtvermögen: fetch per account and convert each balance to baseCurrency
    const accountsResult = await db
      .select({
        balance: accounts.balance,
        currency: accounts.currency,
      })
      .from(accounts)
      .where(eq(accounts.userId, userId));

    const totalAssets = accountsResult.reduce((sum, acc) => {
      return sum + toBase(safeParseFloat(acc.balance), acc.currency, baseCurrency);
    }, 0);

    // Check whether accounts have mixed currencies (used in client for ≈ indicator)
    const uniqueAccountCurrencies = new Set(accountsResult.map((a) => a.currency));
    const hasMultiCurrency = uniqueAccountCurrencies.size > 1;

    const now = new Date();
    const { monthStart: currentMonthStart, monthEnd: currentMonthEnd } = getMonthDateRange(now);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const { monthStart: lastMonthStart, monthEnd: lastMonthEnd } = getMonthDateRange(lastMonth);

    const [allIncomes, allExpenses, currentMonthDailyRows, lastMonthDailyRows] = await Promise.all([
      db
        .select({
          amount: incomes.amount,
          recurrenceType: incomes.recurrenceType,
          startDate: incomes.startDate,
          endDate: incomes.endDate,
          entryCurrency: incomes.currency,
        })
        .from(incomes)
        .where(eq(incomes.userId, userId)),

      db
        .select({
          amount: expenses.amount,
          recurrenceType: expenses.recurrenceType,
          recurrenceInterval: expenses.recurrenceInterval,
          startDate: expenses.startDate,
          endDate: expenses.endDate,
          entryCurrency: expenses.currency,
        })
        .from(expenses)
        .where(eq(expenses.userId, userId)),

      db
        .select({
          amount: dailyExpenses.amount,
          entryCurrency: dailyExpenses.currency,
        })
        .from(dailyExpenses)
        .where(
          and(
            eq(dailyExpenses.userId, userId),
            gte(dailyExpenses.date, currentMonthStart),
            lte(dailyExpenses.date, currentMonthEnd)
          )
        ),

      db
        .select({
          amount: dailyExpenses.amount,
          entryCurrency: dailyExpenses.currency,
        })
        .from(dailyExpenses)
        .where(
          and(
            eq(dailyExpenses.userId, userId),
            gte(dailyExpenses.date, lastMonthStart),
            lte(dailyExpenses.date, lastMonthEnd)
          )
        ),
    ]);

    // Convert each daily expense row to baseCurrency before summing
    const currentDailyExpensesTotal = currentMonthDailyRows.reduce(
      (sum, e) => sum + toBase(safeParseFloat(e.amount), e.entryCurrency, baseCurrency),
      0
    );
    const lastDailyExpensesTotal = lastMonthDailyRows.reduce(
      (sum, e) => sum + toBase(safeParseFloat(e.amount), e.entryCurrency, baseCurrency),
      0
    );

    const sumForMonth = (
      items: Array<RecurringItem & { amount: string; entryCurrency: string | null }>,
      amountForMonth: typeof getBudgetedAmountForMonth,
      reference: Date
    ) =>
      items.reduce((sum, item) => {
        const amount = amountForMonth(
          item,
          safeParseFloat(item.amount),
          reference.getFullYear(),
          reference.getMonth() + 1
        );
        return sum + toBase(amount, item.entryCurrency, baseCurrency);
      }, 0);

    // Reserve view: smoothed monthly averages. Cashflow view: what is actually due in the month.
    const reserveMonthlyIncome = sumForMonth(allIncomes, getBudgetedAmountForMonth, now);
    const reserveLastMonthlyIncome = sumForMonth(allIncomes, getBudgetedAmountForMonth, lastMonth);
    const reserveMonthlyExpenses =
      currentDailyExpensesTotal + sumForMonth(allExpenses, getBudgetedAmountForMonth, now);
    const reserveLastMonthlyExpenses =
      lastDailyExpensesTotal + sumForMonth(allExpenses, getBudgetedAmountForMonth, lastMonth);

    const cashflowMonthlyIncome = sumForMonth(allIncomes, getDueAmountForMonth, now);
    const cashflowLastMonthlyIncome = sumForMonth(allIncomes, getDueAmountForMonth, lastMonth);
    const cashflowMonthlyExpenses =
      currentDailyExpensesTotal + sumForMonth(allExpenses, getDueAmountForMonth, now);
    const cashflowLastMonthlyExpenses =
      lastDailyExpensesTotal + sumForMonth(allExpenses, getDueAmountForMonth, lastMonth);

    const reserveSavingsRate = reserveMonthlyIncome - reserveMonthlyExpenses;
    const cashflowSavingsRate = cashflowMonthlyIncome - cashflowMonthlyExpenses;

    const reserveIncomeTrend =
      reserveLastMonthlyIncome > 0
        ? ((reserveMonthlyIncome - reserveLastMonthlyIncome) / reserveLastMonthlyIncome) * 100
        : 0;

    const reserveExpenseTrend =
      reserveLastMonthlyExpenses > 0
        ? ((reserveMonthlyExpenses - reserveLastMonthlyExpenses) / reserveLastMonthlyExpenses) * 100
        : 0;

    const cashflowIncomeTrend =
      cashflowLastMonthlyIncome > 0
        ? ((cashflowMonthlyIncome - cashflowLastMonthlyIncome) / cashflowLastMonthlyIncome) * 100
        : 0;

    const cashflowExpenseTrend =
      cashflowLastMonthlyExpenses > 0
        ? ((cashflowMonthlyExpenses - cashflowLastMonthlyExpenses) / cashflowLastMonthlyExpenses) *
          100
        : 0;

    return {
      success: true,
      data: {
        totalAssets,
        hasMultiCurrency,
        reserveView: {
          monthlyIncome: reserveMonthlyIncome,
          monthlyExpenses: reserveMonthlyExpenses,
          savingsRate: reserveSavingsRate,
          incomeTrend: reserveIncomeTrend,
          expenseTrend: -reserveExpenseTrend,
        },
        cashflowView: {
          monthlyIncome: cashflowMonthlyIncome,
          monthlyExpenses: cashflowMonthlyExpenses,
          savingsRate: cashflowSavingsRate,
          incomeTrend: cashflowIncomeTrend,
          expenseTrend: -cashflowExpenseTrend,
        },
      },
    };
  } catch (error) {
    logger.error("Failed to fetch dashboard stats", "getDashboardStats", error);
    return {
      success: false,
      error: "Failed to fetch dashboard stats",
    };
  }
}

export async function getCategoryBreakdown(
  startDate: Date = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
): Promise<ApiResponse<CategoryBreakdown[]>> {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  try {
    const nextMonthStart = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
    const baseCurrency = await getBaseCurrency();
    const categoryMap = new Map<
      string,
      {
        categoryName: string;
        categoryIcon: string | null;
        categoryColor: string | null;
        total: number;
      }
    >();

    const dailyExpensesResult = await db
      .select({
        categoryId: dailyExpenses.categoryId,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
        amount: dailyExpenses.amount,
        entryCurrency: dailyExpenses.currency,
      })
      .from(dailyExpenses)
      .leftJoin(categories, sql`${dailyExpenses.categoryId} = ${categories.id}`)
      .where(
        and(
          eq(dailyExpenses.userId, userId),
          gte(dailyExpenses.date, startDate),
          // Without an upper bound, entries dated in later months counted as this month
          lt(dailyExpenses.date, nextMonthStart)
        )
      );

    for (const row of dailyExpensesResult) {
      const categoryId = row.categoryId || "uncategorized";
      const amount = toBase(safeParseFloat(row.amount), row.entryCurrency, baseCurrency);
      if (categoryMap.has(categoryId)) {
        categoryMap.get(categoryId)!.total += amount;
      } else {
        categoryMap.set(categoryId, {
          categoryName: row.categoryName || "Ohne Kategorie",
          categoryIcon: row.categoryIcon,
          categoryColor: row.categoryColor,
          total: amount,
        });
      }
    }

    const periodicExpensesResult = await db
      .select({
        categoryId: expenses.categoryId,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
        amount: expenses.amount,
        recurrenceType: expenses.recurrenceType,
        recurrenceInterval: expenses.recurrenceInterval,
        startDate: expenses.startDate,
        endDate: expenses.endDate,
        entryCurrency: expenses.currency,
      })
      .from(expenses)
      .leftJoin(categories, sql`${expenses.categoryId} = ${categories.id}`)
      .where(
        and(
          eq(expenses.userId, userId),
          sql`(${expenses.endDate} IS NULL OR ${expenses.endDate} >= ${startDate.toISOString()})`
        )
      );

    for (const row of periodicExpensesResult) {
      const rawMonthly = getBudgetedAmountForMonth(
        row,
        safeParseFloat(row.amount),
        startDate.getFullYear(),
        startDate.getMonth() + 1
      );
      if (rawMonthly === 0) continue;

      const categoryId = row.categoryId || "uncategorized";
      const monthlyAmount = toBase(rawMonthly, row.entryCurrency, baseCurrency);

      if (categoryMap.has(categoryId)) {
        categoryMap.get(categoryId)!.total += monthlyAmount;
      } else {
        categoryMap.set(categoryId, {
          categoryName: row.categoryName || "Ohne Kategorie",
          categoryIcon: row.categoryIcon,
          categoryColor: row.categoryColor,
          total: monthlyAmount,
        });
      }
    }

    const totalSum = Array.from(categoryMap.values()).reduce((sum, c) => sum + c.total, 0);

    const breakdown: CategoryBreakdown[] = Array.from(categoryMap.entries())
      .map(([categoryId, data]) => ({
        categoryId,
        categoryName: data.categoryName,
        categoryIcon: data.categoryIcon,
        categoryColor: data.categoryColor,
        total: data.total,
        percentage: totalSum > 0 ? (data.total / totalSum) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return { success: true, data: breakdown };
  } catch (error) {
    logger.error("Failed to fetch category breakdown", "getCategoryBreakdown", error);
    return { success: false, error: "Failed to fetch category breakdown" };
  }
}

export async function getRecentTransactions(
  limit: number = 5
): Promise<ApiResponse<DailyExpenseWithDetails[]>> {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  try {
    // Planned entries with a later date are not "recent". Dates are UTC-midnight calendar days.
    const now = new Date();
    const tomorrow = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    );
    const transactions = await db.query.dailyExpenses.findMany({
      with: {
        account: true,
        category: true,
      },
      where: and(eq(dailyExpenses.userId, userId), lt(dailyExpenses.date, tomorrow)),
      orderBy: [desc(dailyExpenses.date), desc(dailyExpenses.createdAt)],
      limit,
    });

    return { success: true, data: transactions as DailyExpenseWithDetails[] };
  } catch (error) {
    logger.error("Failed to fetch recent transactions", "getRecentTransactions", error);
    return { success: false, error: "Failed to fetch recent transactions" };
  }
}

export async function getAccounts(): Promise<ApiResponse<Account[]>> {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  try {
    const allAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .orderBy(accounts.name);
    return { success: true, data: allAccounts };
  } catch (error) {
    logger.error("Failed to fetch accounts", "getAccounts", error);
    return { success: false, error: "Failed to fetch accounts" };
  }
}

interface UpcomingPayment {
  id: string;
  name: string;
  amount: number;
  date: Date;
  type: "expense" | "daily_expense";
  category: {
    name: string | null;
    icon: string | null;
    color: string | null;
  } | null;
  isSubscription: boolean;
}

export async function getUpcomingPayments(
  days: number = 14
): Promise<ApiResponse<UpcomingPayment[]>> {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  try {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
    const baseCurrency = await getBaseCurrency();

    const payments: UpcomingPayment[] = [];

    const activeExpenses = await db
      .select({
        expense: expenses,
        category: categories,
      })
      .from(expenses)
      .leftJoin(categories, eq(expenses.categoryId, categories.id))
      .where(
        and(
          eq(expenses.userId, userId),
          sql`(${expenses.endDate} IS NULL OR ${expenses.endDate} >= ${today.toISOString()})`
        )
      );

    for (const item of activeExpenses) {
      if (item.expense.recurrenceType === "once") continue;

      const nextDate = getNextOccurrence(item.expense, now);

      if (nextDate && nextDate <= endDate) {
        payments.push({
          id: item.expense.id,
          name: item.expense.name,
          amount: toBase(safeParseFloat(item.expense.amount), item.expense.currency, baseCurrency),
          date: nextDate,
          type: "expense",
          category: item.category
            ? {
                name: item.category.name,
                icon: item.category.icon,
                color: item.category.color,
              }
            : null,
          isSubscription: item.expense.isSubscription ?? false,
        });
      }
    }

    const upcomingDailyExpenses = await db
      .select({
        dailyExpense: dailyExpenses,
        category: categories,
      })
      .from(dailyExpenses)
      .leftJoin(categories, eq(dailyExpenses.categoryId, categories.id))
      .where(
        and(
          eq(dailyExpenses.userId, userId),
          gte(dailyExpenses.date, today),
          lte(dailyExpenses.date, endDate)
        )
      );

    for (const item of upcomingDailyExpenses) {
      payments.push({
        id: item.dailyExpense.id,
        name: item.dailyExpense.description,
        amount: toBase(
          safeParseFloat(item.dailyExpense.amount),
          item.dailyExpense.currency,
          baseCurrency
        ),
        date: new Date(item.dailyExpense.date),
        type: "daily_expense",
        category: item.category
          ? {
              name: item.category.name,
              icon: item.category.icon,
              color: item.category.color,
            }
          : null,
        isSubscription: false,
      });
    }

    payments.sort((a, b) => a.date.getTime() - b.date.getTime());

    return { success: true, data: payments };
  } catch (error) {
    logger.error("Failed to fetch upcoming payments", "getUpcomingPayments", error);
    return { success: false, error: "Failed to fetch upcoming payments" };
  }
}
