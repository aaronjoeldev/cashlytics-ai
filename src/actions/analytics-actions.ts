"use server";

import { db } from "@/lib/db";
import { expenses, dailyExpenses, categories } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/require-auth";
import type {
  ApiResponse,
  MonthlyOverview,
  Forecast,
  CategoryBreakdown,
  ExpenseWithDetails,
} from "@/types/database";
import { safeParseFloat } from "@/lib/safe-parse";
import { getBudgetedAmountForMonth } from "@/lib/recurrence";
import { getBaseCurrency } from "@/lib/user-preferences";
import { toBaseCurrency as toBase } from "@/lib/currency";
import { getRates } from "@/lib/exchange-rates";
import type { FinanceContext } from "@/lib/services/context";
import {
  computeForecast,
  computeMonthlyOverview,
  listNormalizedExpenses,
  listScheduledPayments,
} from "@/lib/services/analytics";

/** Session user with base currency and rates, or null when signed out. */
async function getSessionContext(): Promise<FinanceContext | null> {
  const auth = await requireAuth();
  if (auth.error) return null;
  const [baseCurrency, rates] = await Promise.all([getBaseCurrency(), getRates()]);
  return { userId: auth.userId, baseCurrency, rates };
}

export async function getMonthlyOverview(
  month: number,
  year: number,
  accountId?: string
): Promise<ApiResponse<MonthlyOverview>> {
  const ctx = await getSessionContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  try {
    return { success: true, data: await computeMonthlyOverview(ctx, month, year, accountId) };
  } catch (error) {
    logger.error("Failed to get monthly overview", "getMonthlyOverview", error);
    return { success: false, error: "Monatsübersicht konnte nicht geladen werden." };
  }
}

export async function getForecast(months: number): Promise<ApiResponse<Forecast>> {
  const ctx = await getSessionContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  try {
    return { success: true, data: await computeForecast(ctx, months) };
  } catch (error) {
    logger.error("Failed to get forecast", "getForecast", error);
    return { success: false, error: "Prognose konnte nicht erstellt werden." };
  }
}

