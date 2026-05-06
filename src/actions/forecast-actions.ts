"use server";

import { db } from "@/lib/db";
import { accounts, incomes, expenses, transfers } from "@/lib/db/schema";
import { eq, or, and } from "drizzle-orm";
import type { ApiResponse, Account, Expense, Income, Transfer } from "@/types/database";
import { safeParseFloat } from "@/lib/safe-parse";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth/require-auth";
import { cookies } from "next/headers";
import { convertCurrency, defaultCurrency, currencies, type Currency } from "@/lib/currency";

async function getBaseCurrency(): Promise<Currency> {
  const cookieStore = await cookies();
  const value = cookieStore.get("currency")?.value;
  if (value && currencies.includes(value as Currency)) return value as Currency;
  return defaultCurrency;
}

function toBase(amount: number, fromCurrency: string | null | undefined, baseCurrency: Currency): number {
  const from = (fromCurrency && currencies.includes(fromCurrency as Currency))
    ? (fromCurrency as Currency)
    : baseCurrency;
  return convertCurrency(amount, from, baseCurrency);
}

export type AccountForecast = {
  account: Account;
  currentBalance: number;
  isCumulativeAccount: boolean;
  projectedMonths: Array<{
    month: number;
    year: number;
    monthName: string;
    income: number;
    expenses: number;
    transfersIn: number;
    transfersOut: number;
    balance: number;
    cumulativeBalance: number;
  }>;
};

const MONTH_NAMES = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

