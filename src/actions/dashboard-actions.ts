'use server';

import { db } from '@/lib/db';
import { accounts, incomes, expenses, dailyExpenses, categories } from '@/lib/db/schema';
import { and, gte, lte, sql, desc, eq } from 'drizzle-orm';
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
    return { success: false, error: `Failed to fetch dashboard stats: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function getCategoryBreakdown(
  startDate: Date = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
): Promise<ApiResponse<CategoryBreakdown[]>> {
  try {
    const categoryMap = new Map<string, { categoryName: string; categoryIcon: string | null; categoryColor: string | null; total: number }>();

    const dailyExpensesResult = await db
      .select({
        categoryId: dailyExpenses.categoryId,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
        amount: dailyExpenses.amount,
      })
      .from(dailyExpenses)
      .leftJoin(categories, sql`${dailyExpenses.categoryId} = ${categories.id}`)
      .where(gte(dailyExpenses.date, startDate));

    for (const row of dailyExpensesResult) {
      const categoryId = row.categoryId || 'uncategorized';
      const amount = parseFloat(row.amount);
      if (categoryMap.has(categoryId)) {
        categoryMap.get(categoryId)!.total += amount;
      } else {
        categoryMap.set(categoryId, {
          categoryName: row.categoryName || 'Ohne Kategorie',
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
        endDate: expenses.endDate,
      })
      .from(expenses)
      .leftJoin(categories, sql`${expenses.categoryId} = ${categories.id}`)
      .where(sql`${expenses.endDate} IS NULL OR ${expenses.endDate} >= ${startDate.toISOString()}`);

    for (const row of periodicExpensesResult) {
      if (row.recurrenceType === 'once') continue;
      
      const categoryId = row.categoryId || 'uncategorized-periodic';
      const monthlyAmount = normalizeToMonthly(
        parseFloat(row.amount),
        row.recurrenceType,
        row.recurrenceInterval
      );
      
      if (categoryMap.has(categoryId)) {
        categoryMap.get(categoryId)!.total += monthlyAmount;
      } else {
        categoryMap.set(categoryId, {
          categoryName: row.categoryName || 'Ohne Kategorie',
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

interface UpcomingPayment {
  id: string;
  name: string;
  amount: number;
  date: Date;
  type: 'expense' | 'daily_expense';
  category: {
    name: string | null;
    icon: string | null;
    color: string | null;
  } | null;
  isSubscription: boolean;
}

function getNextPaymentDate(startDate: Date, recurrenceType: string, recurrenceInterval: number | null): Date {
  const now = new Date();
  const start = new Date(startDate);
  
  switch (recurrenceType) {
    case 'daily': {
      const next = new Date(now);
      next.setDate(next.getDate() + 1);
      next.setHours(0, 0, 0, 0);
      return next;
    }
    case 'weekly': {
      const daysUntilNext = (7 - ((now.getDay() - start.getDay() + 7) % 7)) % 7 || 7;
      const next = new Date(now);
      next.setDate(next.getDate() + daysUntilNext);
      next.setHours(0, 0, 0, 0);
      return next;
    }
    case 'monthly': {
      const next = new Date(now.getFullYear(), now.getMonth() + 1, start.getDate());
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
      return next;
    }
    case 'quarterly': {
      const monthsToAdd = 3 - ((now.getMonth() - start.getMonth()) % 3);
      const next = new Date(now.getFullYear(), now.getMonth() + monthsToAdd, start.getDate());
      if (next <= now) {
        next.setMonth(next.getMonth() + 3);
      }
      return next;
    }
    case 'yearly': {
      const next = new Date(now.getFullYear() + 1, start.getMonth(), start.getDate());
      if (next <= now) {
        next.setFullYear(next.getFullYear() + 1);
      }
      return next;
    }
    case 'custom': {
      if (!recurrenceInterval) return start;
      const monthsToAdd = recurrenceInterval - ((now.getMonth() - start.getMonth()) % recurrenceInterval);
      const next = new Date(now.getFullYear(), now.getMonth() + monthsToAdd, start.getDate());
      if (next <= now) {
        next.setMonth(next.getMonth() + recurrenceInterval);
      }
      return next;
    }
    default:
      return start;
  }
}

export async function getUpcomingPayments(days: number = 14): Promise<ApiResponse<UpcomingPayment[]>> {
  try {
    const now = new Date();
    const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    
    const payments: UpcomingPayment[] = [];
    
    const activeExpenses = await db
      .select({
        expense: expenses,
        category: categories,
      })
      .from(expenses)
      .leftJoin(categories, eq(expenses.categoryId, categories.id))
      .where(sql`${expenses.endDate} IS NULL OR ${expenses.endDate} >= ${now.toISOString()}`);

    for (const item of activeExpenses) {
      if (item.expense.recurrenceType === 'once') continue;
      
      const nextDate = getNextPaymentDate(
        item.expense.startDate,
        item.expense.recurrenceType,
        item.expense.recurrenceInterval
      );
      
      if (nextDate >= now && nextDate <= endDate) {
        payments.push({
          id: item.expense.id,
          name: item.expense.name,
          amount: parseFloat(item.expense.amount),
          date: nextDate,
          type: 'expense',
          category: item.category ? {
            name: item.category.name,
            icon: item.category.icon,
            color: item.category.color,
          } : null,
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
      .where(and(
        gte(dailyExpenses.date, now),
        lte(dailyExpenses.date, endDate)
      ));

    for (const item of upcomingDailyExpenses) {
      payments.push({
        id: item.dailyExpense.id,
        name: item.dailyExpense.description,
        amount: parseFloat(item.dailyExpense.amount),
        date: new Date(item.dailyExpense.date),
        type: 'daily_expense',
        category: item.category ? {
          name: item.category.name,
          icon: item.category.icon,
          color: item.category.color,
        } : null,
        isSubscription: false,
      });
    }
    
    payments.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    return { success: true, data: payments };
  } catch (error) {
    console.error('Failed to fetch upcoming payments:', error);
    return { success: false, error: 'Failed to fetch upcoming payments' };
  }
}