import assert from "node:assert/strict";
import test from "node:test";
import {
  changesDateRange,
  checkUpdatedRange,
  createAccountInput,
  createCategoryInput,
  createDailyExpenseInput,
  createExpenseInput,
  createIncomeInput,
  createTransferInput,
  parseInput,
  roundDecimal,
  updateAccountInput,
  updateExpenseInput,
} from "./action-input";

const ACCOUNT = "a0000000-0000-4000-8000-000000000001";
const OTHER_ACCOUNT = "a0000000-0000-4000-8000-000000000002";

const validExpense = {
  accountId: ACCOUNT,
  name: "Miete",
  amount: "950",
  recurrenceType: "monthly",
  startDate: new Date("2026-01-01T00:00:00Z"),
};

test("amounts are normalised to two decimals and accept numbers", () => {
  const fromString = parseInput(createExpenseInput, { ...validExpense, amount: " 12.5 " });
  assert.ok(fromString.success);
  assert.equal(fromString.data.amount, "12.50");

  const fromNumber = parseInput(createDailyExpenseInput, {
    accountId: ACCOUNT,
    description: "REWE",
    amount: 0.1 + 0.2,
    date: "2026-03-01",
  });
  assert.ok(fromNumber.success);
  assert.equal(fromNumber.data.amount, "0.30");
});

test("amounts round half away from zero on the decimal digits", () => {
  assert.equal(roundDecimal(5.555, 2), "5.56");
  assert.equal(roundDecimal(1.005, 2), "1.01");
  assert.equal(roundDecimal(-5.555, 2), "-5.56");
  assert.equal(roundDecimal(5.554, 2), "5.55");
  assert.equal(roundDecimal(1.0000005, 6), "1.000001");
  assert.equal(roundDecimal(12, 2), "12.00");

  const result = parseInput(createDailyExpenseInput, {
    accountId: ACCOUNT,
    description: "REWE",
    amount: "5.555",
    date: "2026-03-01",
  });
  assert.ok(result.success);
  assert.equal(result.data.amount, "5.56");
});

test("negative, zero, non-numeric and oversized amounts are rejected", () => {
  for (const amount of ["-5", "0", "", "abc", "12,50", "1e11", Number.NaN, Infinity]) {
    const result = parseInput(createExpenseInput, { ...validExpense, amount });
    assert.equal(result.success, false, `amount ${String(amount)} should be rejected`);
  }
});

test("account balance may be negative but must be a number", () => {
  const negative = parseInput(createAccountInput, {
    name: "Giro",
    type: "checking",
    balance: "-250.5",
    currency: "EUR",
  });
  assert.ok(negative.success);
  assert.equal(negative.data.balance, "-250.50");

  const defaulted = parseInput(createAccountInput, {
    name: "Giro",
    type: "checking",
    currency: "EUR",
  });
  assert.ok(defaulted.success);
  assert.equal(defaulted.data.balance, "0.00");

  assert.equal(parseInput(updateAccountInput, { balance: "viel" }).success, false);
});

test("unknown keys such as userId and id are dropped", () => {
  const result = parseInput(createExpenseInput, {
    ...validExpense,
    userId: "00000000-0000-0000-0000-000000000099",
    id: "00000000-0000-0000-0000-000000000098",
    createdAt: new Date(0),
  });
  assert.ok(result.success);
  assert.equal("userId" in result.data, false);
  assert.equal("id" in result.data, false);
  assert.equal("createdAt" in result.data, false);
});

test("enums, currencies and ids are checked", () => {
  assert.equal(
    parseInput(createExpenseInput, { ...validExpense, recurrenceType: "hourly" }).success,
    false
  );
  assert.equal(parseInput(createExpenseInput, { ...validExpense, currency: "XXX" }).success, false);
  assert.equal(parseInput(createExpenseInput, { ...validExpense, accountId: "1" }).success, false);
  assert.equal(
    parseInput(createIncomeInput, {
      accountId: ACCOUNT,
      source: "Gehalt",
      amount: "3000",
      recurrenceType: "weekly",
      startDate: "2026-01-01",
    }).success,
    false
  );
  assert.equal(
    parseInput(createAccountInput, { name: "X", type: "crypto", currency: "EUR" }).success,
    false
  );
});

