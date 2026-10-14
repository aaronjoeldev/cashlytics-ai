import assert from "node:assert/strict";
import test from "node:test";
import {
  countOccurrencesInMonth,
  getBudgetedAmountForMonth,
  getDueAmountForMonth,
  getNextOccurrence,
  getOccurrencesInMonth,
  isActiveInMonth,
  isDueOn,
  normalizeToMonthly,
} from "./recurrence";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const days = (dates: Date[]) => dates.map((date) => date.toISOString().slice(0, 10));

test("once is due only on its date", () => {
  const item = { startDate: d("2026-11-20"), recurrenceType: "once" };
  assert.deepEqual(days(getOccurrencesInMonth(item, 2026, 11)), ["2026-11-20"]);
  assert.equal(countOccurrencesInMonth(item, 2026, 10), 0);
  assert.equal(countOccurrencesInMonth(item, 2026, 12), 0);
});

test("daily counts every day of the month", () => {
  const item = { startDate: d("2026-01-01"), recurrenceType: "daily" };
  assert.equal(countOccurrencesInMonth(item, 2026, 10), 31);
  assert.equal(countOccurrencesInMonth(item, 2026, 2), 28);
});

test("daily respects start and end inside the month", () => {
  const item = { startDate: d("2026-10-05"), endDate: d("2026-10-10"), recurrenceType: "daily" };
  assert.equal(countOccurrencesInMonth(item, 2026, 10), 6);
});

test("weekly falls on the start weekday, four or five times a month", () => {
  // 2026-10-01 is a Thursday; October 2026 has five Thursdays.
  const item = { startDate: d("2026-10-01"), recurrenceType: "weekly" };
  assert.deepEqual(days(getOccurrencesInMonth(item, 2026, 10)), [
    "2026-10-01",
    "2026-10-08",
    "2026-10-15",
    "2026-10-22",
    "2026-10-29",
  ]);
  assert.equal(countOccurrencesInMonth(item, 2026, 11), 4);
});

test("monthly starting after the 15th is still due in its first month", () => {
  const item = { startDate: d("2026-11-25"), recurrenceType: "monthly" };
  assert.deepEqual(days(getOccurrencesInMonth(item, 2026, 11)), ["2026-11-25"]);
  assert.equal(countOccurrencesInMonth(item, 2026, 10), 0);
});

test("monthly on the 31st is clamped to the last day of shorter months", () => {
  const item = { startDate: d("2026-01-31"), recurrenceType: "monthly" };
  assert.deepEqual(days(getOccurrencesInMonth(item, 2026, 2)), ["2026-02-28"]);
  assert.deepEqual(days(getOccurrencesInMonth(item, 2026, 4)), ["2026-04-30"]);
});

test("monthly is not due after its end date within the month", () => {
  const item = { startDate: d("2026-01-20"), endDate: d("2026-10-14"), recurrenceType: "monthly" };
  assert.equal(countOccurrencesInMonth(item, 2026, 10), 0);
  assert.equal(countOccurrencesInMonth(item, 2026, 9), 1);
});

test("quarterly, semiannual and yearly follow the start month across years", () => {
  const start = d("2025-11-15");
  const quarterly = { startDate: start, recurrenceType: "quarterly" };
  const semiannual = { startDate: start, recurrenceType: "semiannual" };
  const yearly = { startDate: start, recurrenceType: "yearly" };

  assert.equal(countOccurrencesInMonth(quarterly, 2026, 2), 1);
  assert.equal(countOccurrencesInMonth(quarterly, 2026, 3), 0);
  assert.equal(countOccurrencesInMonth(semiannual, 2026, 5), 1);
  assert.equal(countOccurrencesInMonth(semiannual, 2026, 2), 0);
  assert.equal(countOccurrencesInMonth(yearly, 2026, 11), 1);
  assert.equal(countOccurrencesInMonth(yearly, 2026, 5), 0);
});

test("yearly on Feb 29 is due on Feb 28 in non-leap years", () => {
  const item = { startDate: d("2024-02-29"), recurrenceType: "yearly" };
  assert.deepEqual(days(getOccurrencesInMonth(item, 2026, 2)), ["2026-02-28"]);
  assert.deepEqual(days(getOccurrencesInMonth(item, 2028, 2)), ["2028-02-29"]);
});

test("custom interval is in months", () => {
  const item = { startDate: d("2026-01-10"), recurrenceType: "custom", recurrenceInterval: 2 };
  assert.equal(countOccurrencesInMonth(item, 2026, 2), 0);
  assert.deepEqual(days(getOccurrencesInMonth(item, 2026, 3)), ["2026-03-10"]);
});

test("custom without an interval behaves like monthly", () => {
  const item = { startDate: d("2026-01-10"), recurrenceType: "custom", recurrenceInterval: null };
  assert.equal(countOccurrencesInMonth(item, 2026, 2), 1);
});

