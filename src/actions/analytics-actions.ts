"use server";

import { db } from "@/lib/db";
import { expenses, incomes, dailyExpenses, categories, accounts } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/require-auth";
import type {
  ApiResponse,
  MonthlyOverview,
  Forecast,
  CategoryBreakdown,
  ExpenseWithDetails,
  IncomeWithAccount,
} from "@/types/database";
import { safeParseFloat } from "@/lib/safe-parse";
import {
  countOccurrencesInMonth,
  getBudgetedAmountForMonth,
  getOccurrencesInMonth,
  normalizeToMonthly,
  type RecurringItem,
} from "@/lib/recurrence";
import { getBaseCurrency } from "@/lib/user-preferences";
import { convertCurrency, currencies, type Currency } from "@/lib/currency";

/**
 * Converts an amount from `fromCurrency` to `baseCurrency`.
 * Returns the original amount unchanged when currencies match.
 */
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

export async function getMonthlyOverview(
  month: number,
  year: number,
  accountId?: string
): Promise<ApiResponse<MonthlyOverview>> {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  try {
    const baseCurrency = await getBaseCurrency();
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59));

    const expensesResult = await db
      .select({
        expense: expenses,
        category: categories,
        account: accounts,
      })
      .from(expenses)
      .leftJoin(categories, eq(expenses.categoryId, categories.id))
      .leftJoin(accounts, eq(expenses.accountId, accounts.id))
      .where(
        and(
          eq(expenses.userId, userId),
          lte(expenses.startDate, endDate),
          sql`(${expenses.endDate} IS NULL OR ${expenses.endDate} >= ${startDate.toISOString()})`,
          accountId ? eq(expenses.accountId, accountId) : undefined
        )
      );

    // One-time entries belong only to the month they are dated in
    const isRelevantInMonth = (item: RecurringItem) =>
      item.recurrenceType !== "once" || countOccurrencesInMonth(item, year, month) > 0;

    const expensesWithDetails: ExpenseWithDetails[] = expensesResult
      .map((r) => ({
        ...r.expense,
        category: r.category,
        account: r.account,
      }))
      .filter(isRelevantInMonth);

    const incomesResult = await db
      .select({
        income: incomes,
        account: accounts,
      })
      .from(incomes)
      .leftJoin(accounts, eq(incomes.accountId, accounts.id))
      .where(
        and(
          eq(incomes.userId, userId),
          lte(incomes.startDate, endDate),
          sql`(${incomes.endDate} IS NULL OR ${incomes.endDate} >= ${startDate.toISOString()})`,
          accountId ? eq(incomes.accountId, accountId) : undefined
        )
      );

    const incomesWithAccount: IncomeWithAccount[] = incomesResult
      .map((r) => ({
        ...r.income,
        account: r.account,
      }))
      .filter(isRelevantInMonth);

    const dailyExpensesResult = await db
      .select({
        amount: dailyExpenses.amount,
        entryCurrency: dailyExpenses.currency,
      })
      .from(dailyExpenses)
      .where(
        and(
          eq(dailyExpenses.userId, userId),
          gte(dailyExpenses.date, startDate),
          lte(dailyExpenses.date, endDate),
          accountId ? eq(dailyExpenses.accountId, accountId) : undefined
        )
      );

    // Convert each expense to baseCurrency using the entry's own currency
    const totalMonthlyExpenses = expensesWithDetails.reduce((sum, e) => {
      const rawAmount = getBudgetedAmountForMonth(e, safeParseFloat(e.amount), year, month);
      return sum + toBase(rawAmount, e.currency, baseCurrency);
    }, 0);

    // Convert each daily expense to baseCurrency using the entry's own currency
    const totalDailyExpenses = dailyExpensesResult.reduce((sum, e) => {
      return sum + toBase(safeParseFloat(e.amount), e.entryCurrency, baseCurrency);
    }, 0);

    // Convert each income to baseCurrency using the entry's own currency
    const totalIncome = incomesWithAccount.reduce((sum, i) => {
      const rawAmount = getBudgetedAmountForMonth(i, safeParseFloat(i.amount), year, month);
      return sum + toBase(rawAmount, i.currency, baseCurrency);
    }, 0);

    const totalExpenses = totalMonthlyExpenses + totalDailyExpenses;
    const balance = totalIncome - totalExpenses;

    return {
      success: true,
      data: {
        month,
        year,
        totalIncome,
        totalExpenses,
        balance,
        expenses: expensesWithDetails,
        incomes: incomesWithAccount,
      },
    };
  } catch (error) {
    logger.error("Failed to get monthly overview", "getMonthlyOverview", error);
    return { success: false, error: "Monatsübersicht konnte nicht geladen werden." };
  }
}

