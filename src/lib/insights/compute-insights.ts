import { safeParseFloat } from "@/lib/safe-parse";
import {
  exchangeRates,
  toBaseCurrency,
  type Currency,
  type ExchangeRateTable,
} from "@/lib/currency";

/** Months of history the average is taken over, at most. */
export const HISTORY_MONTHS = 3;
/** The spending pace is not judged before this day of the month; a few days say nothing. */
const BUDGET_WARNING_FROM_DAY = 7;

export interface ExpenseRow {
  categoryId: string | null;
  categoryName: string | null;
  amount: string;
  currency: string | null;
  date: Date;
}

export interface ComputedInsight {
  dedupKey: string;
  type: "spending_anomaly" | "budget_warning";
  title: string;
  message: string;
  severity: "info" | "warning";
}

interface ComputeInput {
  now: Date;
  baseCurrency: Currency;
  /** Exchange rates (base EUR) used to convert entries into the base currency */
  rates?: ExchangeRateTable;
  /** Date of the user's first daily expense, or null when there is none. */
  firstExpenseDate: Date | null;
  /** Daily expenses from the start of the history window up to the end of the current month. */
  rows: ExpenseRow[];
}

function monthIndex(date: Date): number {
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

export function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** Number of complete months before `now` the average can use, from 0 to HISTORY_MONTHS. */
export function getHistoryMonths(now: Date, firstExpenseDate: Date | null): number {
  if (!firstExpenseDate) return 0;
  return Math.max(0, Math.min(HISTORY_MONTHS, monthIndex(now) - monthIndex(firstExpenseDate)));
}

function toBase(row: ExpenseRow, baseCurrency: Currency, rates: ExchangeRateTable): number {
  return toBaseCurrency(safeParseFloat(row.amount), row.currency, baseCurrency, rates);
}

/**
 * Works out the insights for one user. Dates are calendar days stored as UTC midnight, so months
 * are UTC months.
 */
export function computeInsights({
  now,
  baseCurrency,
  rates = exchangeRates,
  firstExpenseDate,
  rows,
}: ComputeInput): ComputedInsight[] {
  const historyMonths = getHistoryMonths(now, firstExpenseDate);
  if (historyMonths === 0) return [];

  const currentMonth = monthIndex(now);
  const month = monthKey(now);
  const money = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: baseCurrency,
    maximumFractionDigits: 0,
  });

  const current = new Map<string, { name: string; total: number }>();
  const history = new Map<string, number>();
  for (const row of rows) {
    const key = row.categoryId ?? "none";
    const amount = toBase(row, baseCurrency, rates);
    const age = currentMonth - monthIndex(new Date(row.date));
    if (age === 0) {
      const entry = current.get(key) ?? { name: row.categoryName ?? "Ohne Kategorie", total: 0 };
      entry.total += amount;
      current.set(key, entry);
    } else if (age > 0 && age <= historyMonths) {
      history.set(key, (history.get(key) ?? 0) + amount);
    }
  }

  const result: ComputedInsight[] = [];

  // --- Spending anomaly per category ---
  for (const [key, { name, total }] of current) {
    const avg = (history.get(key) ?? 0) / historyMonths;
    if (avg > 0 && total > avg * 1.5 && total > 50) {
      const pctOver = Math.round(((total - avg) / avg) * 100);
      result.push({
        dedupKey: `spending_anomaly:${key}:${month}`,
        type: "spending_anomaly",
        title: `${name}: ${pctOver}% über Durchschnitt`,
        message: `Du hast diesen Monat ${money.format(total)} für "${name}" ausgegeben — das sind ${pctOver}% mehr als dein Durchschnitt ${historyMonths === 1 ? "des letzten Monats" : `der letzten ${historyMonths} Monate`} von ${money.format(avg)}.`,
        severity: pctOver > 100 ? "warning" : "info",
      });
    }
  }

  // --- Spending pace for the whole month ---
  const dayOfMonth = now.getUTCDate();
  if (dayOfMonth >= BUDGET_WARNING_FROM_DAY) {
    const daysInMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)
    ).getUTCDate();
    const monthProgress = dayOfMonth / daysInMonth;
    const totalCurrent = Array.from(current.values()).reduce((sum, c) => sum + c.total, 0);
    const totalAvg = Array.from(history.values()).reduce((sum, v) => sum + v, 0) / historyMonths;

    if (totalAvg > 0 && totalCurrent > totalAvg * monthProgress * 1.2) {
      const projected = totalCurrent / monthProgress;
      result.push({
        dedupKey: `budget_warning:${month}`,
        type: "budget_warning",
        title: "Ausgaben-Tempo über Plan",
        message: `Bei aktuellem Tempo wirst du diesen Monat ca. ${money.format(projected)} ausgeben — ${Math.round((projected / totalAvg - 1) * 100)}% mehr als üblich (${money.format(totalAvg)}).`,
        severity: "warning",
      });
    }
  }

  return result;
}