test("nothing is due before the start month", () => {
  const item = { startDate: d("2027-01-15"), recurrenceType: "monthly" };
  assert.equal(countOccurrencesInMonth(item, 2026, 10), 0);
  assert.equal(isActiveInMonth(item, 2026, 10), false);
});

test("isDueOn matches a single day", () => {
  const item = { startDate: d("2026-01-10"), recurrenceType: "custom", recurrenceInterval: 2 };
  assert.equal(isDueOn(item, d("2026-03-10")), true);
  assert.equal(isDueOn(item, d("2026-03-12")), false);
  assert.equal(isDueOn(item, d("2026-02-10")), false);
});

test("next occurrence of a yearly item later this year is this year", () => {
  const item = { startDate: d("2024-10-20"), recurrenceType: "yearly" };
  assert.deepEqual(days([getNextOccurrence(item, d("2026-10-13"))!]), ["2026-10-20"]);
  assert.deepEqual(days([getNextOccurrence(item, d("2026-10-21"))!]), ["2027-10-20"]);
});

test("next occurrence includes a payment due today", () => {
  const item = { startDate: d("2026-01-13"), recurrenceType: "monthly" };
  assert.deepEqual(days([getNextOccurrence(item, new Date("2026-10-13T15:30:00.000Z"))!]), [
    "2026-10-13",
  ]);
});

test("next occurrence handles semiannual and custom intervals", () => {
  const semiannual = { startDate: d("2026-01-05"), recurrenceType: "semiannual" };
  const custom = { startDate: d("2026-01-05"), recurrenceType: "custom", recurrenceInterval: 18 };
  assert.deepEqual(days([getNextOccurrence(semiannual, d("2026-10-13"))!]), ["2027-01-05"]);
  assert.deepEqual(days([getNextOccurrence(custom, d("2026-10-13"))!]), ["2027-07-05"]);
});

test("next occurrence is the start date for items that have not started", () => {
  const item = { startDate: d("2027-01-15"), recurrenceType: "monthly" };
  assert.deepEqual(days([getNextOccurrence(item, d("2026-10-13"))!]), ["2027-01-15"]);
});

test("next occurrence is null once the item has ended", () => {
  const ended = { startDate: d("2026-01-20"), endDate: d("2026-10-14"), recurrenceType: "monthly" };
  const pastOnce = { startDate: d("2026-01-20"), recurrenceType: "once" };
  assert.equal(getNextOccurrence(ended, d("2026-10-13")), null);
  assert.equal(getNextOccurrence(pastOnce, d("2026-10-13")), null);
});

test("next weekly occurrence is the next matching weekday", () => {
  const item = { startDate: d("2026-10-01"), recurrenceType: "weekly" };
  assert.deepEqual(days([getNextOccurrence(item, d("2026-10-30"))!]), ["2026-11-05"]);
});

test("normalizeToMonthly smooths recurring amounts", () => {
  assert.equal(normalizeToMonthly(1200, "yearly"), 100);
  assert.equal(normalizeToMonthly(300, "quarterly"), 100);
  assert.equal(normalizeToMonthly(600, "semiannual"), 100);
  assert.equal(normalizeToMonthly(200, "custom", 2), 100);
  assert.equal(normalizeToMonthly(5, "daily"), 150);
  assert.equal(normalizeToMonthly(100, "once"), 0);
});

test("budgeted amount counts a one-time item in full in its month only", () => {
  const once = { startDate: d("2026-10-20"), recurrenceType: "once" };
  assert.equal(getBudgetedAmountForMonth(once, 1200, 2026, 10), 1200);
  assert.equal(getBudgetedAmountForMonth(once, 1200, 2026, 11), 0);
});

test("budgeted amount stops after the end date", () => {
  const income = {
    startDate: d("2026-01-01"),
    endDate: d("2026-06-30"),
    recurrenceType: "monthly",
  };
  assert.equal(getBudgetedAmountForMonth(income, 3000, 2026, 6), 3000);
  assert.equal(getBudgetedAmountForMonth(income, 3000, 2026, 10), 0);
});

test("due amount multiplies by the number of due dates", () => {
  const daily = { startDate: d("2026-01-01"), recurrenceType: "daily" };
  const weekly = { startDate: d("2026-10-01"), recurrenceType: "weekly" };
  const yearly = { startDate: d("2025-11-15"), recurrenceType: "yearly" };
  assert.equal(getDueAmountForMonth(daily, 5, 2026, 10), 155);
  assert.equal(getDueAmountForMonth(weekly, 10, 2026, 10), 50);
  assert.equal(getDueAmountForMonth(yearly, 600, 2026, 11), 600);
  assert.equal(getDueAmountForMonth(yearly, 600, 2026, 10), 0);
});