test("dates are coerced from strings and invalid dates are rejected", () => {
  const parsed = parseInput(createExpenseInput, { ...validExpense, startDate: "2026-02-01" });
  assert.ok(parsed.success);
  assert.ok(parsed.data.startDate instanceof Date);

  assert.equal(
    parseInput(createExpenseInput, { ...validExpense, startDate: "not a date" }).success,
    false
  );
  assert.equal(
    parseInput(createExpenseInput, { ...validExpense, startDate: "9999-01-01" }).success,
    false
  );
});

test("end date before start date is rejected on create and on update", () => {
  const create = parseInput(createExpenseInput, {
    ...validExpense,
    endDate: new Date("2025-12-01T00:00:00Z"),
  });
  assert.equal(create.success, false);

  const update = parseInput(updateExpenseInput, {
    startDate: "2026-05-01",
    endDate: "2026-04-01",
  });
  assert.equal(update.success, false);

  assert.ok(parseInput(updateExpenseInput, { endDate: null }).success);
});

test("recurrence interval must be a positive whole number", () => {
  for (const recurrenceInterval of [0, -1, 1.5, 1000]) {
    const result = parseInput(createExpenseInput, {
      ...validExpense,
      recurrenceType: "custom",
      recurrenceInterval,
    });
    assert.equal(result.success, false, `interval ${recurrenceInterval} should be rejected`);
  }
  // Without an interval a custom recurrence counts as monthly; the form has no interval input
  assert.ok(parseInput(createExpenseInput, { ...validExpense, recurrenceType: "custom" }).success);
});

test("transfers need two different accounts", () => {
  const transfer = {
    sourceAccountId: ACCOUNT,
    targetAccountId: ACCOUNT,
    amount: "100",
    recurrenceType: "monthly",
    startDate: "2026-01-01",
  };
  const same = parseInput(createTransferInput, transfer);
  assert.equal(same.success, false);
  assert.ok(!same.success && same.error.includes("unterschiedlich"));
  assert.ok(
    parseInput(createTransferInput, { ...transfer, targetAccountId: OTHER_ACCOUNT }).success
  );
});

test("text fields are trimmed, required and bounded", () => {
  assert.equal(parseInput(createExpenseInput, { ...validExpense, name: "   " }).success, false);
  assert.equal(
    parseInput(createExpenseInput, { ...validExpense, name: "x".repeat(101) }).success,
    false
  );
  const trimmed = parseInput(createCategoryInput, { name: "  Wohnen  ", color: "#3b82f6" });
  assert.ok(trimmed.success);
  assert.equal(trimmed.data.name, "Wohnen");
  assert.equal(parseInput(createCategoryInput, { name: "X", color: "red" }).success, false);
});

test("missing payload returns an error instead of throwing", () => {
  assert.equal(parseInput(createExpenseInput, undefined).success, false);
  assert.equal(parseInput(createExpenseInput, null).success, false);
});

test("ids are checked for format only, so the fixed demo ids are accepted", () => {
  const demo = parseInput(createExpenseInput, {
    ...validExpense,
    accountId: "a0000000-0000-0000-0000-000000000001",
  });
  assert.ok(demo.success);
  assert.equal(
    parseInput(createExpenseInput, { ...validExpense, accountId: "a0000000" }).success,
    false
  );
});

test("an update setting only one date is checked against the stored range", () => {
  const stored = { startDate: new Date("2026-03-01"), endDate: null };
  assert.equal(changesDateRange({}), false);
  assert.equal(changesDateRange({ endDate: null }), false);
  assert.equal(changesDateRange({ endDate: new Date("2026-04-01") }), true);
  assert.equal(
    checkUpdatedRange({ endDate: new Date("2026-02-01") }, stored),
    "Enddatum liegt vor dem Startdatum"
  );
  assert.equal(checkUpdatedRange({ endDate: new Date("2026-03-01") }, stored), null);
  assert.equal(
    checkUpdatedRange(
      { startDate: new Date("2026-06-01") },
      { startDate: new Date("2026-01-01"), endDate: new Date("2026-05-01") }
    ),
    "Enddatum liegt vor dem Startdatum"
  );
  // Removing the end date is always allowed
  assert.equal(
    checkUpdatedRange(
      { startDate: new Date("2026-06-01"), endDate: null },
      { startDate: new Date("2026-01-01"), endDate: new Date("2026-05-01") }
    ),
    null
  );
});
