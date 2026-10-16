import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarMonthsBetween,
  potBalance,
  potStatus,
  reserveIntervalMonths,
  reserveTarget,
  sumOccurrencesBetween,
} from "./reserves";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const yearly = (start: string) => ({ recurrenceType: "yearly", startDate: d(start) });

test("only bills due less often than monthly are reserve items", () => {
  assert.equal(
    reserveIntervalMonths({ recurrenceType: "quarterly", startDate: d("2026-01-01") }),
    3
  );
  assert.equal(
    reserveIntervalMonths({ recurrenceType: "semiannual", startDate: d("2026-01-01") }),
    6
  );
  assert.equal(reserveIntervalMonths(yearly("2026-01-01")), 12);
  assert.equal(
    reserveIntervalMonths({
      recurrenceType: "custom",
      recurrenceInterval: 4,
      startDate: d("2026-01-01"),
    }),
    4
  );
  for (const recurrenceType of ["once", "daily", "weekly", "monthly"]) {
    assert.equal(reserveIntervalMonths({ recurrenceType, startDate: d("2026-01-01") }), null);
  }
  assert.equal(
    reserveIntervalMonths({
      recurrenceType: "custom",
      recurrenceInterval: 1,
      startDate: d("2026-01-01"),
    }),
    null
  );
});

test("calendar months ignore the day of month", () => {
  assert.equal(calendarMonthsBetween(d("2026-10-31"), d("2026-11-01")), 1);
  assert.equal(calendarMonthsBetween(d("2026-10-16"), d("2027-01-15")), 3);
  assert.equal(calendarMonthsBetween(d("2026-10-16"), d("2026-10-30")), 0);
});

test("yearly bill: fixed rate, target is the amount minus the rates still to come", () => {
  // 1,140 € due on 15 January, today 16 October: 95 €/month, three rates to come
  const r = reserveTarget(yearly("2026-01-15"), 1140, d("2026-10-16"));
  assert.equal(r?.monthlyRate, 95);
  assert.equal(r?.nextDue?.toISOString().slice(0, 10), "2027-01-15");
  assert.equal(r?.target, 855);
});

test("the rate does not depend on how close the due date is", () => {
  const far = reserveTarget(yearly("2026-09-01"), 1200, d("2026-10-16"));
  const near = reserveTarget(yearly("2026-11-01"), 1200, d("2026-10-16"));
  assert.equal(far?.monthlyRate, 100);
  assert.equal(near?.monthlyRate, 100);
  // Due next month: one rate to come, so 1,100 € should be in the pot already
  assert.equal(near?.target, 1100);
  // Paid last month: 11 rates to come
  assert.equal(far?.target, 100);
});

test("target is the full amount in the due month and 0 right after it was paid", () => {
  assert.equal(reserveTarget(yearly("2026-01-20"), 600, d("2027-01-05"))?.target, 600);
  assert.equal(reserveTarget(yearly("2026-01-20"), 600, d("2027-01-20"))?.target, 600);
  assert.equal(reserveTarget(yearly("2026-01-20"), 600, d("2027-01-21"))?.target, 0);
});

test("a bill that starts in the future is still saved for with the fixed rate", () => {
  // First due in 14 months: the target stays 0 until twelve months are left
  const r = reserveTarget(yearly("2027-12-01"), 1200, d("2026-10-16"));
  assert.equal(r?.monthlyRate, 100);
  assert.equal(r?.target, 0);
});

test("an ended bill needs no reserve", () => {
  const r = reserveTarget(
    { ...yearly("2024-03-01"), endDate: d("2026-03-01") },
    500,
    d("2026-10-16")
  );
  assert.deepEqual(r, { intervalMonths: 12, monthlyRate: 0, nextDue: null, target: 0 });
  assert.equal(
    reserveTarget({ recurrenceType: "monthly", startDate: d("2026-01-01") }, 50, d("2026-10-16")),
    null
  );
});

test("occurrences are counted after the start day up to and including the end day", () => {
  const monthly = { recurrenceType: "monthly", startDate: d("2026-01-01") };
  assert.equal(sumOccurrencesBetween(monthly, 100, d("2026-10-01"), d("2026-12-01")), 200);
  assert.equal(sumOccurrencesBetween(monthly, 100, d("2026-10-16"), d("2026-10-16")), 0);
  assert.equal(sumOccurrencesBetween(monthly, 100, d("2026-10-16"), d("2026-10-01")), 0);
});

test("pot balance adds planned deposits and takes out due bills", () => {
  const balance = potBalance({
    balance: 500,
    balanceDate: d("2026-10-16"),
    today: d("2027-02-16"),
    // 100 € on the first of every month: November to February
    deposits: [{ item: { recurrenceType: "monthly", startDate: d("2026-01-01") }, amount: 100 }],
    // 300 € yearly bill on 10 January
    withdrawals: [{ item: yearly("2026-01-10"), amount: 300 }],
  });
  assert.equal(balance, 500 + 400 - 300);
});

test("pot status: one-time shortfall or surplus and the uncovered part of the monthly rate", () => {
  assert.deepEqual(
    potStatus({ targetTotal: 855, monthlyTotal: 95, balance: 600, plannedMonthlyDeposit: 50 }),
    { shortfall: 255, surplus: 0, depositGap: 45 }
  );
  assert.deepEqual(
    potStatus({ targetTotal: 855, monthlyTotal: 95, balance: 900, plannedMonthlyDeposit: 100 }),
    { shortfall: 0, surplus: 45, depositGap: 0 }
  );
  // Float noise below a cent is not reported
  assert.deepEqual(
    potStatus({
      targetTotal: 0.1 + 0.2,
      monthlyTotal: 0.3,
      balance: 0.3,
      plannedMonthlyDeposit: 0.1 + 0.2,
    }),
    { shortfall: 0, surplus: 0, depositGap: 0 }
  );
});
