import { db } from "@/lib/db";
import { accounts, categories, expenses, reservePots, transfers } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { safeParseFloat } from "@/lib/safe-parse";
import { toBaseCurrency as toBase } from "@/lib/currency";
import { getNextOccurrence, normalizeToMonthly } from "@/lib/recurrence";
import { potBalance, reserveTarget, type PotMovement } from "@/lib/reserves";
import type { FinanceContext } from "@/lib/services/context";

export type ReserveItem = {
  id: string;
  name: string;
  /** Bill amount in the base currency. */
  amount: number;
  recurrenceType: string;
  recurrenceInterval: number | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  monthlyRate: number;
  nextDue: Date | null;
  target: number;
};

export type ReservePot = {
  accountId: string;
  accountName: string;
  /** Balance today, computed from the set balance and the planned movements since then. */
  balance: number;
  balanceDate: Date;
  /** Planned transfers into the pot account, as a monthly amount. */
  plannedMonthlyDeposit: number;
};

export type ReservePlan = {
  /** Sorted by next due date, ended bills last. */
  items: ReserveItem[];
  monthlyTotal: number;
  targetTotal: number;
  /** null until the user picks a pot account. */
  pot: ReservePot | null;
};

/** Reserve plan of one user on `today` (a UTC-midnight calendar day), in the base currency. */
export async function computeReservePlan(
  { userId, baseCurrency, rates }: FinanceContext,
  today: Date
): Promise<ReservePlan> {
  const [expenseRows, [potRow]] = await Promise.all([
    db
      .select({ expense: expenses, category: categories })
      .from(expenses)
      .leftJoin(categories, eq(expenses.categoryId, categories.id))
      .where(eq(expenses.userId, userId)),
    db
      .select({ pot: reservePots, accountName: accounts.name })
      .from(reservePots)
      .leftJoin(accounts, and(eq(accounts.id, reservePots.accountId), eq(accounts.userId, userId)))
      .where(eq(reservePots.userId, userId))
      .limit(1),
  ]);

  const items: ReserveItem[] = [];
  const withdrawals: PotMovement[] = [];
  for (const { expense, category } of expenseRows) {
    const amount = toBase(safeParseFloat(expense.amount), expense.currency, baseCurrency, rates);
    const reserve = reserveTarget(expense, amount, today);
    if (!reserve) continue;
    withdrawals.push({ item: expense, amount });
    items.push({
      id: expense.id,
      name: expense.name,
      amount,
      recurrenceType: expense.recurrenceType,
      recurrenceInterval: expense.recurrenceInterval,
      categoryName: category?.name ?? null,
      categoryIcon: category?.icon ?? null,
      categoryColor: category?.color ?? null,
      monthlyRate: reserve.monthlyRate,
      nextDue: reserve.nextDue,
      target: reserve.target,
    });
  }
  items.sort((a, b) => (a.nextDue?.getTime() ?? Infinity) - (b.nextDue?.getTime() ?? Infinity));

  let pot: ReservePot | null = null;
  const accountId = potRow?.pot.accountId;
  if (potRow && accountId && potRow.accountName) {
    // Transfers out of the pot are not counted: they usually move the money for a bill that is
    // already taken out as a withdrawal
    const transferRows = await db
      .select()
      .from(transfers)
      .where(and(eq(transfers.userId, userId), eq(transfers.targetAccountId, accountId)));
    const deposits: PotMovement[] = [];
    let plannedMonthlyDeposit = 0;
    for (const transfer of transferRows) {
      const amount = toBase(
        safeParseFloat(transfer.amount),
        transfer.sourceCurrency,
        baseCurrency,
        rates
      );
      deposits.push({ item: transfer, amount });
      if (getNextOccurrence(transfer, today)) {
        plannedMonthlyDeposit += normalizeToMonthly(amount, transfer.recurrenceType);
      }
    }

    pot = {
      accountId,
      accountName: potRow.accountName,
      balance: potBalance({
        balance: toBase(
          safeParseFloat(potRow.pot.balance),
          potRow.pot.currency,
          baseCurrency,
          rates
        ),
        balanceDate: potRow.pot.balanceDate,
        today,
        deposits,
        withdrawals,
      }),
      balanceDate: potRow.pot.balanceDate,
      plannedMonthlyDeposit,
    };
  }

  return {
    items,
    monthlyTotal: items.reduce((sum, item) => sum + item.monthlyRate, 0),
    targetTotal: items.reduce((sum, item) => sum + item.target, 0),
    pot,
  };
}
