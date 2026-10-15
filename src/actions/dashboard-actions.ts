"use server";

import { db } from "@/lib/db";
import { accounts, expenses, dailyExpenses, categories } from "@/lib/db/schema";
import { and, gte, lt, sql, desc, eq } from "drizzle-orm";
import type { ApiResponse, Account, DailyExpenseWithDetails } from "@/types/database";
import { safeParseFloat } from "@/lib/safe-parse";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth/require-auth";
import { getBaseCurrency } from "@/lib/user-preferences";
import { toBaseCurrency as toBase } from "@/lib/currency";
import { getRates } from "@/lib/exchange-rates";
import { getBudgetedAmountForMonth } from "@/lib/recurrence";
import {
  computeDashboardStats,
  listUpcomingPayments,
  type DashboardStats,
  type UpcomingPayment,
} from "@/lib/services/dashboard";

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
    const [baseCurrency, rates] = await Promise.all([getBaseCurrency(), getRates()]);
    return { success: true, data: await computeDashboardStats({ userId, baseCurrency, rates }) };
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
    const [baseCurrency, rates] = await Promise.all([getBaseCurrency(), getRates()]);
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
      const amount = toBase(safeParseFloat(row.amount), row.entryCurrency, baseCurrency, rates);
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
      const monthlyAmount = toBase(rawMonthly, row.entryCurrency, baseCurrency, rates);

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

export async function getUpcomingPayments(
  days: number = 14
): Promise<ApiResponse<UpcomingPayment[]>> {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  try {
    const [baseCurrency, rates] = await Promise.all([getBaseCurrency(), getRates()]);
    const payments = await listUpcomingPayments({ userId, baseCurrency, rates }, days);
    return { success: true, data: payments };
  } catch (error) {
    logger.error("Failed to fetch upcoming payments", "getUpcomingPayments", error);
    return { success: false, error: "Failed to fetch upcoming payments" };
  }
}
