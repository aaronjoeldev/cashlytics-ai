/**
 * Single source of truth for recurrence math (expenses, incomes, transfers).
 *
 * Dates are stored as UTC midnight (date inputs use `valueAsDate`), so every calculation here
 * works on UTC calendar days. Months are 1-based.
 */

export interface RecurringItem {
  startDate: Date | string;
  endDate?: Date | string | null;
  recurrenceType: string;
  recurrenceInterval?: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcDay(date: Date | string): number {
  const d = new Date(date);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * The calendar day shown by the local clock, as a UTC-midnight date. Use it as `from` when the
 * result is compared against "today" in the browser.
 */
export function getLocalCalendarDay(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/**
 * The calendar day in `timeZone`, as a UTC-midnight date. Server and browser get the same day, so
 * use it for "today" in anything that is rendered on the server.
 */
export function getCalendarDayInTimeZone(timeZone: string, date: Date = new Date()): Date {
  // en-CA formats as YYYY-MM-DD, which Date.parse reads as UTC midnight
  return new Date(Date.parse(new Intl.DateTimeFormat("en-CA", { timeZone }).format(date)));
}

/** Number of months between two occurrences, or null for types that are not month-based. */
function getMonthStep(item: RecurringItem): number | null {
  switch (item.recurrenceType) {
    case "monthly":
      return 1;
    case "quarterly":
      return 3;
    case "semiannual":
      return 6;
    case "yearly":
      return 12;
    case "custom":
      return item.recurrenceInterval && item.recurrenceInterval > 0 ? item.recurrenceInterval : 1;
    default:
      return null;
  }
}

/** True when the item has started by the end of the month and has not ended before it. */
export function isActiveInMonth(item: RecurringItem, year: number, month: number): boolean {
  const monthStart = Date.UTC(year, month - 1, 1);
  const monthEnd = Date.UTC(year, month - 1, daysInMonth(year, month));
  if (toUtcDay(item.startDate) > monthEnd) return false;
  if (item.endDate && toUtcDay(item.endDate) < monthStart) return false;
  return true;
}

/**
 * All days in the given month on which the item is due, as UTC-midnight dates.
 * Month-based items fall on the start date's day of month, clamped to the last day of
 * shorter months (a start on the 31st is due on Feb 28/29).
 */
export function getOccurrencesInMonth(item: RecurringItem, year: number, month: number): Date[] {
  if (!isActiveInMonth(item, year, month)) return [];

  const start = toUtcDay(item.startDate);
  const end = item.endDate ? toUtcDay(item.endDate) : Infinity;
  const monthStart = Date.UTC(year, month - 1, 1);
  const monthLength = daysInMonth(year, month);
  const first = Math.max(start, monthStart);
  const last = Math.min(end, Date.UTC(year, month - 1, monthLength));

  const days: number[] = [];

  switch (item.recurrenceType) {
    case "once":
      days.push(start);
      break;
    case "daily":
      for (let day = first; day <= last; day += DAY_MS) days.push(day);
      break;
    case "weekly": {
      const weeksToSkip = Math.ceil((first - start) / (7 * DAY_MS));
      for (let day = start + weeksToSkip * 7 * DAY_MS; day <= last; day += 7 * DAY_MS) {
        days.push(day);
      }
      break;
    }
    default: {
      const step = getMonthStep(item);
      if (step === null) break;
      const startDate = new Date(start);
      const monthsSinceStart =
        (year - startDate.getUTCFullYear()) * 12 + (month - 1 - startDate.getUTCMonth());
      if (monthsSinceStart < 0 || monthsSinceStart % step !== 0) break;
      days.push(Date.UTC(year, month - 1, Math.min(startDate.getUTCDate(), monthLength)));
    }
  }

  return days.filter((day) => day >= first && day <= last).map((day) => new Date(day));
}

export function countOccurrencesInMonth(item: RecurringItem, year: number, month: number): number {
  return getOccurrencesInMonth(item, year, month).length;
}

/** True when the item is due on the calendar day of `date`. */
export function isDueOn(item: RecurringItem, date: Date): boolean {
  const day = toUtcDay(date);
  const d = new Date(day);
  return getOccurrencesInMonth(item, d.getUTCFullYear(), d.getUTCMonth() + 1).some(
    (occurrence) => occurrence.getTime() === day
  );
}

/**
 * The next due date on or after the calendar day of `from`, or null when the item has ended
 * (or is a one-time item in the past).
 */
export function getNextOccurrence(item: RecurringItem, from: Date = new Date()): Date | null {
  const fromDay = Math.max(toUtcDay(from), toUtcDay(item.startDate));
  if (item.endDate && toUtcDay(item.endDate) < fromDay) return null;

  const cursor = new Date(fromDay);
  const monthsToScan = (getMonthStep(item) ?? 1) + 1;

  for (let i = 0; i < monthsToScan; i++) {
    const year = cursor.getUTCFullYear() + Math.floor((cursor.getUTCMonth() + i) / 12);
    const month = ((cursor.getUTCMonth() + i) % 12) + 1;
    const next = getOccurrencesInMonth(item, year, month).find(
      (occurrence) => occurrence.getTime() >= fromDay
    );
    if (next) return next;
  }

  return null;
}

/**
 * Smoothed monthly average of a recurring amount (the "reserve" view: what to set aside per
 * month). One-time items have no monthly average and return 0.
 */
export function normalizeToMonthly(
  amount: number,
  recurrenceType: string,
  recurrenceInterval?: number | null
): number {
  switch (recurrenceType) {
    case "daily":
      return amount * 30;
    case "weekly":
      return amount * 4.33;
    case "monthly":
      return amount;
    case "quarterly":
      return amount / 3;
    case "semiannual":
      return amount / 6;
    case "yearly":
      return amount / 12;
    case "custom":
      return recurrenceInterval && recurrenceInterval > 0 ? amount / recurrenceInterval : amount;
    default:
      return 0;
  }
}

/**
 * Amount to budget for the item in a given month: the smoothed average while a recurring item
 * is active, or the full amount of a one-time item in the month it is due.
 */
export function getBudgetedAmountForMonth(
  item: RecurringItem,
  amount: number,
  year: number,
  month: number
): number {
  if (item.recurrenceType === "once") {
    return countOccurrencesInMonth(item, year, month) > 0 ? amount : 0;
  }
  if (!isActiveInMonth(item, year, month)) return 0;
  return normalizeToMonthly(amount, item.recurrenceType, item.recurrenceInterval);
}

/** Amount actually due in a given month: the amount times the number of due dates. */
export function getDueAmountForMonth(
  item: RecurringItem,
  amount: number,
  year: number,
  month: number
): number {
  return amount * countOccurrencesInMonth(item, year, month);
}
