'use server';

import { db } from '@/lib/db';
import { accounts, incomes, expenses, dailyExpenses, categories } from '@/lib/db/schema';
import { and, gte, lte, sql, desc } from 'drizzle-orm';
import type { ApiResponse, Account, DailyExpenseWithDetails } from '@/types/database';

function normalizeToMonthly(amount: number, recurrenceType: string, recurrenceInterval: number | null): number {
  switch (recurrenceType) {
    case 'daily': return amount * 30;
    case 'weekly': return amount * 4.33;
    case 'monthly': return amount;
    case 'quarterly': return amount / 3;
    case 'yearly': return amount / 12;
    case 'custom': return recurrenceInterval ? amount / recurrenceInterval : amount;
    default: return 0;
  }
}

interface DashboardStats {
  totalAssets: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
  incomeTrend: number;
  expenseTrend: number;
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
  try {
    // Gesamtvermögen (Summe aller Konten)
    const accountsResult = await db.select({
      total: sql<string>`COALESCE(SUM(balance), 0)`,
    }).from(accounts);
    const totalAssets = parseFloat(accountsResult[0]?.total || '0');

    // Aktueller Monat
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Einnahmen: alle aktiven wiederkehrenden Einnahmen (startDate <= jetzt)
    const activeIncomes = await db.select({
      amount: incomes.amount,
      recurrenceType: incomes.recurrenceType,
    }).from(incomes)
      .where(lte(incomes.startDate, now));

    const monthlyIncome = activeIncomes.reduce((sum, inc) => {
      const amount = parseFloat(inc.amount);
      if (inc.recurrenceType === 'monthly') return sum + amount;
      if (inc.recurrenceType === 'yearly') return sum + amount / 12;
      if (inc.recurrenceType === 'once') {
        // Einmalige Einnahmen nur zählen wenn im aktuellen Monat
        // (wird oben schon gefiltert, hier ist startDate <= now)
        return sum;
      }
      return sum;
    }, 0);

    // Einmalige Einnahmen dieses Monats separat
    const oneTimeIncomes = await db.select({
      total: sql<string>`COALESCE(SUM(amount), 0)`,
    }).from(incomes)
      .where(and(
        gte(incomes.startDate, currentMonthStart),
        sql`${incomes.recurrenceType} = 'once'`
      ));
    const totalMonthlyIncome = monthlyIncome + parseFloat(oneTimeIncomes[0]?.total || '0');

    // Ausgaben diesen Monat: tägliche Ausgaben
    const currentMonthDailyExpenses = await db.select({
      total: sql<string>`COALESCE(SUM(amount), 0)`,
    }).from(dailyExpenses)
      .where(gte(dailyExpenses.date, currentMonthStart));
    const dailyExpensesTotal = parseFloat(currentMonthDailyExpenses[0]?.total || '0');

    // Ausgaben: periodische Ausgaben (normalisiert auf monatlich)
    const activeExpenses = await db.select({
      amount: expenses.amount,
      recurrenceType: expenses.recurrenceType,
      recurrenceInterval: expenses.recurrenceInterval,
      endDate: expenses.endDate,
    }).from(expenses)
      .where(and(
        lte(expenses.startDate, now),
        sql`(${expenses.endDate} IS NULL OR ${expenses.endDate} >= ${currentMonthStart.toISOString()})`
      ));

    const periodicExpensesTotal = activeExpenses.reduce((sum, exp) => {
      return sum + normalizeToMonthly(
        parseFloat(exp.amount),
        exp.recurrenceType,
        exp.recurrenceInterval
      );
    }, 0);

    const monthlyExpenses = dailyExpensesTotal + periodicExpensesTotal;

    // Ausgaben letzten Monat (für Trend) - tägliche + periodische
    const lastMonthDailyExp = await db.select({
      total: sql<string>`COALESCE(SUM(amount), 0)`,
    }).from(dailyExpenses)
      .where(and(
        gte(dailyExpenses.date, lastMonthStart),
        lte(dailyExpenses.date, lastMonthEnd)
      ));
    // Periodische Ausgaben waren letzten Monat gleich (selbe Fixkosten)
    const lastMonthExpensesTotal = parseFloat(lastMonthDailyExp[0]?.total || '0') + periodicExpensesTotal;

    // Sparquote
    const savingsRate = totalMonthlyIncome - monthlyExpenses;

    // Trends berechnen
    const expenseTrend = lastMonthExpensesTotal > 0 
      ? ((monthlyExpenses - lastMonthExpensesTotal) / lastMonthExpensesTotal) * 100 
      : 0;

    return {
      success: true,
      data: {
        totalAssets,
        monthlyIncome: totalMonthlyIncome,
        monthlyExpenses,
        savingsRate,
        incomeTrend: 0, // TODO: Historische Daten vergleichen
        expenseTrend: -expenseTrend, // Negativ anzeigen, da weniger Ausgaben gut ist
      },
    };
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error);
    return { success: false, error: 'Failed to fetch dashboard stats' };
  }
}

export async function getCategoryBreakdown(
  startDate: Date = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
): Promise<ApiResponse<CategoryBreakdown[]>> {
  try {
    const result = await db
      .select({
        categoryId: dailyExpenses.categoryId,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
        total: sql<string>`COALESCE(SUM(${dailyExpenses.amount}), 0)`,
      })
      .from(dailyExpenses)
      .leftJoin(categories, sql`${dailyExpenses.categoryId} = ${categories.id}`)
      .where(gte(dailyExpenses.date, startDate))
      .groupBy(dailyExpenses.categoryId, categories.name, categories.icon, categories.color)
      .orderBy(sql`SUM(${dailyExpenses.amount}) DESC`);

    // Gesamtsumme berechnen
    const totalSum = result.reduce((sum, row) => sum + parseFloat(row.total || '0'), 0);

    const breakdown: CategoryBreakdown[] = result.map(row => ({
      categoryId: row.categoryId,
      categoryName: row.categoryName || 'Sonstiges',
      categoryIcon: row.categoryIcon,
      categoryColor: row.categoryColor,
      total: parseFloat(row.total || '0'),
      percentage: totalSum > 0 ? (parseFloat(row.total || '0') / totalSum) * 100 : 0,
    }));

    return { success: true, data: breakdown };
  } catch (error) {
    console.error('Failed to fetch category breakdown:', error);
    return { success: false, error: 'Failed to fetch category breakdown' };
  }
}

export async function getRecentTransactions(limit: number = 5): Promise<ApiResponse<DailyExpenseWithDetails[]>> {
  try {
    const transactions = await db.query.dailyExpenses.findMany({
      with: {
        account: true,
        category: true,
      },
      orderBy: [desc(dailyExpenses.date)],
      limit,
    });

    return { success: true, data: transactions as DailyExpenseWithDetails[] };
  } catch (error) {
    console.error('Failed to fetch recent transactions:', error);
    return { success: false, error: 'Failed to fetch recent transactions' };
  }
}

export async function getAccounts(): Promise<ApiResponse<Account[]>> {
  try {
    const allAccounts = await db.select().from(accounts).orderBy(accounts.name);
    return { success: true, data: allAccounts };
  } catch (error) {
    console.error('Failed to fetch accounts:', error);
    return { success: false, error: 'Failed to fetch accounts' };
  }
}