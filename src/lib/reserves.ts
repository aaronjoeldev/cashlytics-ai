/**
 * Reserve plan math: bills that are due less often than monthly (quarterly, semiannual, yearly,
 * every n months) get a fixed monthly rate, amount ÷ interval. The rate never changes with the due
 * date; a pot that is short of its target shows the difference as a one-time amount.
 *
 * Dates are UTC-midnight calendar days, like everywhere in `recurrence.ts`.
 */
import { getNextOccurrence, getOccurrencesInMonth, type RecurringItem } from "@/lib/recurrence";

/** Months between two occurrences, or null for items that are due monthly or more often. */
export function reserveIntervalMonths(item: RecurringItem): number | null {
  switch (item.recurrenceType) {
    case "quarterly":
      return 3;
    case "semiannual":
      return 6;
    case "yearly":
      return 12;
    case "custom":
      return item.recurrenceInterval && item.recurrenceInterval > 1
        ? item.recurrenceInterval
        : null;
    default:
      return null;
  }
}

/** Calendar months from `from` to `to`; the day of month does not count. */
export function calendarMonthsBetween(from: Date, to: Date): number {
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth())
  );
}

export type ReserveTarget = {
  intervalMonths: number;
  monthlyRate: number;
  nextDue: Date | null;
  /** What the pot should hold today for this bill. */
  target: number;
};

/**
 * Target for one bill: the full amount minus the rates still to come before it is due. In the
 * month it is due the target is the full amount; right after it was paid the target is 0.
 * Returns null for items that are not reserve items.
 */
export function reserveTarget(
  item: RecurringItem,
  amount: number,
  today: Date
): ReserveTarget | null {
  const intervalMonths = reserveIntervalMonths(item);
  if (!intervalMonths) return null;

  const monthlyRate = amount / intervalMonths;
  const nextDue = getNextOccurrence(item, today);
  if (!nextDue) return { intervalMonths, monthlyRate: 0, nextDue: null, target: 0 };

  const ratesToCome = monthlyRate * calendarMonthsBetween(today, nextDue);
  const target = Math.min(amount, Math.max(0, amount - ratesToCome));
  return { intervalMonths, monthlyRate, nextDue, target };
}

/** Sum of `amount` over all occurrences after `after` up to and including `until`. */
export function sumOccurrencesBetween(
  item: RecurringItem,
  amount: number,
  after: Date,
  until: Date
): number {
  if (until.getTime() <= after.getTime()) return 0;
  let count = 0;
  const months = calendarMonthsBetween(after, until);
  for (let i = 0; i <= months; i++) {
    const year = after.getUTCFullYear() + Math.floor((after.getUTCMonth() + i) / 12);
    const month = ((after.getUTCMonth() + i) % 12) + 1;
    for (const day of getOccurrencesInMonth(item, year, month)) {
      if (day.getTime() > after.getTime() && day.getTime() <= until.getTime()) count++;
    }
  }
  return count * amount;
}

export type PotMovement = { item: RecurringItem; amount: number };

/**
 * Balance of the reserve pot today: the balance set on `balanceDate`, plus planned transfers into
 * the pot and minus planned transfers out and due reserve bills since then.
 */
export function potBalance({
  balance,
  balanceDate,
  today,
  deposits,
  withdrawals,
}: {
  balance: number;
  balanceDate: Date;
  today: Date;
  deposits: PotMovement[];
  withdrawals: PotMovement[];
}): number {
  const sum = (movements: PotMovement[]) =>
    movements.reduce(
      (total, m) => total + sumOccurrencesBetween(m.item, m.amount, balanceDate, today),
      0
    );
  return balance + sum(deposits) - sum(withdrawals);
}

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * Compares the pot with the plan: a one-time shortfall or surplus against today's target, and how
 * much of the monthly rate the planned transfers do not cover. All values are 0 or positive.
 */
export function potStatus({
  targetTotal,
  monthlyTotal,
  balance,
  plannedMonthlyDeposit,
}: {
  targetTotal: number;
  monthlyTotal: number;
  balance: number;
  plannedMonthlyDeposit: number;
}): { shortfall: number; surplus: number; depositGap: number } {
  return {
    shortfall: Math.max(0, cents(targetTotal - balance)),
    surplus: Math.max(0, cents(balance - targetTotal)),
    depositGap: Math.max(0, cents(monthlyTotal - plannedMonthlyDeposit)),
  };
}
