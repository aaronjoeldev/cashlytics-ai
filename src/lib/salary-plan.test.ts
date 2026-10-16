import assert from "node:assert/strict";
import test from "node:test";
import { averageMonthlySpending, splitIncome } from "./salary-plan";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

test("everyday average uses the last three full months, not the current one", () => {
  const entries = [
    { date: d("2026-06-30"), amount: 999 }, // four months back: ignored
    { date: d("2026-07-01"), amount: 400 },
    { date: d("2026-08-15"), amount: 500 },
    { date: d("2026-09-10"), amount: 250 },
    { date: d("2026-09-30"), amount: 350 },
    { date: d("2026-10-02"), amount: 999 }, // current month: ignored
  ];
  assert.deepEqual(averageMonthlySpending(entries, d("2026-10-16")), {
    average: 500,
    monthsWithData: 3,
  });
});

test("months without entries are left out of the average", () => {
  const entries = [{ date: d("2026-09-05"), amount: 300 }];
  assert.deepEqual(averageMonthlySpending(entries, d("2026-10-16")), {
    average: 300,
    monthsWithData: 1,
  });
  assert.deepEqual(averageMonthlySpending([], d("2026-10-16")), { average: 0, monthsWithData: 0 });
});

test("the average crosses the year boundary", () => {
  const entries = [
    { date: d("2025-11-20"), amount: 100 },
    { date: d("2025-12-20"), amount: 200 },
  ];
  assert.equal(averageMonthlySpending(entries, d("2026-01-05")).average, 150);
});

test("split: the remainder is what is left after all planned parts", () => {
  const split = splitIncome({
    income: 4000,
    fixed: 1200,
    reserves: 100,
    everyday: 500,
    savings: 500,
  });
  assert.equal(split.free, 1700);
  assert.equal(split.shares.fixed, 0.3);
  assert.equal(split.shares.free, 0.425);
  const sum = Object.values(split.shares).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

test("split: a plan above the income has a negative remainder and bars relative to the plan", () => {
  const split = splitIncome({ income: 1000, fixed: 800, reserves: 100, everyday: 300, savings: 0 });
  assert.equal(split.free, -200);
  assert.equal(split.shares.free, 0);
  assert.equal(split.shares.fixed, 800 / 1200);
});

test("split: no income and no plan gives empty shares", () => {
  const split = splitIncome({ income: 0, fixed: 0, reserves: 0, everyday: 0, savings: 0 });
  assert.equal(split.free, 0);
  assert.deepEqual(split.shares, { fixed: 0, reserves: 0, everyday: 0, savings: 0, free: 0 });
});
