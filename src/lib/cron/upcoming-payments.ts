import { and, isNull, gte, or, eq } from "drizzle-orm";
import { differenceInDays, startOfDay, addDays } from "date-fns";
import { db } from "@/lib/db";
import { expenses, accounts } from "@/lib/db/schema";
import { sendPushNotification } from "@/lib/push";
import { defaultCurrency } from "@/lib/currency";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RecurrenceType =
  | "once"
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "yearly"
  | "custom";

interface ExpenseRow {
  id: string;
  userId: string;
  name: string;
  amount: string; // decimal comes back as string from Drizzle/pg
  recurrenceType: RecurrenceType;
  recurrenceInterval: number | null;
  startDate: Date;
  endDate: Date | null;
  currency: string; // from joined account, defaults to "EUR"
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Number of days in the given year/month (0-indexed month). */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Returns true when a payment for the given expense falls on `tomorrow`.
 * All comparisons are date-only (no time component).
 */
function isDueTomorrow(
  expense: Pick<ExpenseRow, "recurrenceType" | "recurrenceInterval" | "startDate">,
  tomorrow: Date
): boolean {
  const start = startOfDay(expense.startDate);
  const target = startOfDay(tomorrow);

  // Expense cannot be due before it starts
  if (start > target) return false;

  const daysDiff = differenceInDays(target, start);

  switch (expense.recurrenceType) {
    case "once":
      return daysDiff === 0;

    case "daily":
      // Due every day from startDate onwards (active check already handled by query)
      return true;

    case "weekly":
      return daysDiff % 7 === 0;

    case "monthly": {
      const startDay = expense.startDate.getDate();
      const targetYear = target.getFullYear();
      const targetMonth = target.getMonth();
      const maxDay = daysInMonth(targetYear, targetMonth);
      // If startDate day exceeds days in target month, treat last day as due day
      const effectiveDay = startDay > maxDay ? maxDay : startDay;
      return target.getDate() === effectiveDay;
    }

    case "quarterly": {
      const startDay = expense.startDate.getDate();
      const targetYear = target.getFullYear();
      const targetMonth = target.getMonth();
      const startMonth = expense.startDate.getMonth();
      const startYear = expense.startDate.getFullYear();
      const totalMonths = (targetYear - startYear) * 12 + (targetMonth - startMonth);
      if (totalMonths < 0 || totalMonths % 3 !== 0) return false;
      const maxDay = daysInMonth(targetYear, targetMonth);
      const effectiveDay = startDay > maxDay ? maxDay : startDay;
      return target.getDate() === effectiveDay;
    }

    case "semiannual": {
      const startDay = expense.startDate.getDate();
      const targetYear = target.getFullYear();
      const targetMonth = target.getMonth();
      const startMonth = expense.startDate.getMonth();
      const startYear = expense.startDate.getFullYear();
      const totalMonths = (targetYear - startYear) * 12 + (targetMonth - startMonth);
      if (totalMonths < 0 || totalMonths % 6 !== 0) return false;
      const maxDay = daysInMonth(targetYear, targetMonth);
      const effectiveDay = startDay > maxDay ? maxDay : startDay;
      return target.getDate() === effectiveDay;
    }

    case "yearly":
      return (
        expense.startDate.getMonth() === target.getMonth() &&
        expense.startDate.getDate() === target.getDate()
      );

    case "custom": {
      const interval = expense.recurrenceInterval;
      if (!interval || interval <= 0) return false;
      return daysDiff % interval === 0;
    }

    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Amount formatting
// ---------------------------------------------------------------------------

/**
 * Formats a decimal amount string into a human-readable German-locale string.
 * EUR  → "29,99 €"
 * USD  → "29.99 $"  (en-US style for non-EUR)
 * Other currencies use their symbol appended after the value.
 */
function formatAmount(amountStr: string, currency: string): string {
  const amount = parseFloat(amountStr);

  if (currency === "EUR") {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  // For non-EUR currencies use a neutral locale but keep currency symbol
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function checkUpcomingPayments(): Promise<{
  notified: number;
  total: number;
}> {
  const tomorrow = addDays(startOfDay(new Date()), 1);

  // Query all active expenses joined with their account for currency.
  // Active = endDate IS NULL OR endDate >= tomorrow
  const rows = await db
    .select({
      id: expenses.id,
      userId: expenses.userId,
      name: expenses.name,
      amount: expenses.amount,
      recurrenceType: expenses.recurrenceType,
      recurrenceInterval: expenses.recurrenceInterval,
      startDate: expenses.startDate,
      endDate: expenses.endDate,
      currency: accounts.currency,
    })
    .from(expenses)
    .leftJoin(accounts, eq(expenses.accountId, accounts.id))
    .where(or(isNull(expenses.endDate), gte(expenses.endDate, tomorrow)));

  // Coerce rows into the typed shape (currency may be null if no account linked)
  const typedRows: ExpenseRow[] = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    name: r.name,
    amount: r.amount,
    recurrenceType: r.recurrenceType as RecurrenceType,
    recurrenceInterval: r.recurrenceInterval,
    startDate: r.startDate,
    endDate: r.endDate ?? null,
    currency: r.currency ?? defaultCurrency,
  }));

  // Filter to expenses due tomorrow
  const dueTomorrow = typedRows.filter((expense) => isDueTomorrow(expense, tomorrow));

  const total = dueTomorrow.length;

  // Group by userId
  const byUser = new Map<string, ExpenseRow[]>();
  for (const expense of dueTomorrow) {
    const group = byUser.get(expense.userId) ?? [];
    group.push(expense);
    byUser.set(expense.userId, group);
  }

  // Send one push notification per expense per user
  let notified = 0;

  const sendPromises: Promise<void>[] = [];

  for (const [userId, userExpenses] of byUser) {
    for (const expense of userExpenses) {
      const body = `${expense.name} — ${formatAmount(expense.amount, expense.currency)}`;

      sendPromises.push(
        sendPushNotification(userId, {
          title: "Zahlung morgen fällig",
          body,
          url: "/expenses",
        }).then(() => {
          notified++;
        })
      );
    }
  }

  // Settle all notifications; log individual failures but do not abort
  const results = await Promise.allSettled(sendPromises);

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    console.error(
      `[checkUpcomingPayments] ${failed.length}/${sendPromises.length} push notifications failed`
    );
  }

  return { notified, total };
}
