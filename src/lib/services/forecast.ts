import { db } from "@/lib/db";
import { accounts, incomes, expenses, transfers } from "@/lib/db/schema";
import { eq, or, and } from "drizzle-orm";
import type { Account } from "@/types/database";
import { safeParseFloat } from "@/lib/safe-parse";
import { getDueAmountForMonth } from "@/lib/recurrence";
import { toBaseCurrency as toBase } from "@/lib/currency";
import type { FinanceContext } from "@/lib/services/context";

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

/**
 * Projects an account over the next `months` months (cashflow view, base currency). Savings and
 * ETF accounts accumulate from the current balance; checking accounts show each month's net.
 * Returns null when the account does not belong to the user.
 */
export async function computeAccountForecast(
  { userId, baseCurrency, rates }: FinanceContext,
  accountOrId: Account | string,
  months: number,
  today: Date = new Date()
): Promise<AccountForecast | null> {
  const account =
    typeof accountOrId === "string"
      ? (
          await db
            .select()
            .from(accounts)
            .where(and(eq(accounts.id, accountOrId), eq(accounts.userId, userId)))
            .limit(1)
        )[0]
      : accountOrId;

  if (!account || account.userId !== userId) return null;
  const accountId = account.id;

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

  // Projected flows are in the base currency, so the starting balance has to be as well
  const currentBalance = toBase(
    safeParseFloat(account.balance),
    account.currency,
    baseCurrency,
    rates
  );
  const projectedMonths: AccountForecast["projectedMonths"] = [];

  const isCumulativeAccount = account.type === "savings" || account.type === "etf";
  let cumulativeBalance = isCumulativeAccount ? currentBalance : 0;

  for (let i = 1; i <= months; i++) {
    const targetDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const targetMonth = targetDate.getMonth() + 1;
    const targetYear = targetDate.getFullYear();

    let monthIncome = 0;
    for (const income of accountIncomes) {
      const rawAmount = getDueAmountForMonth(
        income,
        safeParseFloat(income.amount),
        targetYear,
        targetMonth
      );
      monthIncome += toBase(rawAmount, income.currency, baseCurrency, rates);
    }

    let monthExpenses = 0;
    for (const expense of accountExpenses) {
      const rawAmount = getDueAmountForMonth(
        expense,
        safeParseFloat(expense.amount),
        targetYear,
        targetMonth
      );
      monthExpenses += toBase(rawAmount, expense.currency, baseCurrency, rates);
    }

    let transfersIn = 0;
    let transfersOut = 0;
    for (const transfer of accountTransfers) {
      const rawAmount = getDueAmountForMonth(
        transfer,
        safeParseFloat(transfer.amount),
        targetYear,
        targetMonth
      );
      if (rawAmount > 0) {
        const amount = toBase(rawAmount, transfer.sourceCurrency, baseCurrency, rates);
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
    account,
    currentBalance,
    isCumulativeAccount,
    projectedMonths,
  };
}
