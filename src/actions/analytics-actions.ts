'use server';

import { db } from '@/lib/db';
import { expenses, incomes, dailyExpenses, categories, accounts } from '@/lib/db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import type { ApiResponse, MonthlyOverview, Forecast, CategoryBreakdown, ExpenseWithDetails, IncomeWithAccount } from '@/types/database';

function normalizeToMonthly(amount: number, recurrenceType: string, recurrenceInterval: number | null): number {
  switch (recurrenceType) {
    case 'daily':
      return amount * 30;
    case 'weekly':
      return amount * 4.33;
    case 'monthly':
      return amount;
    case 'quarterly':
      return amount / 3;
    case 'yearly':
      return amount / 12;
    case 'custom':
      return recurrenceInterval ? amount / recurrenceInterval : amount;
    default:
      return 0;
  }
}

export async function getMonthlyOverview(
  month: number,
  year: number
): Promise<ApiResponse<MonthlyOverview>> {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

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
          lte(expenses.startDate, endDate),
          sql`(${expenses.endDate} IS NULL OR ${expenses.endDate} >= ${startDate.toISOString()})`
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
        lte(incomes.startDate, endDate)
      );

    const incomesWithAccount: IncomeWithAccount[] = incomesResult.map((r) => ({
      ...r.income,
      account: r.account,
    }));

    const dailyExpensesResult = await db
      .select({
        amount: dailyExpenses.amount,
      })
      .from(dailyExpenses)
      .where(
        and(
          gte(dailyExpenses.date, startDate),
          lte(dailyExpenses.date, endDate)
        )
      );

    const totalMonthlyExpenses = expensesWithDetails.reduce((sum, e) => {
      return sum + normalizeToMonthly(
        parseFloat(e.amount),
        e.recurrenceType,
        e.recurrenceInterval
      );
    }, 0);

    const totalDailyExpenses = dailyExpensesResult.reduce((sum, e) => {
      return sum + parseFloat(e.amount);
    }, 0);

    const totalIncome = incomesWithAccount.reduce((sum, i) => {
      const amount = parseFloat(i.amount);
      if (i.recurrenceType === 'monthly') {
        return sum + amount;
      }
      if (i.recurrenceType === 'yearly') {
        return sum + amount / 12;
      }
      if (i.recurrenceType === 'once') {
        // Einmalige Einnahmen nur zählen wenn im abgefragten Monat
        const incomeDate = new Date(i.startDate);
        if (incomeDate >= startDate && incomeDate <= endDate) {
          return sum + amount;
        }
      }
      return sum;
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
    console.error('Failed to get monthly overview:', error);
    return { success: false, error: 'Monatsübersicht konnte nicht geladen werden.' };
  }
}

