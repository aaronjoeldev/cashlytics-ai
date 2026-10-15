import assert from "node:assert/strict";
import test from "node:test";
import {
  createCsvImportStagingService,
  decodeCsvBytes,
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
      async getOwnedAccountCurrency() {
        return "DKK";
      },
      async findConfirmedImportOfFile() {
        return null;
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

test("decodeCsvBytes reads Windows-1252 bank exports", () => {
  // A header with "Währung" and a row, encoded as Windows-1252 (ä = 0xE4)
  const text = "Buchungsdatum;Betrag;Währung;Verwendungszweck\n01.03.2026;-12,50;EUR;Bäckerei";
  const bytes = Uint8Array.from(text, (char) => char.charCodeAt(0));

  const decoded = decodeCsvBytes(bytes);
  assert.equal(decoded, text);
  const result = parseAndNormalizeCsv(decoded);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.rows[0]?.description, "Bäckerei");
    assert.equal(result.rows[0]?.currency, "EUR");
  }

  assert.equal(decodeCsvBytes(new TextEncoder().encode("Währung")), "Währung");
});

test("parseAndNormalizeCsv keeps line breaks inside quoted fields", () => {
  const csv = [
    "booking_date;amount;currency;description",
    '01.03.2026;-5,00;EUR;"Kaffee',
    'und Kuchen"',
    "02.03.2026;-3,00;EUR;Brot",
  ].join("\r\n");

  const result = parseAndNormalizeCsv(csv);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0]?.description, "Kaffee\nund Kuchen");
    assert.equal(result.rows[1]?.description, "Brot");
  }
});

test("parseAndNormalizeCsv maps Danish headers with ø and uses the default currency", () => {
  const csv = ["Bogføringsdato;Beløb;Tekst", "2026/03/04;-1789,27;Boligkredit"].join("\n");

  assert.equal(parseAndNormalizeCsv(csv).success, false);
  const result = parseAndNormalizeCsv(csv, undefined, "DKK");
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.rows[0]?.amount, "-1789.27");
    assert.equal(result.rows[0]?.currency, "DKK");
    assert.equal(result.rows[0]?.description, "Boligkredit");
  }
});

test("parseAndNormalizeCsv shortens long descriptions instead of failing", () => {
  const csv = [
    "booking_date;amount;currency;description",
    `01.03.2026;-5,00;EUR;${"x".repeat(400)}`,
  ].join("\n");

  const result = parseAndNormalizeCsv(csv);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.rows[0]?.description.length, 255);
  }
});

test("stageCsvUpload accepts .csv files sent as text/plain and reports an earlier import", async () => {
  const importedAt = new Date("2026-02-01T10:00:00.000Z");
  const service = createCsvImportStagingService({
    store: {
      async getOwnedAccountCurrency() {
        return "EUR";
      },
      async findConfirmedImportOfFile() {
        return importedAt;
      },
      async createSessionWithRows() {
        return { sessionId: "session-1" };
      },
    },
  });
  const csv = ["Buchungsdatum;Betrag", "01.03.2026;-5,00"].join("\n");
  const input = {
    userId: "user-1",
    accountId: "account-1",
    fileSize: csv.length,
    csvContent: csv,
  };

  const plain = await service.stageCsvUpload({
    ...input,
    fileName: "export.csv",
    mimeType: "text/plain",
  });
  assert.equal(plain.success, true);
  if (plain.success) {
    assert.equal(plain.data.alreadyImportedAt, importedAt);
  }
  const empty = await service.stageCsvUpload({ ...input, fileName: "export.CSV", mimeType: "" });
  assert.equal(empty.success, true);
  const image = await service.stageCsvUpload({ ...input, fileName: "photo.png", mimeType: "" });
  assert.equal(image.success, false);
});
