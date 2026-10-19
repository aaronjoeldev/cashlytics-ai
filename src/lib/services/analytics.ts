import { db } from "@/lib/db";
import { expenses, incomes, dailyExpenses, categories, accounts } from "@/lib/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import type {
  MonthlyOverview,
  Forecast,
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
import { toBaseCurrency as toBase } from "@/lib/currency";
import type { FinanceContext } from "@/lib/services/context";

export async function computeMonthlyOverview(
  { userId, baseCurrency, rates }: FinanceContext,
  month: number,
  year: number,
  accountId?: string
): Promise<MonthlyOverview> {
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
    return sum + toBase(rawAmount, e.currency, baseCurrency, rates);
  }, 0);

  // Convert each daily expense to baseCurrency using the entry's own currency
  const totalDailyExpenses = dailyExpensesResult.reduce((sum, e) => {
    return sum + toBase(safeParseFloat(e.amount), e.entryCurrency, baseCurrency, rates);
  }, 0);

  // Convert each income to baseCurrency using the entry's own currency
  const totalIncome = incomesWithAccount.reduce((sum, i) => {
    const rawAmount = getBudgetedAmountForMonth(i, safeParseFloat(i.amount), year, month);
    return sum + toBase(rawAmount, i.currency, baseCurrency, rates);
  }, 0);

  const totalExpenses = totalMonthlyExpenses + totalDailyExpenses;
  const balance = totalIncome - totalExpenses;

  return {
    month,
    year,
    totalIncome,
    totalExpenses,
    balance,
    expenses: expensesWithDetails,
    incomes: incomesWithAccount,
  };
}

/**
 * Income, expenses and net of the current month and the `months - 1` following ones; only the
 * entries of one account when `accountId` is given.
 */
export async function computeForecast(
  ctx: FinanceContext,
  months: number,
  now: Date = new Date(),
  accountId?: string
): Promise<Forecast> {
  const monthTargets = Array.from({ length: months }, (_, i) => {
    const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    return { month: targetDate.getMonth() + 1, year: targetDate.getFullYear() };
  });

  const overviews = await Promise.all(
    monthTargets.map(({ month, year }) => computeMonthlyOverview(ctx, month, year, accountId))
  );

  let totalProjectedIncome = 0;
  let totalProjectedExpenses = 0;
  const monthlyDetails: Forecast["monthlyDetails"] = overviews.map((overview, i) => {
    totalProjectedIncome += overview.totalIncome;
    totalProjectedExpenses += overview.totalExpenses;
    return {
      month: monthTargets[i].month,
      year: monthTargets[i].year,
      income: overview.totalIncome,
      expenses: overview.totalExpenses,
      balance: overview.balance,
    };
  });

  return {
    months,
    projectedIncome: totalProjectedIncome,
    projectedExpenses: totalProjectedExpenses,
    projectedBalance: totalProjectedIncome - totalProjectedExpenses,
    monthlyDetails,
  };
}

/** Recurring expenses with their smoothed monthly amount; only subscriptions when asked. */
export async function listNormalizedExpenses(
  { userId, baseCurrency, rates }: FinanceContext,
  { subscriptionsOnly = false }: { subscriptionsOnly?: boolean } = {}
): Promise<Array<{ expense: ExpenseWithDetails; monthlyAmount: number }>> {
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
        subscriptionsOnly ? eq(expenses.isSubscription, true) : undefined
      )
    );

  return expensesResult.map((r) => {
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
    const monthlyAmount = toBase(rawMonthly, r.expense.currency, baseCurrency, rates);

    return {
      expense: expenseWithDetails,
      monthlyAmount,
    };
  });
}

export interface ScheduledPayment {
  id: string;
  name: string;
  /** Amount in the base currency */
  amount: number;
  /** Amount in the entry's own currency */
  originalAmount: number;
  currency: string;
  /** Calendar day as UTC midnight */
  date: Date;
  type: "expense" | "daily_expense" | "income";
  accountId: string | null;
  category: {
    name: string | null;
    icon: string | null;
    color: string | null;
  } | null;
  isSubscription: boolean;
}

/**
 * Every due date of expenses, daily expenses and incomes between two calendar days (inclusive,
 * UTC midnight), sorted by date; only those of one account when `accountId` is given.
 */
export async function listScheduledPayments(
  { userId, baseCurrency, rates }: FinanceContext,
  rangeStart: Date,
  rangeEnd: Date,
  accountId?: string
): Promise<ScheduledPayment[]> {
  const rangeEndOfDay = new Date(
    Date.UTC(
      rangeEnd.getUTCFullYear(),
      rangeEnd.getUTCMonth(),
      rangeEnd.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );

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
          lte(expenses.startDate, rangeEndOfDay),
          sql`(${expenses.endDate} IS NULL OR ${expenses.endDate} >= ${rangeStart.toISOString()})`,
          accountId ? eq(expenses.accountId, accountId) : undefined
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
          gte(dailyExpenses.date, rangeStart),
          lte(dailyExpenses.date, rangeEndOfDay),
          accountId ? eq(dailyExpenses.accountId, accountId) : undefined
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
          lte(incomes.startDate, rangeEndOfDay),
          sql`(${incomes.endDate} IS NULL OR ${incomes.endDate} >= ${rangeStart.toISOString()})`,
          accountId ? eq(incomes.accountId, accountId) : undefined
        )
      ),
  ]);

  const rangeMonths: Array<{ year: number; month: number }> = [];
  const cursor = new Date(Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), 1));
  while (cursor <= rangeEndOfDay) {
    rangeMonths.push({ year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const occurrencesInRange = (item: RecurringItem) =>
    rangeMonths
      .flatMap(({ year, month }) => getOccurrencesInMonth(item, year, month))
      .filter((date) => date >= rangeStart && date <= rangeEndOfDay);

  const payments: ScheduledPayment[] = [];

  for (const item of expensesResult) {
    const originalAmount = safeParseFloat(item.expense.amount);
    for (const date of occurrencesInRange(item.expense)) {
      payments.push({
        id: item.expense.id,
        name: item.expense.name,
        amount: toBase(originalAmount, item.expense.currency, baseCurrency, rates),
        originalAmount,
        currency: item.expense.currency,
        date,
        type: "expense",
        accountId: item.expense.accountId,
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
    const originalAmount = safeParseFloat(item.dailyExpense.amount);
    const day = new Date(item.dailyExpense.date);
    payments.push({
      id: item.dailyExpense.id,
      name: item.dailyExpense.description,
      amount: toBase(originalAmount, item.dailyExpense.currency, baseCurrency, rates),
      originalAmount,
      currency: item.dailyExpense.currency,
      date: new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate())),
      type: "daily_expense",
      accountId: item.dailyExpense.accountId,
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
    const originalAmount = safeParseFloat(item.income.amount);
    for (const date of occurrencesInRange(item.income)) {
      payments.push({
        id: item.income.id,
        name: item.income.source,
        amount: toBase(originalAmount, item.income.currency, baseCurrency, rates),
        originalAmount,
        currency: item.income.currency,
        date,
        type: "income",
        accountId: item.income.accountId,
        category: null,
        isSubscription: false,
      });
    }
  }

  payments.sort((a, b) => a.date.getTime() - b.date.getTime());
  return payments;
}
