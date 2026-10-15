import { db } from "@/lib/db";
import { accounts, incomes, expenses, dailyExpenses, categories } from "@/lib/db/schema";
import { and, gte, lte, sql, eq } from "drizzle-orm";
import { safeParseFloat } from "@/lib/safe-parse";
import { toBaseCurrency as toBase } from "@/lib/currency";
import {
  getBudgetedAmountForMonth,
  getDueAmountForMonth,
  getNextOccurrence,
  type RecurringItem,
} from "@/lib/recurrence";
import type { FinanceContext } from "@/lib/services/context";

export interface DashboardView {
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
  incomeTrend: number;
  expenseTrend: number;
}

export interface DashboardStats {
  totalAssets: number;
  /** True when the user has accounts in more than one currency — used by UI to show ≈ prefix */
  hasMultiCurrency: boolean;
  reserveView: DashboardView;
  cashflowView: DashboardView;
}

function getMonthDateRange(reference: Date): { monthStart: Date; monthEnd: Date } {
  const monthStart = new Date(reference.getFullYear(), reference.getMonth(), 1, 0, 0, 0, 0);
  const monthEnd = new Date(reference.getFullYear(), reference.getMonth() + 1, 0, 23, 59, 59, 999);
  return { monthStart, monthEnd };
}

export async function computeDashboardStats(
  { userId, baseCurrency, rates }: FinanceContext,
  now: Date = new Date()
): Promise<DashboardStats> {
  // Gesamtvermögen: fetch per account and convert each balance to baseCurrency
  const accountsResult = await db
    .select({
      balance: accounts.balance,
      currency: accounts.currency,
    })
    .from(accounts)
    .where(eq(accounts.userId, userId));

  const totalAssets = accountsResult.reduce((sum, acc) => {
    return sum + toBase(safeParseFloat(acc.balance), acc.currency, baseCurrency, rates);
  }, 0);

  // Check whether accounts have mixed currencies (used in client for ≈ indicator)
  const uniqueAccountCurrencies = new Set(accountsResult.map((a) => a.currency));
  const hasMultiCurrency = uniqueAccountCurrencies.size > 1;

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
    (sum, e) => sum + toBase(safeParseFloat(e.amount), e.entryCurrency, baseCurrency, rates),
    0
  );
  const lastDailyExpensesTotal = lastMonthDailyRows.reduce(
    (sum, e) => sum + toBase(safeParseFloat(e.amount), e.entryCurrency, baseCurrency, rates),
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
      return sum + toBase(amount, item.entryCurrency, baseCurrency, rates);
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
  };
}

export interface UpcomingPayment {
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

/** Next due date of every recurring expense plus planned daily expenses within `days`. */
export async function listUpcomingPayments(
  { userId, baseCurrency, rates }: FinanceContext,
  days: number,
  now: Date = new Date()
): Promise<UpcomingPayment[]> {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

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
        amount: toBase(
          safeParseFloat(item.expense.amount),
          item.expense.currency,
          baseCurrency,
          rates
        ),
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
        baseCurrency,
        rates
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
  return payments;
}
