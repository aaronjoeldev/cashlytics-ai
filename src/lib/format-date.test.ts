import assert from "node:assert/strict";
import test from "node:test";
import { formatCalendarDate } from "./format-date";

test("calendar days are formatted in the app locale, not the runtime default", () => {
  assert.equal(formatCalendarDate("2026-10-13T00:00:00.000Z", "de"), "13.10.2026");
  assert.equal(formatCalendarDate("2026-10-13T00:00:00.000Z", "en"), "10/13/2026");
});

test("a UTC-midnight day does not shift to the previous day", () => {
  assert.equal(formatCalendarDate(new Date(Date.UTC(2026, 0, 1)), "de", { day: "numeric" }), "1");
});

test("invalid dates show a dash", () => {
  assert.equal(formatCalendarDate("not a date", "de"), "–");
});