export async function getForecast(months: number): Promise<ApiResponse<Forecast>> {
  try {
    const now = new Date();
    const monthlyDetails: Forecast['monthlyDetails'] = [];

    let totalProjectedIncome = 0;
    let totalProjectedExpenses = 0;

    for (let i = 0; i < months; i++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const month = targetDate.getMonth() + 1;
      const year = targetDate.getFullYear();

      const overviewResult = await getMonthlyOverview(month, year);

      if (overviewResult.success && overviewResult.data) {
        const overview = overviewResult.data;
        monthlyDetails.push({
          month,
          year,
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
    console.error('Failed to get forecast:', error);
    return { success: false, error: 'Prognose konnte nicht erstellt werden.' };
  }
}

export async function getCategoryBreakdown(
  startDate: Date,
  endDate: Date
): Promise<ApiResponse<CategoryBreakdown[]>> {
  try {
    const dailyExpensesResult = await db
      .select({
        dailyExpense: dailyExpenses,
        category: categories,
      })
      .from(dailyExpenses)
      .leftJoin(categories, eq(dailyExpenses.categoryId, categories.id))
      .where(
        and(
          gte(dailyExpenses.date, startDate),
          lte(dailyExpenses.date, endDate)
        )
      );

    const categoryMap = new Map<string, { category: typeof categories.$inferSelect | null; amount: number }>();

    for (const item of dailyExpensesResult) {
      const categoryId = item.category?.id ?? 'uncategorized';
      const amount = parseFloat(item.dailyExpense.amount);

      if (categoryMap.has(categoryId)) {
        const existing = categoryMap.get(categoryId)!;
        existing.amount += amount;
      } else {
        categoryMap.set(categoryId, { category: item.category, amount });
      }
    }

    const totalAmount = Array.from(categoryMap.values()).reduce((sum, c) => sum + c.amount, 0);

    const breakdown: CategoryBreakdown[] = Array.from(categoryMap.values())
      .map((c) => ({
        category: c.category ?? {
          id: 'uncategorized',
          name: 'Ohne Kategorie',
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
    console.error('Failed to get category breakdown:', error);
    return { success: false, error: 'Kategorie-Übersicht konnte nicht geladen werden.' };
  }
}

export async function getNormalizedMonthlyExpenses(): Promise<
  ApiResponse<Array<{ expense: ExpenseWithDetails; monthlyAmount: number }>>
> {
  try {
    const expensesResult = await db
      .select({
        expense: expenses,
        category: categories,
        account: accounts,
      })
      .from(expenses)
      .leftJoin(categories, eq(expenses.categoryId, categories.id))
      .leftJoin(accounts, eq(expenses.accountId, accounts.id));

    const normalizedExpenses = expensesResult.map((r) => {
      const expenseWithDetails: ExpenseWithDetails = {
        ...r.expense,
        category: r.category,
        account: r.account,
      };

      const monthlyAmount = normalizeToMonthly(
        parseFloat(r.expense.amount),
        r.expense.recurrenceType,
        r.expense.recurrenceInterval
      );

      return {
        expense: expenseWithDetails,
        monthlyAmount,
      };
    });

    return { success: true, data: normalizedExpenses };
  } catch (error) {
    console.error('Failed to get normalized monthly expenses:', error);
    return { success: false, error: 'Normalisierte Ausgaben konnten nicht geladen werden.' };
  }
}

// ─── Chart-spezifische Actions ────────────────────────────────────────────────

const MONTH_NAMES_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

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

export async function getMonthlyTrend(months: number = 6): Promise<ApiResponse<MonthlyTrendEntry[]>> {
  try {
    const now = new Date();
    const monthSlots = Array.from({ length: months }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

    const rangeStart = monthStart(monthSlots[0].year, monthSlots[0].month);
    const rangeEnd = monthEnd(monthSlots[monthSlots.length - 1].year, monthSlots[monthSlots.length - 1].month);

    const [allIncomes, allExpenses, allDailyExp] = await Promise.all([
      db.select({ amount: incomes.amount, recurrenceType: incomes.recurrenceType, startDate: incomes.startDate })
        .from(incomes).where(lte(incomes.startDate, rangeEnd)),
      db.select({ amount: expenses.amount, recurrenceType: expenses.recurrenceType, recurrenceInterval: expenses.recurrenceInterval, startDate: expenses.startDate, endDate: expenses.endDate })
        .from(expenses).where(and(lte(expenses.startDate, rangeEnd), sql`(${expenses.endDate} IS NULL OR ${expenses.endDate} >= ${rangeStart.toISOString()})`)),
      db.select({ amount: dailyExpenses.amount, date: dailyExpenses.date })
        .from(dailyExpenses).where(and(gte(dailyExpenses.date, rangeStart), lte(dailyExpenses.date, rangeEnd))),
    ]);

    const data: MonthlyTrendEntry[] = monthSlots.map(({ year, month }) => {
      const start = monthStart(year, month);
      const end = monthEnd(year, month);

      let income = 0;
      for (const inc of allIncomes) {
        const amount = parseFloat(inc.amount);
        const incStart = new Date(inc.startDate);
        if (inc.recurrenceType === 'once' && incStart >= start && incStart <= end) income += amount;
        else if (inc.recurrenceType === 'monthly' && incStart <= end) income += amount;
        else if (inc.recurrenceType === 'yearly' && incStart <= end) income += amount / 12;
      }

      let periodicExp = 0;
      for (const exp of allExpenses) {
        const expStart = new Date(exp.startDate);
        const expEnd = exp.endDate ? new Date(exp.endDate) : null;
        if (!(expStart <= end && (expEnd === null || expEnd >= start))) continue;
        if (exp.recurrenceType === 'once' && expStart >= start && expStart <= end) periodicExp += parseFloat(exp.amount);
        else if (exp.recurrenceType !== 'once') periodicExp += normalizeToMonthly(parseFloat(exp.amount), exp.recurrenceType, exp.recurrenceInterval);
      }

      const dailyTotal = allDailyExp
        .filter(de => { const d = new Date(de.date); return d >= start && d <= end; })
        .reduce((sum, de) => sum + parseFloat(de.amount), 0);

      const totalExp = Math.round((periodicExp + dailyTotal) * 100) / 100;
      const totalInc = Math.round(income * 100) / 100;
      return { month: MONTH_NAMES_DE[month], income: totalInc, expenses: totalExp, savings: Math.round((totalInc - totalExp) * 100) / 100 };
    });

    return { success: true, data };
  } catch (error) {
    console.error('Failed to fetch monthly trend:', error);
    return { success: false, error: 'Monatstrend konnte nicht geladen werden.' };
  }
}

export async function getExpensesByCategory(year?: number, month?: number): Promise<ApiResponse<CategoryExpense[]>> {
  try {
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
        total: sql<string>`COALESCE(SUM(${dailyExpenses.amount}), 0)`,
      })
      .from(dailyExpenses)
      .leftJoin(categories, sql`${dailyExpenses.categoryId} = ${categories.id}`)
      .where(and(gte(dailyExpenses.date, start), lte(dailyExpenses.date, end)))
      .groupBy(dailyExpenses.categoryId, categories.name, categories.icon)
      .orderBy(sql`SUM(${dailyExpenses.amount}) DESC`);

    const grandTotal = rows.reduce((sum, r) => sum + parseFloat(r.total || '0'), 0);
    const data = rows
      .map(r => ({
        categoryId: r.categoryId,
        categoryName: r.categoryName || 'Sonstiges',
        categoryIcon: r.categoryIcon,
        total: Math.round(parseFloat(r.total || '0') * 100) / 100,
        percentage: grandTotal > 0 ? Math.round((parseFloat(r.total || '0') / grandTotal) * 10000) / 100 : 0,
      }))
      .filter(r => r.total > 0);

    return { success: true, data };
  } catch (error) {
    console.error('Failed to fetch expenses by category:', error);
    return { success: false, error: 'Kategorie-Auswertung konnte nicht geladen werden.' };
  }
}

export async function getIncomeVsExpensesByMonth(year?: number): Promise<ApiResponse<IncomeVsExpensesEntry[]>> {
  try {
    const targetYear = year ?? new Date().getFullYear();
    const yearStart = monthStart(targetYear, 0);
    const yearEnd = monthEnd(targetYear, 11);

    const [allIncomes, allExpenses, allDailyExp] = await Promise.all([
      db.select({ amount: incomes.amount, recurrenceType: incomes.recurrenceType, startDate: incomes.startDate })
        .from(incomes).where(lte(incomes.startDate, yearEnd)),
      db.select({ amount: expenses.amount, recurrenceType: expenses.recurrenceType, recurrenceInterval: expenses.recurrenceInterval, startDate: expenses.startDate, endDate: expenses.endDate })
        .from(expenses).where(and(lte(expenses.startDate, yearEnd), sql`(${expenses.endDate} IS NULL OR ${expenses.endDate} >= ${yearStart.toISOString()})`)),
      db.select({ amount: dailyExpenses.amount, date: dailyExpenses.date })
        .from(dailyExpenses).where(and(gte(dailyExpenses.date, yearStart), lte(dailyExpenses.date, yearEnd))),
    ]);

    const data: IncomeVsExpensesEntry[] = Array.from({ length: 12 }, (_, monthIndex) => {
      const start = monthStart(targetYear, monthIndex);
      const end = monthEnd(targetYear, monthIndex);

      let income = 0;
      for (const inc of allIncomes) {
        const amount = parseFloat(inc.amount);
        const incStart = new Date(inc.startDate);
        if (inc.recurrenceType === 'once' && incStart >= start && incStart <= end) income += amount;
        else if (inc.recurrenceType === 'monthly' && incStart <= end) income += amount;
        else if (inc.recurrenceType === 'yearly' && incStart <= end) income += amount / 12;
      }

      let periodicExp = 0;
      for (const exp of allExpenses) {
        const expStart = new Date(exp.startDate);
        const expEnd = exp.endDate ? new Date(exp.endDate) : null;
        if (!(expStart <= end && (expEnd === null || expEnd >= start))) continue;
        if (exp.recurrenceType === 'once' && expStart >= start && expStart <= end) periodicExp += parseFloat(exp.amount);
        else if (exp.recurrenceType !== 'once') periodicExp += normalizeToMonthly(parseFloat(exp.amount), exp.recurrenceType, exp.recurrenceInterval);
      }

      const dailyTotal = allDailyExp
        .filter(de => { const d = new Date(de.date); return d >= start && d <= end; })
        .reduce((sum, de) => sum + parseFloat(de.amount), 0);

      return { month: MONTH_NAMES_DE[monthIndex], income: Math.round(income * 100) / 100, expenses: Math.round((periodicExp + dailyTotal) * 100) / 100 };
    });

    return { success: true, data };
  } catch (error) {
    console.error('Failed to fetch income vs expenses by month:', error);
    return { success: false, error: 'Jahresübersicht konnte nicht geladen werden.' };
  }
}

export async function getSavingsProgress(): Promise<ApiResponse<SavingsProgress>> {
  try {
    const now = new Date();
    const start = monthStart(now.getFullYear(), now.getMonth());
    const end = monthEnd(now.getFullYear(), now.getMonth());

    const [activeIncomes, activeExpenses, dailyResult] = await Promise.all([
      db.select({ amount: incomes.amount, recurrenceType: incomes.recurrenceType, startDate: incomes.startDate })
        .from(incomes).where(lte(incomes.startDate, end)),
      db.select({ amount: expenses.amount, recurrenceType: expenses.recurrenceType, recurrenceInterval: expenses.recurrenceInterval, startDate: expenses.startDate, endDate: expenses.endDate })
        .from(expenses).where(and(lte(expenses.startDate, end), sql`(${expenses.endDate} IS NULL OR ${expenses.endDate} >= ${start.toISOString()})`)),
      db.select({ total: sql<string>`COALESCE(SUM(${dailyExpenses.amount}), 0)` })
        .from(dailyExpenses).where(and(gte(dailyExpenses.date, start), lte(dailyExpenses.date, end))),
    ]);

    let totalIncome = 0;
    for (const inc of activeIncomes) {
      const amount = parseFloat(inc.amount);
      const incStart = new Date(inc.startDate);
      if (inc.recurrenceType === 'once' && incStart >= start && incStart <= end) totalIncome += amount;
      else if (inc.recurrenceType === 'monthly') totalIncome += amount;
      else if (inc.recurrenceType === 'yearly') totalIncome += amount / 12;
    }

    let periodicExp = 0;
    for (const exp of activeExpenses) {
      const expStart = new Date(exp.startDate);
      const expEnd = exp.endDate ? new Date(exp.endDate) : null;
      if (!(expStart <= end && (expEnd === null || expEnd >= start))) continue;
      if (exp.recurrenceType === 'once' && expStart >= start && expStart <= end) periodicExp += parseFloat(exp.amount);
      else if (exp.recurrenceType !== 'once') periodicExp += normalizeToMonthly(parseFloat(exp.amount), exp.recurrenceType, exp.recurrenceInterval);
    }

    const dailyTotal = parseFloat(dailyResult[0]?.total || '0');
    const roundedIncome = Math.round(totalIncome * 100) / 100;
    const totalExpenses = Math.round((periodicExp + dailyTotal) * 100) / 100;
    const savingsAmount = Math.round((roundedIncome - totalExpenses) * 100) / 100;
    const savingsRate = roundedIncome > 0 ? Math.round((savingsAmount / roundedIncome) * 10000) / 100 : 0;

    return { success: true, data: { totalIncome: roundedIncome, totalExpenses, savingsAmount, savingsRate } };
  } catch (error) {
    console.error('Failed to fetch savings progress:', error);
    return { success: false, error: 'Sparfortschritt konnte nicht geladen werden.' };
  }
}