export async function getForecast(months: number): Promise<ApiResponse<Forecast>> {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };

  try {
    const now = new Date();

    const monthTargets = Array.from({ length: months }, (_, i) => {
      const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      return { month: targetDate.getMonth() + 1, year: targetDate.getFullYear() };
    });

    const results = await Promise.all(
      monthTargets.map(({ month, year }) => getMonthlyOverview(month, year))
    );

    let totalProjectedIncome = 0;
    let totalProjectedExpenses = 0;
    const monthlyDetails: Forecast["monthlyDetails"] = [];

    for (let i = 0; i < months; i++) {
      const overviewResult = results[i];
      if (overviewResult.success && overviewResult.data) {
        const overview = overviewResult.data;
        monthlyDetails.push({
          month: monthTargets[i].month,
          year: monthTargets[i].year,
          income: overview.totalIncome,
          expenses: overview.totalExpenses,
          balance: overview.balance,
        });
        totalProjectedIncome += overview.totalIncome;
        totalProjectedExpenses += overview.totalExpenses;
      }
    }

    return {
      success: true,
      data: {
        months,
        projectedIncome: totalProjectedIncome,
        projectedExpenses: totalProjectedExpenses,
        projectedBalance: totalProjectedIncome - totalProjectedExpenses,
        monthlyDetails,
      },
    };
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
    const baseCurrency = await getBaseCurrency();
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
        baseCurrency
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
      const monthlyAmount = toBase(rawAmount, item.expense.currency, baseCurrency);

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
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  try {
    const expensesResult = await db
      .select({
        expense: expenses,
        category: categories,
        account: accounts,
      })
      .from(expenses)
      .leftJoin(categories, eq(expenses.categoryId, categories.id))
      .leftJoin(accounts, eq(expenses.accountId, accounts.id))
      .where(eq(expenses.userId, userId));

    const baseCurrency = await getBaseCurrency();

    const normalizedExpenses = expensesResult.map((r) => {
      const expenseWithDetails: ExpenseWithDetails = {
        ...r.expense,
        category: r.category,
        account: r.account,
      };

      const rawMonthly = normalizeToMonthly(
        safeParseFloat(r.expense.amount),
        r.expense.recurrenceType,
        r.expense.recurrenceInterval
      );
      const monthlyAmount = toBase(rawMonthly, r.expense.currency, baseCurrency);

      return {
        expense: expenseWithDetails,
        monthlyAmount,
      };
    });

    return { success: true, data: normalizedExpenses };
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
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  try {
    const expensesResult = await db
      .select({
        expense: expenses,
        category: categories,
        account: accounts,
      })
      .from(expenses)
      .leftJoin(categories, eq(expenses.categoryId, categories.id))
      .leftJoin(accounts, eq(expenses.accountId, accounts.id))
      .where(and(eq(expenses.isSubscription, true), eq(expenses.userId, userId)));

    const baseCurrency = await getBaseCurrency();

    const subscriptions = expensesResult.map((r) => {
      const expenseWithDetails: ExpenseWithDetails = {
        ...r.expense,
        category: r.category,
        account: r.account,
      };

      const rawMonthly = normalizeToMonthly(
        safeParseFloat(r.expense.amount),
        r.expense.recurrenceType,
        r.expense.recurrenceInterval
      );
      const monthlyAmount = toBase(rawMonthly, r.expense.currency, baseCurrency);

      return {
        expense: expenseWithDetails,
        monthlyAmount,
      };
    });

    return { success: true, data: subscriptions };
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
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  try {
    const baseCurrency = await getBaseCurrency();
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59));
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

    // Monday-first grid
    const firstDayOfMonth = monthStart.getUTCDay();
    const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const daysInCalendar = 42;
    const calendarDays: CalendarDay[] = [];

    const [expensesResult, dailyExpensesResult, incomesResult] = await Promise.all([
      db
        .select({
          expense: expenses,
          category: categories,
        })
        .from(expenses)
        .leftJoin(categories, eq(expenses.categoryId, categories.id))
        .where(
          and(
            eq(expenses.userId, userId),
            lte(expenses.startDate, monthEnd),
            sql`(${expenses.endDate} IS NULL OR ${expenses.endDate} >= ${monthStart.toISOString()})`
          )
        ),
      db
        .select({
          dailyExpense: dailyExpenses,
          category: categories,
        })
        .from(dailyExpenses)
        .leftJoin(categories, eq(dailyExpenses.categoryId, categories.id))
        .where(
          and(
            eq(dailyExpenses.userId, userId),
            gte(dailyExpenses.date, monthStart),
            lte(dailyExpenses.date, monthEnd)
          )
        ),
      db
        .select({
          income: incomes,
        })
        .from(incomes)
        .where(
          and(
            eq(incomes.userId, userId),
            lte(incomes.startDate, monthEnd),
            sql`(${incomes.endDate} IS NULL OR ${incomes.endDate} >= ${monthStart.toISOString()})`
          )
        ),
    ]);

    const paymentsByDay = new Map<number, CalendarPayment[]>();
    const addPayment = (date: Date, payment: CalendarPayment) => {
      const day = new Date(date).getUTCDate();
      paymentsByDay.set(day, [...(paymentsByDay.get(day) ?? []), payment]);
    };

    for (const item of expensesResult) {
      for (const paymentDate of getOccurrencesInMonth(item.expense, year, month)) {
        addPayment(paymentDate, {
          id: item.expense.id,
          name: item.expense.name,
          amount: toBase(safeParseFloat(item.expense.amount), item.expense.currency, baseCurrency),
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

    for (const item of dailyExpensesResult) {
      addPayment(item.dailyExpense.date, {
        id: item.dailyExpense.id,
        name: item.dailyExpense.description,
        amount: toBase(
          safeParseFloat(item.dailyExpense.amount),
          item.dailyExpense.currency,
          baseCurrency
        ),
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

    for (const item of incomesResult) {
      for (const paymentDate of getOccurrencesInMonth(item.income, year, month)) {
        addPayment(paymentDate, {
          id: item.income.id,
          name: item.income.source,
          amount: toBase(safeParseFloat(item.income.amount), item.income.currency, baseCurrency),
          type: "income",
          category: null,
          isSubscription: false,
        });
      }
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