function getMonthsInBetween(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

function isSameMonthAndYear(date1: Date, date2: Date): boolean {
  return date1.getMonth() === date2.getMonth() && date1.getFullYear() === date2.getFullYear();
}

function calculateIncomeForMonth(income: Income, targetMonth: number, targetYear: number): number {
  const startDate = new Date(income.startDate);
  const targetDate = new Date(targetYear, targetMonth - 1, 15);

  if (startDate > targetDate) return 0;

  if (income.endDate) {
    const endDate = new Date(income.endDate);
    if (endDate < new Date(targetYear, targetMonth - 1, 1)) return 0;
  }

  const amount = safeParseFloat(income.amount);

  switch (income.recurrenceType) {
    case "once":
      return isSameMonthAndYear(startDate, targetDate) ? amount : 0;

    case "monthly":
      return amount;

    case "yearly":
      if (startDate.getMonth() === targetMonth - 1) {
        const yearsDiff = targetYear - startDate.getFullYear();
        if (yearsDiff >= 0) return amount;
      }
      return 0;

    default:
      return 0;
  }
}

function calculateExpenseForMonth(
  expense: Expense,
  targetMonth: number,
  targetYear: number
): number {
  const startDate = new Date(expense.startDate);
  const targetDate = new Date(targetYear, targetMonth - 1, 15);

  if (startDate > targetDate) return 0;

  if (expense.endDate) {
    const endDate = new Date(expense.endDate);
    if (endDate < new Date(targetYear, targetMonth - 1, 1)) return 0;
  }

  const amount = safeParseFloat(expense.amount);

  switch (expense.recurrenceType) {
    case "once":
      return isSameMonthAndYear(startDate, targetDate) ? amount : 0;

    case "daily": {
      const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
      return amount * daysInMonth;
    }

    case "weekly": {
      const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
      const weeksInMonth = daysInMonth / 7;
      return amount * weeksInMonth;
    }

    case "monthly":
      return amount;

    case "quarterly": {
      const monthsSinceStart = getMonthsInBetween(startDate, targetDate);
      if (monthsSinceStart >= 0 && monthsSinceStart % 3 === 0) return amount;
      return 0;
    }

    case "semiannual": {
      const monthsSinceStart = getMonthsInBetween(startDate, targetDate);
      if (monthsSinceStart >= 0 && monthsSinceStart % 6 === 0) return amount;
      return 0;
    }

    case "yearly": {
      if (startDate.getMonth() === targetMonth - 1) {
        const yearsDiff = targetYear - startDate.getFullYear();
        if (yearsDiff >= 0) return amount;
      }
      return 0;
    }

    case "custom": {
      const interval = expense.recurrenceInterval ?? 1;
      if (interval <= 0) return 0;
      const monthsSinceStart = getMonthsInBetween(startDate, targetDate);
      if (monthsSinceStart >= 0 && monthsSinceStart % interval === 0) return amount;
      return 0;
    }

    default:
      return 0;
  }
}

function calculateTransferForMonth(
  transfer: Transfer,
  targetMonth: number,
  targetYear: number
): number {
  const startDate = new Date(transfer.startDate);
  const targetDate = new Date(targetYear, targetMonth - 1, 15);

  if (startDate > targetDate) return 0;

  if (transfer.endDate) {
    const endDate = new Date(transfer.endDate);
    if (endDate < new Date(targetYear, targetMonth - 1, 1)) return 0;
  }

  const amount = safeParseFloat(transfer.amount);

  switch (transfer.recurrenceType) {
    case "once":
      return isSameMonthAndYear(startDate, targetDate) ? amount : 0;

    case "monthly":
      return amount;

    case "quarterly": {
      const monthsSinceStart = getMonthsInBetween(startDate, targetDate);
      if (monthsSinceStart >= 0 && monthsSinceStart % 3 === 0) return amount;
      return 0;
    }

    case "yearly": {
      if (startDate.getMonth() === targetMonth - 1) {
        const yearsDiff = targetYear - startDate.getFullYear();
        if (yearsDiff >= 0) return amount;
      }
      return 0;
    }

    default:
      return 0;
  }
}

export async function getAccountForecast(
  accountId: string,
  months: number
): Promise<ApiResponse<AccountForecast>> {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  try {
    const [account] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
      .limit(1);

    if (!account) {
      return { success: false, error: "Konto nicht gefunden." };
    }

    const [accountIncomes, accountExpenses, accountTransfers] = await Promise.all([
      db
        .select()
        .from(incomes)
        .where(and(eq(incomes.accountId, accountId), eq(incomes.userId, userId))),
      db
        .select()
        .from(expenses)
        .where(and(eq(expenses.accountId, accountId), eq(expenses.userId, userId))),
      db
        .select()
        .from(transfers)
        .where(
          and(
            eq(transfers.userId, userId),
            or(eq(transfers.sourceAccountId, accountId), eq(transfers.targetAccountId, accountId))
          )
        ),
    ]);

    const currentBalance = safeParseFloat(account.balance);
    const today = new Date();
    const projectedMonths: AccountForecast["projectedMonths"] = [];

    const isCumulativeAccount = account.type === "savings" || account.type === "etf";
    let cumulativeBalance = isCumulativeAccount ? currentBalance : 0;
    const baseCurrency = await getBaseCurrency();

    for (let i = 1; i <= months; i++) {
      const targetDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const targetMonth = targetDate.getMonth() + 1;
      const targetYear = targetDate.getFullYear();

      let monthIncome = 0;
      for (const income of accountIncomes) {
        const rawAmount = calculateIncomeForMonth(income, targetMonth, targetYear);
        monthIncome += toBase(rawAmount, income.currency, baseCurrency);
      }

      let monthExpenses = 0;
      for (const expense of accountExpenses) {
        const rawAmount = calculateExpenseForMonth(expense, targetMonth, targetYear);
        monthExpenses += toBase(rawAmount, expense.currency, baseCurrency);
      }

      let transfersIn = 0;
      let transfersOut = 0;
      for (const transfer of accountTransfers) {
        const rawAmount = calculateTransferForMonth(transfer, targetMonth, targetYear);
        if (rawAmount > 0) {
          const amount = toBase(rawAmount, transfer.sourceCurrency, baseCurrency);
          if (transfer.targetAccountId === accountId) {
            transfersIn += amount;
          } else if (transfer.sourceAccountId === accountId) {
            transfersOut += amount;
          }
        }
      }

      const monthBalance = monthIncome - monthExpenses + transfersIn - transfersOut;

      if (isCumulativeAccount) {
        cumulativeBalance += monthBalance;
      } else {
        cumulativeBalance = monthBalance;
      }

      projectedMonths.push({
        month: targetMonth,
        year: targetYear,
        monthName: MONTH_NAMES[targetMonth - 1],
        income: monthIncome,
        expenses: monthExpenses,
        transfersIn,
        transfersOut,
        balance: monthBalance,
        cumulativeBalance,
      });
    }

    return {
      success: true,
      data: {
        account,
        currentBalance,
        isCumulativeAccount,
        projectedMonths,
      },
    };
  } catch (error) {
    logger.error("Failed to generate forecast", "getAccountForecast", error);
    return { success: false, error: "Prognose konnte nicht erstellt werden." };
  }
}