export async function getCategoryBreakdown(
  startDate: Date,
  endDate: Date,
  accountId?: string
): Promise<ApiResponse<CategoryBreakdown[]>> {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  try {
    const [baseCurrency, rates] = await Promise.all([getBaseCurrency(), getRates()]);
    const categoryMap = new Map<
      string,
      { category: typeof categories.$inferSelect | null; amount: number }
    >();

    const dailyExpensesResult = await db
      .select({
        dailyExpense: dailyExpenses,
        category: categories,
      })
      .from(dailyExpenses)
      .leftJoin(categories, eq(dailyExpenses.categoryId, categories.id))
      .where(
        and(
          eq(dailyExpenses.userId, userId),
          gte(dailyExpenses.date, startDate),
          lte(dailyExpenses.date, endDate),
          accountId ? eq(dailyExpenses.accountId, accountId) : undefined
        )
      );

    for (const item of dailyExpensesResult) {
      const categoryId = item.category?.id ?? "uncategorized";
      // Convert to baseCurrency using entry's own currency
      const amount = toBase(
        safeParseFloat(item.dailyExpense.amount),
        item.dailyExpense.currency,
        baseCurrency,
        rates
      );

      if (categoryMap.has(categoryId)) {
        const existing = categoryMap.get(categoryId)!;
        existing.amount += amount;
      } else {
        categoryMap.set(categoryId, { category: item.category, amount });
      }
    }

    const periodicExpensesResult = await db
      .select({
        expense: expenses,
        category: categories,
      })
      .from(expenses)
      .leftJoin(categories, eq(expenses.categoryId, categories.id))
      .where(
        and(
          eq(expenses.userId, userId),
          lte(expenses.startDate, endDate),
          sql`(${expenses.endDate} IS NULL OR ${expenses.endDate} >= ${startDate.toISOString()})`,
          accountId ? eq(expenses.accountId, accountId) : undefined
        )
      );

    // Budget each periodic expense once per calendar month in the range. The range bounds may be
    // local-midnight dates from the browser, so move them half a day inwards before reading the
    // UTC month.
    const HALF_DAY_MS = 12 * 60 * 60 * 1000;
    const rangeStart = new Date(startDate.getTime() + HALF_DAY_MS);
    const rangeEnd = new Date(Math.max(endDate.getTime() - HALF_DAY_MS, rangeStart.getTime()));
    const rangeMonths: Array<{ year: number; month: number }> = [];
    const cursor = new Date(Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), 1));
    while (cursor <= rangeEnd) {
      rangeMonths.push({ year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1 });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    for (const item of periodicExpensesResult) {
      const rawAmount = rangeMonths.reduce(
        (sum, { year, month }) =>
          sum +
          getBudgetedAmountForMonth(item.expense, safeParseFloat(item.expense.amount), year, month),
        0
      );
      if (rawAmount === 0) continue;

      const categoryId = item.category?.id ?? "uncategorized";
      // Convert to baseCurrency using entry's own currency
      const monthlyAmount = toBase(rawAmount, item.expense.currency, baseCurrency, rates);

      if (categoryMap.has(categoryId)) {
        const existing = categoryMap.get(categoryId)!;
        existing.amount += monthlyAmount;
      } else {
        categoryMap.set(categoryId, { category: item.category, amount: monthlyAmount });
      }
    }

    const totalAmount = Array.from(categoryMap.values()).reduce((sum, c) => sum + c.amount, 0);

    const breakdown: CategoryBreakdown[] = Array.from(categoryMap.values())
      .map((c) => ({
        category: c.category ?? {
          id: "uncategorized",
          name: "Ohne Kategorie",
          userId: "system",
          icon: null,
          color: null,
          createdAt: new Date(),
        },
        amount: c.amount,
        percentage: totalAmount > 0 ? (c.amount / totalAmount) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return { success: true, data: breakdown };
  } catch (error) {
    logger.error("Failed to get category breakdown", "getCategoryBreakdown", error);
    return { success: false, error: "Kategorie-Übersicht konnte nicht geladen werden." };
  }
}

export async function getNormalizedMonthlyExpenses(): Promise<
  ApiResponse<Array<{ expense: ExpenseWithDetails; monthlyAmount: number }>>
> {
  const ctx = await getSessionContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  try {
    return { success: true, data: await listNormalizedExpenses(ctx) };
  } catch (error) {
    logger.error(
      "Failed to get normalized monthly expenses",
      "getNormalizedMonthlyExpenses",
      error
    );
    return { success: false, error: "Normalisierte Ausgaben konnten nicht geladen werden." };
  }
}

export async function getSubscriptions(): Promise<
  ApiResponse<Array<{ expense: ExpenseWithDetails; monthlyAmount: number }>>
> {
  const ctx = await getSessionContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  try {
    return { success: true, data: await listNormalizedExpenses(ctx, { subscriptionsOnly: true }) };
  } catch (error) {
    logger.error("Failed to fetch subscriptions", "getSubscriptions", error);
    return { success: false, error: "Abonnements konnten nicht geladen werden." };
  }
}

export interface CalendarPayment {
  id: string;
  name: string;
  amount: number;
  type: "expense" | "daily_expense" | "income";
  category: {
    name: string | null;
    icon: string | null;
    color: string | null;
  } | null;
  isSubscription: boolean;
}

export interface CalendarDay {
  date: Date;
  dayOfMonth: number;
  isToday: boolean;
  isCurrentMonth: boolean;
  payments: CalendarPayment[];
}

export async function getMonthlyPaymentsCalendar(
  year: number,
  month: number
): Promise<ApiResponse<CalendarDay[]>> {
  const ctx = await getSessionContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  try {
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0));
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

    // Monday-first grid
    const firstDayOfMonth = monthStart.getUTCDay();
    const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const daysInCalendar = 42;
    const calendarDays: CalendarDay[] = [];

    const paymentsByDay = new Map<number, CalendarPayment[]>();
    for (const payment of await listScheduledPayments(ctx, monthStart, monthEnd)) {
      const day = payment.date.getUTCDate();
      paymentsByDay.set(day, [
        ...(paymentsByDay.get(day) ?? []),
        {
          id: payment.id,
          name: payment.name,
          amount: payment.amount,
          type: payment.type,
          category: payment.category,
          isSubscription: payment.isSubscription,
        },
      ]);
    }

    for (let i = 0; i < daysInCalendar; i++) {
      const currentDate = new Date(Date.UTC(year, month - 1, 1 - startOffset + i));
      const dayOfMonth = currentDate.getUTCDate();
      const isCurrentMonth = currentDate.getUTCMonth() === month - 1;

      calendarDays.push({
        date: currentDate,
        dayOfMonth,
        isToday: currentDate.getTime() === today,
        isCurrentMonth,
        payments: isCurrentMonth ? (paymentsByDay.get(dayOfMonth) ?? []) : [],
      });
    }

    return { success: true, data: calendarDays };
  } catch (error) {
    logger.error("Failed to fetch monthly payments calendar", "getMonthlyPaymentsCalendar", error);
    return { success: false, error: "Monatskalender konnte nicht geladen werden." };
  }
}
