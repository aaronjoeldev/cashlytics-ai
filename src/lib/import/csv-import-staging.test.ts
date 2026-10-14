import assert from "node:assert/strict";
import test from "node:test";
import {
  createCsvImportStagingService,
  parseAndNormalizeCsv,
  normalizeAmount,
} from "./csv-import-staging";

test("parseAndNormalizeCsv returns failure when required header mapping is missing", () => {
  const csv = ["Date;Amount;Description", "2026/03/02;10.00;Salary"].join("\n");

  const result = parseAndNormalizeCsv(csv);

  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(result.error, /missing required fields/i);
  }
});

test("stageCsvUpload stages normalized rows for owned account", async () => {
  const stagedCalls: Array<{ userId: string; accountId: string; rowCount: number }> = [];
  const service = createCsvImportStagingService({
    store: {
      async isAccountOwnedByUser() {
        return true;
      },
      async createSessionWithRows(params) {
        stagedCalls.push({
          userId: params.userId,
          accountId: params.accountId,
          rowCount: params.rows.length,
        });
        return { sessionId: "session-123" };
      },
    },
  });

  const csv = [
    "\uFEFFBogforingsdato;Belob;Beskrivelse;Valuta",
    "2026/03/04;-1789,27;Boligkredit;DKK",
    "2026/03/02;14000,00;From Daily Expense;DKK",
  ].join("\n");

  const result = await service.stageCsvUpload({
    userId: "user-1",
    accountId: "account-1",
    fileName: "sample.csv",
    fileSize: Buffer.byteLength(csv),
    mimeType: "text/csv",
    csvContent: csv,
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.sessionId, "session-123");
    assert.equal(result.data.stagedRows, 2);
    assert.equal(result.data.totalRows, 2);
  }

  assert.equal(stagedCalls.length, 1);
  assert.equal(stagedCalls[0]?.userId, "user-1");
  assert.equal(stagedCalls[0]?.accountId, "account-1");
  assert.equal(stagedCalls[0]?.rowCount, 2);
});

test("parseAndNormalizeCsv supports two-digit day-month-year dates", () => {
  const csv = ["booking_date;amount;currency;description", "02.03.26;120,50;EUR;Test Booking"].join(
    "\n"
  );

  const result = parseAndNormalizeCsv(csv);

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0]?.bookingDate.toISOString().slice(0, 10), "2026-03-02");
    assert.equal(result.rows[0]?.amount, "120.50");
  }
});

test("normalizeAmount parses common bank amount formats", () => {
  const cases: Array<[string, string]> = [
    ["12,50", "12.50"],
    ["12.50", "12.50"],
    ["-3,50", "-3.50"],
    ["1.234,56", "1234.56"],
    ["1,234.56", "1234.56"],
    ["1.234.567,89", "1234567.89"],
    ["1 234,56", "1234.56"],
    ["1'234.56", "1234.56"],
    ["1234", "1234.00"],
    ["0,5", "0.50"],
    ["0,500", "0.50"],
    ["+100,00", "100.00"],
    ["-0,00", "0.00"],
  ];
  for (const [input, expected] of cases) {
    assert.equal(Number(normalizeAmount(input)), Number(expected), input);
  }
});

test("normalizeAmount keeps debits negative", () => {
  assert.equal(normalizeAmount("50,00-"), "-50.00");
  assert.equal(normalizeAmount("(50,00)"), "-50.00");
  assert.equal(normalizeAmount("12,50 S"), "-12.50");
  assert.equal(normalizeAmount("12,50 H"), "12.50");
  assert.equal(normalizeAmount("-1.234,56 €"), "-1234.56");
  assert.equal(normalizeAmount("EUR -45,00"), "-45.00");
});

test("normalizeAmount reads a lone separator before three digits as thousands", () => {
  assert.equal(normalizeAmount("1.234"), "1234.00");
  assert.equal(normalizeAmount("1,234"), "1234.00");
  assert.equal(normalizeAmount("1.234.567"), "1234567.00");
  assert.equal(normalizeAmount("1,234,567"), "1234567.00");
});

test("normalizeAmount rejects values that are not amounts", () => {
  for (const input of ["", "abc", "12,34,5", "1.2.3", "12-34", "--5"]) {
    assert.throws(() => normalizeAmount(input), input);
  }
});
