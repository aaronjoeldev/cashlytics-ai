import assert from "node:assert/strict";
import test from "node:test";
import { exchangeRates } from "@/lib/currency";
import { computeInsights, getHistoryMonths, type ExpenseRow } from "./compute-insights";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

function row(
  date: string,
  amount: number,
  categoryId: string | null = "food",
  currency = "EUR"
): ExpenseRow {
  return {
    categoryId,
    categoryName: categoryId === null ? null : "Essen",
    amount: amount.toFixed(2),
    currency,
    date: day(date),
  };
}

test("history months count complete months since the first expense, at most three", () => {
  assert.equal(getHistoryMonths(day("2026-10-15"), null), 0);
  assert.equal(getHistoryMonths(day("2026-10-15"), day("2026-10-01")), 0);
  assert.equal(getHistoryMonths(day("2026-10-15"), day("2026-09-30")), 1);
  assert.equal(getHistoryMonths(day("2026-10-15"), day("2025-01-01")), 3);
});

test("no insights without a previous month", () => {
  const result = computeInsights({
    now: day("2026-10-20"),
    baseCurrency: "EUR",
    firstExpenseDate: day("2026-10-01"),
    rows: [row("2026-10-02", 500)],
  });
  assert.deepEqual(result, []);
});

test("average uses the months that exist, not always three", () => {
  // One month of history with 100: this month's 200 is 100% over, not 500% over 33.
  const result = computeInsights({
    now: day("2026-10-03"),
    baseCurrency: "EUR",
    firstExpenseDate: day("2026-09-01"),
    rows: [row("2026-09-10", 100), row("2026-10-02", 200)],
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Essen: 100% über Durchschnitt");
  assert.match(result[0].message, /des letzten Monats/);
});

test("the key stays the same when the percentage changes", () => {
  const base = {
    now: day("2026-10-03"),
    baseCurrency: "EUR" as const,
    firstExpenseDate: day("2026-09-01"),
  };
  const first = computeInsights({
    ...base,
    rows: [row("2026-09-10", 100), row("2026-10-02", 200)],
  });
  const later = computeInsights({
    ...base,
    rows: [row("2026-09-10", 100), row("2026-10-02", 200), row("2026-10-03", 80)],
  });
  assert.notEqual(first[0].title, later[0].title);
  assert.equal(first[0].dedupKey, "spending_anomaly:food:2026-10");
  assert.equal(later[0].dedupKey, first[0].dedupKey);
});

test("uncategorised spending is named, not null", () => {
  const result = computeInsights({
    now: day("2026-10-03"),
    baseCurrency: "EUR",
    firstExpenseDate: day("2026-09-01"),
    rows: [row("2026-09-10", 100, null), row("2026-10-02", 200, null)],
  });
  assert.equal(result[0].title, "Ohne Kategorie: 100% über Durchschnitt");
  assert.equal(result[0].dedupKey, "spending_anomaly:none:2026-10");
});

test("amounts in other currencies are converted to the base currency", () => {
  // 100 EUR last month; 10,000 JPY this month is far below 150 EUR once converted
  const result = computeInsights({
    now: day("2026-10-03"),
    baseCurrency: "EUR",
    firstExpenseDate: day("2026-09-01"),
    rows: [row("2026-09-10", 100), row("2026-10-02", 10000, "food", "JPY")],
  });
  assert.deepEqual(result, []);
});

test("conversion uses the rates passed in", () => {
  // With 1 EUR = 10 JPY the same 10,000 JPY are 1,000 EUR, far above the 100 EUR average
  const result = computeInsights({
    now: day("2026-10-03"),
    baseCurrency: "EUR",
    rates: { ...exchangeRates, JPY: 10 },
    firstExpenseDate: day("2026-09-01"),
    rows: [row("2026-09-10", 100), row("2026-10-02", 10000, "food", "JPY")],
  });
  assert.equal(result[0]?.title, "Essen: 900% über Durchschnitt", JSON.stringify(result));
});

test("the spending pace is not judged in the first days of a month", () => {
  const rows = [row("2026-09-10", 300, "rent"), row("2026-10-01", 100, "rent")];
  const early = computeInsights({
    now: day("2026-10-01"),
    baseCurrency: "EUR",
    firstExpenseDate: day("2026-09-01"),
    rows,
  });
  assert.equal(
    early.find((i) => i.type === "budget_warning"),
    undefined
  );

  const later = computeInsights({
    now: day("2026-10-07"),
    baseCurrency: "EUR",
    firstExpenseDate: day("2026-09-01"),
    rows,
  });
  const warning = later.find((i) => i.type === "budget_warning");
  assert.ok(warning);
  assert.equal(warning.dedupKey, "budget_warning:2026-10");
});
