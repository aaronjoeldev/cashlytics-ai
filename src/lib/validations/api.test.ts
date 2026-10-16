import { test } from "node:test";
import assert from "node:assert/strict";
import { accountsQuery, paymentsQuery, searchParamsToObject, summaryQuery } from "./api";

const parse = <T>(schema: { safeParse: (v: unknown) => T }, query: string) =>
  schema.safeParse(searchParamsToObject(new URLSearchParams(query)));

test("summaryQuery applies defaults and coerces numbers", () => {
  assert.deepEqual(parse(summaryQuery, ""), {
    success: true,
    data: { upcomingDays: 7, forecastMonths: 3 },
  });
  assert.deepEqual(parse(summaryQuery, "upcomingDays=14&forecastMonths=12"), {
    success: true,
    data: { upcomingDays: 14, forecastMonths: 12 },
  });
});

test("summaryQuery and accountsQuery reject out-of-range values", () => {
  assert.equal(parse(summaryQuery, "upcomingDays=0").success, false);
  assert.equal(parse(summaryQuery, "upcomingDays=91").success, false);
  assert.equal(parse(summaryQuery, "forecastMonths=1.5").success, false);
  assert.equal(parse(accountsQuery, "forecastMonths=abc").success, false);
  assert.equal(parse(accountsQuery, "forecastMonths=25").success, false);
});

test("paymentsQuery parses calendar days as UTC midnight", () => {
  const result = parse(paymentsQuery, "start=2026-02-01&end=2026-02-28");
  if (!result.success) return assert.fail(result.error.message);
  assert.equal(result.data.start.toISOString(), "2026-02-01T00:00:00.000Z");
  assert.equal(result.data.end.toISOString(), "2026-02-28T00:00:00.000Z");
});

test("paymentsQuery rejects invalid days and ranges", () => {
  assert.equal(parse(paymentsQuery, "start=2026-02-01").success, false);
  assert.equal(parse(paymentsQuery, "start=2026-02-30&end=2026-03-01").success, false);
  assert.equal(parse(paymentsQuery, "start=2026-3-1&end=2026-03-02").success, false);
  assert.equal(parse(paymentsQuery, "start=2026-03-02&end=2026-03-01").success, false);
  assert.equal(parse(paymentsQuery, "start=2026-01-01&end=2027-01-01").success, true);
  assert.equal(parse(paymentsQuery, "start=2026-01-01&end=2027-01-02").success, false);
});
