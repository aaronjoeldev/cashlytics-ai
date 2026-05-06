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
import { safeParseFloat, toUTCDate } from "@/lib/safe-parse";
import { cookies } from "next/headers";
import { convertCurrency, defaultCurrency, currencies, type Currency } from "@/lib/currency";

/**
 * Reads the user's display (base) currency from the cookie set by SettingsProvider.
 * Falls back to defaultCurrency when the cookie is absent or invalid.
 */
async function getBaseCurrency(): Promise<Currency> {
  const cookieStore = await cookies();
  const value = cookieStore.get("currency")?.value;
  if (value && currencies.includes(value as Currency)) return value as Currency;
  return defaultCurrency;
}

/**
 * Converts an amount from `fromCurrency` to `baseCurrency`.
 * Returns the original amount unchanged when currencies match.
 */
function toBase(amount: number, fromCurrency: string | null | undefined, baseCurrency: Currency): number {
  const from = (fromCurrency && currencies.includes(fromCurrency as Currency))
    ? (fromCurrency as Currency)
    : baseCurrency;
  return convertCurrency(amount, from, baseCurrency);
}

function normalizeToMonthly(
  amount: number,
  recurrenceType: string,
  recurrenceInterval: number | null
): number {
  switch (recurrenceType) {
    case "daily":
      return amount * 30;
    case "weekly":
      return amount * 4.33;
    case "monthly":
      return amount;
    case "quarterly":
      return amount / 3;
    case "semiannual":
      return amount / 6;
    case "yearly":
      return amount / 12;
    case "custom":
      return recurrenceInterval ? amount / recurrenceInterval : amount;
    default:
      return 0;
  }
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

    const expensesWithDetails: ExpenseWithDetails[] = expensesResult.map((r) => ({
      ...r.expense,
      category: r.category,
      account: r.account,
    }));

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
          accountId ? eq(incomes.accountId, accountId) : undefined
        )
      );

    const incomesWithAccount: IncomeWithAccount[] = incomesResult.map((r) => ({
      ...r.income,
      account: r.account,
    }));

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
      const rawAmount = normalizeToMonthly(
        safeParseFloat(e.amount),
        e.recurrenceType,
        e.recurrenceInterval
      );
      return sum + toBase(rawAmount, e.currency, baseCurrency);
    }, 0);

    // Convert each daily expense to baseCurrency using the entry's own currency
    const totalDailyExpenses = dailyExpensesResult.reduce((sum, e) => {
      return sum + toBase(safeParseFloat(e.amount), e.entryCurrency, baseCurrency);
    }, 0);

    // Convert each income to baseCurrency using the entry's own currency
    const totalIncome = incomesWithAccount.reduce((sum, i) => {
      const rawAmount = safeParseFloat(i.amount);
      let normalizedAmount = 0;
      if (i.recurrenceType === "monthly") {
        normalizedAmount = rawAmount;
      } else if (i.recurrenceType === "yearly") {
        normalizedAmount = rawAmount / 12;
      } else if (i.recurrenceType === "once") {
        // Einmalige Einnahmen nur zählen wenn im abgefragten Monat
        const incomeDate = new Date(i.startDate);
        if (incomeDate >= startDate && incomeDate <= endDate) {
          normalizedAmount = rawAmount;
        }
      }
      return sum + toBase(normalizedAmount, i.currency, baseCurrency);
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
      const amount = toBase(safeParseFloat(item.dailyExpense.amount), item.dailyExpense.currency, baseCurrency);

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

    for (const item of periodicExpensesResult) {
      if (item.expense.recurrenceType === "once") continue;

      const categoryId = item.category?.id ?? "uncategorized-periodic";
      const rawMonthly = normalizeToMonthly(
        safeParseFloat(item.expense.amount),
        item.expense.recurrenceType,
        item.expense.recurrenceInterval
      );
      // Convert to baseCurrency using entry's own currency
      const monthlyAmount = toBase(rawMonthly, item.expense.currency, baseCurrency);

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

// ─── Chart-spezifische Actions ────────────────────────────────────────────────

const MONTH_NAMES_DE = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
];

function monthStart(year: number, month: number): Date {
  return new Date(year, month, 1, 0, 0, 0, 0);
}

function monthEnd(year: number, month: number): Date {
  return new Date(year, month + 1, 0, 23, 59, 59, 999);
}

interface MonthlyTrendEntry {
  month: string;
  income: number;
  expenses: number;
  savings: number;
}

interface CategoryExpense {
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string | null;
  total: number;
  percentage: number;
}

interface IncomeVsExpensesEntry {
  month: string;
  income: number;
  expenses: number;
}

interface SavingsProgress {
  totalIncome: number;
  totalExpenses: number;
  savingsAmount: number;
  savingsRate: number;
}

export async function getMonthlyTrend(
  months: number = 6
): Promise<ApiResponse<MonthlyTrendEntry[]>> {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  try {
    const baseCurrency = await getBaseCurrency();
    const now = new Date();
    const monthSlots = Array.from({ length: months }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

    const rangeStart = monthStart(monthSlots[0].year, monthSlots[0].month);
    const rangeEnd = monthEnd(
      monthSlots[monthSlots.length - 1].year,
      monthSlots[monthSlots.length - 1].month
    );

    const [allIncomes, allExpenses, allDailyExp] = await Promise.all([
      db
        .select({
          amount: incomes.amount,
          recurrenceType: incomes.recurrenceType,
          startDate: incomes.startDate,
          entryCurrency: incomes.currency,
        })
        .from(incomes)
        .where(and(lte(incomes.startDate, rangeEnd), eq(incomes.userId, userId))),
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
        .where(
          and(
            eq(expenses.userId, userId),
            lte(expenses.startDate, rangeEnd),
            sql`(${expenses.endDate} IS NULL OR ${expenses.endDate} >= ${rangeStart.toISOString()})`
          )
        ),
      db
        .select({ amount: dailyExpenses.amount, date: dailyExpenses.date, entryCurrency: dailyExpenses.currency })
        .from(dailyExpenses)
        .where(
          and(
            eq(dailyExpenses.userId, userId),
            gte(dailyExpenses.date, rangeStart),
            lte(dailyExpenses.date, rangeEnd)
          )
        ),
    ]);

    const data: MonthlyTrendEntry[] = monthSlots.map(({ year, month }) => {
      const start = monthStart(year, month);
      const end = monthEnd(year, month);

      let income = 0;
      for (const inc of allIncomes) {
        const incStart = new Date(inc.startDate);
        let rawAmount = 0;
        if (inc.recurrenceType === "once" && incStart >= start && incStart <= end) rawAmount = safeParseFloat(inc.amount);
        else if (inc.recurrenceType === "monthly" && incStart <= end) rawAmount = safeParseFloat(inc.amount);
        else if (inc.recurrenceType === "yearly" && incStart <= end) rawAmount = safeParseFloat(inc.amount) / 12;
        income += toBase(rawAmount, inc.entryCurrency, baseCurrency);
      }

      let periodicExp = 0;
      for (const exp of allExpenses) {
        const expStart = new Date(exp.startDate);
        const expEnd = exp.endDate ? new Date(exp.endDate) : null;
        if (!(expStart <= end && (expEnd === null || expEnd >= start))) continue;
        let rawAmount = 0;
        if (exp.recurrenceType === "once" && expStart >= start && expStart <= end)
          rawAmount = safeParseFloat(exp.amount);
        else if (exp.recurrenceType !== "once")
          rawAmount = normalizeToMonthly(
            safeParseFloat(exp.amount),
            exp.recurrenceType,
            exp.recurrenceInterval
          );
        periodicExp += toBase(rawAmount, exp.entryCurrency, baseCurrency);
      }

      const dailyTotal = allDailyExp
        .filter((de) => {
          const d = new Date(de.date);
          return d >= start && d <= end;
        })
        .reduce((sum, de) => sum + toBase(safeParseFloat(de.amount), de.entryCurrency, baseCurrency), 0);

      const totalExp = Math.round((periodicExp + dailyTotal) * 100) / 100;
      const totalInc = Math.round(income * 100) / 100;
      return {
        month: MONTH_NAMES_DE[month],
        income: totalInc,
        expenses: totalExp,
        savings: Math.round((totalInc - totalExp) * 100) / 100,
      };
    });

    return { success: true, data };
  } catch (error) {
    logger.error("Failed to fetch monthly trend", "getMonthlyTrend", error);
    return { success: false, error: "Monatstrend konnte nicht geladen werden." };
  }
}

export async function getExpensesByCategory(
  year?: number,
  month?: number
): Promise<ApiResponse<CategoryExpense[]>> {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  try {
    const baseCurrency = await getBaseCurrency();
    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    const targetMonth = month !== undefined ? month : now.getMonth();
    const start = monthStart(targetYear, targetMonth);
    const end = monthEnd(targetYear, targetMonth);

    const rows = await db
      .select({
        categoryId: dailyExpenses.categoryId,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        amount: dailyExpenses.amount,
        entryCurrency: dailyExpenses.currency,
      })
      .from(dailyExpenses)
      .leftJoin(categories, sql`${dailyExpenses.categoryId} = ${categories.id}`)
      .where(
        and(
          eq(dailyExpenses.userId, userId),
          gte(dailyExpenses.date, start),
          lte(dailyExpenses.date, end)
        )
      );

    // Aggregate per category in JS with currency conversion
    const categoryMap = new Map<string, { categoryName: string; categoryIcon: string | null; total: number }>();
    for (const row of rows) {
      const catId = row.categoryId ?? "uncategorized";
      const converted = toBase(safeParseFloat(row.amount), row.entryCurrency, baseCurrency);
      if (categoryMap.has(catId)) {
        categoryMap.get(catId)!.total += converted;
      } else {
        categoryMap.set(catId, {
          categoryName: row.categoryName || "Sonstiges",
          categoryIcon: row.categoryIcon,
          total: converted,
        });
      }
    }

    const grandTotal = Array.from(categoryMap.values()).reduce((sum, c) => sum + c.total, 0);
    const data = Array.from(categoryMap.entries())
      .map(([categoryId, c]) => ({
        categoryId,
        categoryName: c.categoryName,
        categoryIcon: c.categoryIcon,
        total: Math.round(c.total * 100) / 100,
        percentage: grandTotal > 0 ? Math.round((c.total / grandTotal) * 10000) / 100 : 0,
      }))
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total);

    return { success: true, data };
  } catch (error) {
    logger.error("Failed to fetch expenses by category", "getExpensesByCategory", error);
    return { success: false, error: "Kategorie-Auswertung konnte nicht geladen werden." };
  }
}

export async function getIncomeVsExpensesByMonth(
  year?: number
): Promise<ApiResponse<IncomeVsExpensesEntry[]>> {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  try {
    const baseCurrency = await getBaseCurrency();
    const targetYear = year ?? new Date().getFullYear();
    const yearStart = monthStart(targetYear, 0);
    const yearEnd = monthEnd(targetYear, 11);

    const [allIncomes, allExpenses, allDailyExp] = await Promise.all([
      db
        .select({
          amount: incomes.amount,
          recurrenceType: incomes.recurrenceType,
          startDate: incomes.startDate,
          entryCurrency: incomes.currency,
        })
        .from(incomes)
        .where(and(lte(incomes.startDate, yearEnd), eq(incomes.userId, userId))),
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
        .where(
          and(
            eq(expenses.userId, userId),
            lte(expenses.startDate, yearEnd),
            sql`(${expenses.endDate} IS NULL OR ${expenses.endDate} >= ${yearStart.toISOString()})`
          )
        ),
      db
        .select({ amount: dailyExpenses.amount, date: dailyExpenses.date, entryCurrency: dailyExpenses.currency })
        .from(dailyExpenses)
        .where(
          and(
            eq(dailyExpenses.userId, userId),
            gte(dailyExpenses.date, yearStart),
            lte(dailyExpenses.date, yearEnd)
          )
        ),
    ]);

    const data: IncomeVsExpensesEntry[] = Array.from({ length: 12 }, (_, monthIndex) => {
      const start = monthStart(targetYear, monthIndex);
      const end = monthEnd(targetYear, monthIndex);

      let income = 0;
      for (const inc of allIncomes) {
        const incStart = new Date(inc.startDate);
        let rawAmount = 0;
        if (inc.recurrenceType === "once" && incStart >= start && incStart <= end) rawAmount = safeParseFloat(inc.amount);
        else if (inc.recurrenceType === "monthly" && incStart <= end) rawAmount = safeParseFloat(inc.amount);
        else if (inc.recurrenceType === "yearly" && incStart <= end) rawAmount = safeParseFloat(inc.amount) / 12;
        income += toBase(rawAmount, inc.entryCurrency, baseCurrency);
      }

      let periodicExp = 0;
      for (const exp of allExpenses) {
        const expStart = new Date(exp.startDate);
        const expEnd = exp.endDate ? new Date(exp.endDate) : null;
        if (!(expStart <= end && (expEnd === null || expEnd >= start))) continue;
        let rawAmount = 0;
        if (exp.recurrenceType === "once" && expStart >= start && expStart <= end)
          rawAmount = safeParseFloat(exp.amount);
        else if (exp.recurrenceType !== "once")
          rawAmount = normalizeToMonthly(
            safeParseFloat(exp.amount),
            exp.recurrenceType,
            exp.recurrenceInterval
          );
        periodicExp += toBase(rawAmount, exp.entryCurrency, baseCurrency);
      }

      const dailyTotal = allDailyExp
        .filter((de) => {
          const d = new Date(de.date);
          return d >= start && d <= end;
        })
        .reduce((sum, de) => sum + toBase(safeParseFloat(de.amount), de.entryCurrency, baseCurrency), 0);

      return {
        month: MONTH_NAMES_DE[monthIndex],
        income: Math.round(income * 100) / 100,
        expenses: Math.round((periodicExp + dailyTotal) * 100) / 100,
      };
    });

    return { success: true, data };
  } catch (error) {
    logger.error(
      "Failed to fetch income vs expenses by month",
      "getIncomeVsExpensesByMonth",
      error
    );
    return { success: false, error: "Jahresübersicht konnte nicht geladen werden." };
  }
}

export async function getSavingsProgress(): Promise<ApiResponse<SavingsProgress>> {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  try {
    const baseCurrency = await getBaseCurrency();
    const now = new Date();
    const start = monthStart(now.getFullYear(), now.getMonth());
    const end = monthEnd(now.getFullYear(), now.getMonth());

    const [activeIncomes, activeExpenses, dailyRows] = await Promise.all([
      db
        .select({
          amount: incomes.amount,
          recurrenceType: incomes.recurrenceType,
          startDate: incomes.startDate,
          entryCurrency: incomes.currency,
        })
        .from(incomes)
        .where(and(lte(incomes.startDate, end), eq(incomes.userId, userId))),
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
        .where(
          and(
            eq(expenses.userId, userId),
            lte(expenses.startDate, end),
            sql`(${expenses.endDate} IS NULL OR ${expenses.endDate} >= ${start.toISOString()})`
          )
        ),
      db
        .select({ amount: dailyExpenses.amount, entryCurrency: dailyExpenses.currency })
        .from(dailyExpenses)
        .where(
          and(
            eq(dailyExpenses.userId, userId),
            gte(dailyExpenses.date, start),
            lte(dailyExpenses.date, end)
          )
        ),
    ]);

    let totalIncome = 0;
    for (const inc of activeIncomes) {
      const incStart = new Date(inc.startDate);
      let rawAmount = 0;
      if (inc.recurrenceType === "once" && incStart >= start && incStart <= end)
        rawAmount = safeParseFloat(inc.amount);
      else if (inc.recurrenceType === "monthly") rawAmount = safeParseFloat(inc.amount);
      else if (inc.recurrenceType === "yearly") rawAmount = safeParseFloat(inc.amount) / 12;
      totalIncome += toBase(rawAmount, inc.entryCurrency, baseCurrency);
    }

    let periodicExp = 0;
    for (const exp of activeExpenses) {
      const expStart = new Date(exp.startDate);
      const expEnd = exp.endDate ? new Date(exp.endDate) : null;
      if (!(expStart <= end && (expEnd === null || expEnd >= start))) continue;
      let rawAmount = 0;
      if (exp.recurrenceType === "once" && expStart >= start && expStart <= end)
        rawAmount = safeParseFloat(exp.amount);
      else if (exp.recurrenceType !== "once")
        rawAmount = normalizeToMonthly(
          safeParseFloat(exp.amount),
          exp.recurrenceType,
          exp.recurrenceInterval
        );
      periodicExp += toBase(rawAmount, exp.entryCurrency, baseCurrency);
    }

    const dailyTotal = dailyRows.reduce(
      (sum, de) => sum + toBase(safeParseFloat(de.amount), de.entryCurrency, baseCurrency),
      0
    );
    const roundedIncome = Math.round(totalIncome * 100) / 100;
    const totalExpenses = Math.round((periodicExp + dailyTotal) * 100) / 100;
    const savingsAmount = Math.round((roundedIncome - totalExpenses) * 100) / 100;
    const savingsRate =
      roundedIncome > 0 ? Math.round((savingsAmount / roundedIncome) * 10000) / 100 : 0;

    return {
      success: true,
      data: { totalIncome: roundedIncome, totalExpenses, savingsAmount, savingsRate },
    };
  } catch (error) {
    logger.error("Failed to fetch savings progress", "getSavingsProgress", error);
    return { success: false, error: "Sparfortschritt konnte nicht geladen werden." };
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

function getPaymentDatesInMonth(
  startDate: Date,
  recurrenceType: string,
  recurrenceInterval: number | null,
  monthStart: Date,
  monthEnd: Date
): Date[] {
  const dates: Date[] = [];
  const start = toUTCDate(startDate);
  const paymentDay = Math.min(
    start.getDate(),
    new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate()
  );

  switch (recurrenceType) {
    case "daily": {
      for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
        if (d >= start) {
          dates.push(new Date(d));
        }
      }
      break;
    }
    case "weekly": {
      const startDay = start.getDay();
      for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
        if (d >= start && d.getDay() === startDay) {
          dates.push(new Date(d));
        }
      }
      break;
    }
    case "monthly": {
      const paymentDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), paymentDay);
      if (paymentDate >= start && paymentDate >= monthStart && paymentDate <= monthEnd) {
        dates.push(paymentDate);
      }
      break;
    }
    case "quarterly": {
      const monthDiff = (monthStart.getMonth() - start.getMonth() + 12) % 3;
      if (monthDiff === 0) {
        const paymentDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), paymentDay);
        if (paymentDate >= start && paymentDate >= monthStart && paymentDate <= monthEnd) {
          dates.push(paymentDate);
        }
      }
      break;
    }
    case "semiannual": {
      const monthsDiff =
        (monthStart.getFullYear() - start.getFullYear()) * 12 +
        (monthStart.getMonth() - start.getMonth());
      if (monthsDiff >= 0 && monthsDiff % 6 === 0) {
        const paymentDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), paymentDay);
        if (paymentDate >= start && paymentDate >= monthStart && paymentDate <= monthEnd) {
          dates.push(paymentDate);
        }
      }
      break;
    }
    case "yearly": {
      if (monthStart.getMonth() === start.getMonth()) {
        const paymentDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), paymentDay);
        if (paymentDate >= start && paymentDate >= monthStart && paymentDate <= monthEnd) {
          dates.push(paymentDate);
        }
      }
      break;
    }
    case "custom": {
      if (recurrenceInterval) {
        const monthsDiff =
          (monthStart.getFullYear() - start.getFullYear()) * 12 +
          (monthStart.getMonth() - start.getMonth());
        if (monthsDiff >= 0 && monthsDiff % recurrenceInterval === 0) {
          const paymentDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), paymentDay);
          if (paymentDate >= start && paymentDate >= monthStart && paymentDate <= monthEnd) {
            dates.push(paymentDate);
          }
        }
      }
      break;
    }
    case "once": {
      if (start >= monthStart && start <= monthEnd) {
        dates.push(start);
      }
      break;
    }
  }

  return dates;
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayOfMonth = monthStart.getDay();
    const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    const calendarStart = new Date(monthStart);
    calendarStart.setDate(calendarStart.getDate() - startOffset);

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
        .where(and(eq(incomes.userId, userId), lte(incomes.startDate, monthEnd))),
    ]);

    for (let i = 0; i < daysInCalendar; i++) {
      const currentDate = new Date(calendarStart);
      currentDate.setDate(calendarStart.getDate() + i);
      currentDate.setHours(0, 0, 0, 0);

      const dayOfMonth = currentDate.getDate();
      const isCurrentMonth = currentDate.getMonth() === month - 1;
      const isToday = currentDate.getTime() === today.getTime();

      const payments: CalendarPayment[] = [];

      if (isCurrentMonth) {
        for (const item of expensesResult) {
          const expenseStart = new Date(item.expense.startDate);
          if (expenseStart > monthEnd) continue;

          const paymentDates = getPaymentDatesInMonth(
            expenseStart,
            item.expense.recurrenceType,
            item.expense.recurrenceInterval,
            monthStart,
            monthEnd
          );

          for (const paymentDate of paymentDates) {
            if (paymentDate.toDateString() === currentDate.toDateString()) {
              payments.push({
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
        }

        for (const item of dailyExpensesResult) {
          const expDate = new Date(item.dailyExpense.date);
          expDate.setHours(0, 0, 0, 0);

          if (expDate.toDateString() === currentDate.toDateString()) {
            payments.push({
              id: item.dailyExpense.id,
              name: item.dailyExpense.description,
              amount: toBase(safeParseFloat(item.dailyExpense.amount), item.dailyExpense.currency, baseCurrency),
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
        }

        for (const item of incomesResult) {
          const incomeStart = new Date(item.income.startDate);

          if (item.income.recurrenceType === "once") {
            if (incomeStart.toDateString() === currentDate.toDateString()) {
              payments.push({
                id: item.income.id,
                name: item.income.source,
                amount: toBase(safeParseFloat(item.income.amount), item.income.currency, baseCurrency),
                type: "income",
                category: null,
                isSubscription: false,
              });
            }
          } else if (item.income.recurrenceType === "monthly") {
            const paymentDay = Math.min(
              incomeStart.getDate(),
              new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
            );
            if (dayOfMonth === paymentDay && incomeStart <= currentDate) {
              payments.push({
                id: item.income.id,
                name: item.income.source,
                amount: toBase(safeParseFloat(item.income.amount), item.income.currency, baseCurrency),
                type: "income",
                category: null,
                isSubscription: false,
              });
            }
          } else if (item.income.recurrenceType === "yearly") {
            const paymentDay = Math.min(
              incomeStart.getDate(),
              new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
            );
            if (
              currentDate.getMonth() === incomeStart.getMonth() &&
              dayOfMonth === paymentDay &&
              incomeStart <= currentDate
            ) {
              payments.push({
                id: item.income.id,
                name: item.income.source,
                amount: toBase(safeParseFloat(item.income.amount), item.income.currency, baseCurrency),
                type: "income",
                category: null,
                isSubscription: false,
              });
            }
          }
        }
      }

      calendarDays.push({
        date: currentDate,
        dayOfMonth,
        isToday,
        isCurrentMonth,
        payments,
      });
    }

    return { success: true, data: calendarDays };
  } catch (error) {
    logger.error("Failed to fetch monthly payments calendar", "getMonthlyPaymentsCalendar", error);
    return { success: false, error: "Monatskalender konnte nicht geladen werden." };
  }
}
