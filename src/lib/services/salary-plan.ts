import { db } from "@/lib/db";
import {
  accounts,
  dailyExpenses,
  expenses,
  incomes,
  planSettings,
  transfers,
} from "@/lib/db/schema";
import { and, eq, gte, lt } from "drizzle-orm";
import { safeParseFloat } from "@/lib/safe-parse";
import { toBaseCurrency as toBase } from "@/lib/currency";
import { isActiveInMonth, normalizeToMonthly } from "@/lib/recurrence";
import { reserveIntervalMonths } from "@/lib/reserves";
import { averageMonthlySpending } from "@/lib/salary-plan";
import { computeReservePlan } from "@/lib/services/reserves";
import type { FinanceContext } from "@/lib/services/context";

const EVERYDAY_MONTHS = 3;

export type SalaryPlan = {
  /** Recurring incomes as monthly amounts, largest first. */
  incomes: Array<{ id: string; name: string; monthly: number }>;
  income: number;
  /** Monthly and more frequent recurring expenses, as monthly amounts. */
  fixed: number;
  fixedCount: number;
  /** Fixed monthly rates for infrequent bills (the reserve plan). */
  reserves: number;
  reservePot: { accountName: string; plannedMonthlyDeposit: number } | null;
  everyday: {
    amount: number;
    source: "average" | "custom";
    /** Average of the last full months with daily expenses, shown even when a custom amount is set. */
    average: number;
    monthsWithData: number;
  };
  /** Planned recurring transfers into savings and ETF accounts (not the reserve pot). */
  savings: Array<{ accountId: string; accountName: string; monthly: number }>;
  savingsTotal: number;
};

/** Salary plan of one user on `today` (a UTC-midnight calendar day), in the base currency. */
export async function computeSalaryPlan(context: FinanceContext, today: Date): Promise<SalaryPlan> {
  const { userId, baseCurrency, rates } = context;
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1;
  const everydayFrom = new Date(Date.UTC(year, month - 1 - EVERYDAY_MONTHS, 1));
  const everydayUntil = new Date(Date.UTC(year, month - 1, 1));

  const [incomeRows, expenseRows, transferRows, accountRows, dailyRows, [settings], reservePlan] =
    await Promise.all([
      db.select().from(incomes).where(eq(incomes.userId, userId)),
      db.select().from(expenses).where(eq(expenses.userId, userId)),
      db.select().from(transfers).where(eq(transfers.userId, userId)),
      db
        .select({ id: accounts.id, name: accounts.name, type: accounts.type })
        .from(accounts)
        .where(eq(accounts.userId, userId)),
      db
        .select({
          date: dailyExpenses.date,
          amount: dailyExpenses.amount,
          currency: dailyExpenses.currency,
        })
        .from(dailyExpenses)
        .where(
          and(
            eq(dailyExpenses.userId, userId),
            gte(dailyExpenses.date, everydayFrom),
            lt(dailyExpenses.date, everydayUntil)
          )
        ),
      db.select().from(planSettings).where(eq(planSettings.userId, userId)).limit(1),
      computeReservePlan(context, today),
    ]);

  // Recurring items count with their monthly average while they are active this month
  const monthly = (
    item: Parameters<typeof isActiveInMonth>[0],
    amount: string,
    currency: string | null
  ) =>
    item.recurrenceType === "once" || !isActiveInMonth(item, year, month)
      ? 0
      : normalizeToMonthly(
          toBase(safeParseFloat(amount), currency, baseCurrency, rates),
          item.recurrenceType,
          item.recurrenceInterval
        );

  const incomeList = incomeRows
    .map((row) => ({
      id: row.id,
      name: row.source,
      monthly: monthly(row, row.amount, row.currency),
    }))
    .filter((row) => row.monthly > 0)
    .sort((a, b) => b.monthly - a.monthly);

  let fixed = 0;
  let fixedCount = 0;
  for (const row of expenseRows) {
    // Infrequent bills are covered by the reserves
    if (reserveIntervalMonths(row)) continue;
    const amount = monthly(row, row.amount, row.currency);
    if (amount > 0) {
      fixed += amount;
      fixedCount++;
    }
  }

  const potAccountId = reservePlan.pot?.accountId;
  const savingsByAccount = new Map<string, number>();
  for (const row of transferRows) {
    const target = accountRows.find((a) => a.id === row.targetAccountId);
    if (!target || target.id === potAccountId) continue;
    if (target.type !== "savings" && target.type !== "etf") continue;
    const amount = monthly(row, row.amount, row.sourceCurrency);
    if (amount > 0)
      savingsByAccount.set(target.id, (savingsByAccount.get(target.id) ?? 0) + amount);
  }
  const savings = [...savingsByAccount.entries()]
    .map(([accountId, amount]) => ({
      accountId,
      accountName: accountRows.find((a) => a.id === accountId)?.name ?? "",
      monthly: amount,
    }))
    .sort((a, b) => b.monthly - a.monthly);

  const { average, monthsWithData } = averageMonthlySpending(
    dailyRows.map((row) => ({
      date: row.date,
      amount: toBase(safeParseFloat(row.amount), row.currency, baseCurrency, rates),
    })),
    today,
    EVERYDAY_MONTHS
  );
  const custom =
    settings?.everydayBudget != null
      ? toBase(safeParseFloat(settings.everydayBudget), settings.currency, baseCurrency, rates)
      : null;

  return {
    incomes: incomeList,
    income: incomeList.reduce((sum, row) => sum + row.monthly, 0),
    fixed,
    fixedCount,
    reserves: reservePlan.monthlyTotal,
    reservePot: reservePlan.pot
      ? {
          accountName: reservePlan.pot.accountName,
          plannedMonthlyDeposit: reservePlan.pot.plannedMonthlyDeposit,
        }
      : null,
    everyday: {
      amount: custom ?? average,
      source: custom === null ? "average" : "custom",
      average,
      monthsWithData,
    },
    savings,
    savingsTotal: savings.reduce((sum, row) => sum + row.monthly, 0),
  };
}
