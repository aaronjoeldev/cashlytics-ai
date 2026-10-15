import { createHash } from "node:crypto";
import { z } from "zod";

const MAX_CSV_UPLOAD_BYTES = 1 * 1024 * 1024;
const MAX_CSV_ROWS = 5000;
const CSV_MIME_TYPES = ["text/csv", "application/csv", "application/vnd.ms-excel"];
// Some browsers and systems send these for .csv files
const GENERIC_MIME_TYPES = ["", "text/plain", "application/octet-stream"];
const MAX_TEXT_LENGTH = 255;

const csvRowSchema = z.object({
  bookingDate: z.date(),
  amount: z
    .string()
    .min(1)
    .refine((value) => !Number.isNaN(Number.parseFloat(value)), "Amount must be numeric"),
  currency: z.string().trim().min(1).max(10),
  description: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
  counterparty: z.string().trim().max(255).nullable(),
  senderAccount: z.string().trim().max(255).nullable(),
  receiverAccount: z.string().trim().max(255).nullable(),
  balanceAfterBooking: z.string().trim().max(64).nullable(),
  reference: z.string().trim().max(255).nullable(),
});

export type CanonicalHeader =
  | "booking_date"
  | "amount"
  | "currency"
  | "description"
  | "counterparty"
  | "sender_account"
  | "receiver_account"
  | "balance_after_booking"
  | "reference";

export type HeaderMapping = Partial<Record<CanonicalHeader, string>>;

export type NormalizedCsvRow = {
  rowIndex: number;
  bookingDate: Date;
  amount: string;
  currency: string;
  description: string;
  counterparty: string | null;
  senderAccount: string | null;
  receiverAccount: string | null;
  balanceAfterBooking: string | null;
  reference: string | null;
};

export type ParseCsvSuccess = {
  success: true;
  delimiter: ";" | ",";
  rows: NormalizedCsvRow[];
};

export type ParseCsvFailure = {
  success: false;
  error: string;
};

export type ParseCsvResult = ParseCsvSuccess | ParseCsvFailure;

export type CsvImportStagingInput = {
  userId: string;
  accountId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  csvContent: string;
  headerMapping?: HeaderMapping;
};

export type CsvImportStagingSuccess = {
  success: true;
  data: {
    sessionId: string;
    stagedRows: number;
    totalRows: number;
    /** When the same file was already imported into this account */
    alreadyImportedAt: Date | null;
  };
};

export type CsvImportStagingFailure = {
  success: false;
  error: string;
};

export type CsvImportStagingResult = CsvImportStagingSuccess | CsvImportStagingFailure;

export type CsvStagingStore = {
  /** Currency of the account if it belongs to the user, otherwise null */
  getOwnedAccountCurrency(userId: string, accountId: string): Promise<string | null>;
  /** When a confirmed import of the same file into the account finished, or null */
  findConfirmedImportOfFile(
    userId: string,
    accountId: string,
    sourceFileHash: string
  ): Promise<Date | null>;
  createSessionWithRows(params: {
    userId: string;
    accountId: string;
    sourceFileName: string;
    sourceFileHash: string;
    rows: NormalizedCsvRow[];
  }): Promise<{ sessionId: string }>;
};

export type CsvImportStagingServiceDeps = {
  store: CsvStagingStore;
};

const canonicalHeaderAliases: Record<CanonicalHeader, string[]> = {
  booking_date: ["booking_date", "bookingdate", "buchungsdatum", "bogforingsdato", "date"],
  amount: ["amount", "betrag", "belob", "belobdkk"],
  currency: ["currency", "valuta", "waehrung", "wahrung"],
  description: ["description", "beskrivelse", "verwendungszweck", "text", "tekst", "beschreibung"],
  counterparty: ["counterparty", "navn", "name", "gegenpartei"],
  sender_account: ["sender_account", "senderaccount", "afsender", "absender"],
  receiver_account: ["receiver_account", "receiveraccount", "modtager", "empfanger"],
  balance_after_booking: ["balance_after_booking", "saldo", "kontostand"],
  reference: ["reference", "referenz", "belegnummer"],
};

function normalizeHeader(value: string): string {
  return (
    value
      .replace(/^\uFEFF/, "")
      // Letters that NFKD does not decompose ("Beløb", "Bogføringsdato")
      .replace(/[øØ]/g, "o")
      .replace(/[æÆ]/g, "ae")
      .replace(/ß/g, "ss")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
  );
}

function splitCsvLine(line: string, delimiter: ";" | ","): string[] {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (!insideQuotes && char === delimiter) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

/** Splits CSV content into records; line breaks inside quoted fields stay part of the field. */
function splitCsvRecords(content: string): string[] {
  const records: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (const char of content) {
    if (char === '"') {
      // An escaped quote ("") toggles twice, so the state stays correct
      insideQuotes = !insideQuotes;
    } else if (char === "\n" && !insideQuotes) {
      records.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  records.push(current);
  return records;
}

/**
 * Decodes an uploaded file. UTF-8 is tried first; files that are not valid UTF-8 are read as
 * Windows-1252, the encoding of most German and Danish bank exports.
 */
export function decodeCsvBytes(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

function truncateText(value: string): string {
  return value.length > MAX_TEXT_LENGTH ? value.slice(0, MAX_TEXT_LENGTH).trimEnd() : value;
}

function detectDelimiter(headerLine: string): ";" | "," {
  const semicolonCount = splitCsvLine(headerLine, ";").length;
  const commaCount = splitCsvLine(headerLine, ",").length;
  return semicolonCount >= commaCount ? ";" : ",";
}

function buildHeaderIndex(headers: string[]): Record<string, number> {
  const index: Record<string, number> = {};
  headers.forEach((header, position) => {
    const normalized = normalizeHeader(header);
    if (!(normalized in index)) {
      index[normalized] = position;
    }
  });
  return index;
}

function resolveHeaderMapping(
  headers: string[],
  manualMapping?: HeaderMapping
): Map<CanonicalHeader, number> {
  const indexByNormalizedHeader = buildHeaderIndex(headers);
  const mapping = new Map<CanonicalHeader, number>();

  for (const [canonicalHeader, aliases] of Object.entries(canonicalHeaderAliases) as [
    CanonicalHeader,
    string[],
  ][]) {
    const manualHeader = manualMapping?.[canonicalHeader];
    if (manualHeader) {
      const manualIndex = indexByNormalizedHeader[normalizeHeader(manualHeader)];
      if (manualIndex !== undefined) {
        mapping.set(canonicalHeader, manualIndex);
        continue;
      }
    }

    const matchedAlias = aliases.find((alias) => indexByNormalizedHeader[alias] !== undefined);
    if (matchedAlias) {
      mapping.set(canonicalHeader, indexByNormalizedHeader[matchedAlias]);
    }
  }

  return mapping;
}

/**
 * Parses a bank amount into a signed decimal string with two fraction digits.
 *
 * Handles decimal comma and decimal point, thousands separators (".", ",", "'" and spaces),
 * currency symbols and codes, and the ways banks mark debits: leading or trailing minus,
 * parentheses, and a trailing "S" (Soll) versus "H" (Haben).
 *
 * A single separator followed by exactly three digits ("1.234", "1,234") is read as a thousands
 * separator, because money amounts do not have three fraction digits.
 */
export function normalizeAmount(rawValue: string): string {
  let value = rawValue.replace(/[\s\u00a0\u202f']/g, "");
  if (value.length === 0) {
    throw new Error("Amount is empty");
  }

  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }
  // Currency symbols and ISO codes, before or after the number
  value = value.replace(/[€$£¥]/g, "").replace(/^[A-Z]{3}(?=[-+\d])|(?<=\d)[A-Z]{3}$/g, "");
  if (/\d[SH]$/.test(value)) {
    negative = negative || value.endsWith("S");
    value = value.slice(0, -1);
  }
  if (/^[-+]/.test(value)) {
    negative = negative || value.startsWith("-");
    value = value.slice(1);
  } else if (/[-+]$/.test(value)) {
    negative = negative || value.endsWith("-");
    value = value.slice(0, -1);
  }

  if (!/^\d[\d.,]*$/.test(value)) {
    throw new Error(`Amount is invalid: ${rawValue}`);
  }

  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  let normalized: string;

  if (lastComma !== -1 && lastDot !== -1) {
    // Both present: the later one is the decimal separator
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    normalized = value.split(thousandsSeparator).join("").replace(decimalSeparator, ".");
  } else if (lastComma !== -1 || lastDot !== -1) {
    const separator = lastComma !== -1 ? "," : ".";
    const groups = value.split(separator);
    const isThousandsGrouping =
      groups[0].length <= 3 &&
      !groups[0].startsWith("0") &&
      groups.slice(1).every((group) => group.length === 3);
    if (isThousandsGrouping) {
      normalized = groups.join("");
    } else if (groups.length === 2) {
      normalized = groups.join(".");
    } else {
      throw new Error(`Amount is invalid: ${rawValue}`);
    }
  } else {
    normalized = value;
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Amount is invalid: ${rawValue}`);
  }

  const amount = Number.parseFloat(normalized);
  return (negative ? -amount : amount).toFixed(2);
}

function normalizeDate(rawValue: string): Date {
  const value = rawValue.trim();
  if (!value) {
    throw new Error("Date is empty");
  }

  const normalizeYear = (rawYear: string): number => {
    if (rawYear.length === 4) {
      return Number.parseInt(rawYear, 10);
    }

    const twoDigitYear = Number.parseInt(rawYear, 10);
    return twoDigitYear >= 70 ? 1900 + twoDigitYear : 2000 + twoDigitYear;
  };

  const createUtcDate = (year: number, month: number, day: number): Date => {
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new Error(`Date format is invalid: ${rawValue}`);
    }

    return date;
  };

  const parts = value.split(/[\/.\-]/);
  if (parts.length !== 3 || parts.some((part) => !/^\d+$/.test(part))) {
    throw new Error(`Date format is invalid: ${rawValue}`);
  }

  if (parts[0]?.length === 4) {
    const year = normalizeYear(parts[0]);
    const month = Number.parseInt(parts[1] ?? "", 10);
    const day = Number.parseInt(parts[2] ?? "", 10);
    return createUtcDate(year, month, day);
  }

  const day = Number.parseInt(parts[0] ?? "", 10);
  const month = Number.parseInt(parts[1] ?? "", 10);
  const year = normalizeYear(parts[2] ?? "");
  return createUtcDate(year, month, day);
}

function getMappedValue(
  row: string[],
  mapping: Map<CanonicalHeader, number>,
  key: CanonicalHeader
): string {
  const index = mapping.get(key);
  if (index === undefined) {
    return "";
  }
  return row[index] ?? "";
}

/**
 * @param defaultCurrency used for rows when the file has no currency column (the account currency)
 */
export function parseAndNormalizeCsv(
  csvContent: string,
  headerMapping?: HeaderMapping,
  defaultCurrency?: string
): ParseCsvResult {
  const normalizedContent = csvContent
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (!normalizedContent) {
    return { success: false, error: "CSV file is empty" };
  }

  const lines = splitCsvRecords(normalizedContent);
  if (lines.length < 2) {
    return { success: false, error: "CSV file must include header and at least one row" };
  }

  if (lines.length - 1 > MAX_CSV_ROWS) {
    return { success: false, error: `CSV exceeds row limit (${MAX_CSV_ROWS})` };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter);
  const mapping = resolveHeaderMapping(headers, headerMapping);

  const requiredHeaders: CanonicalHeader[] = defaultCurrency
    ? ["booking_date", "amount"]
    : ["booking_date", "amount", "currency"];
  const missingHeaders = requiredHeaders.filter((header) => !mapping.has(header));
  if (missingHeaders.length > 0) {
    return {
      success: false,
      error: `CSV header mapping missing required fields: ${missingHeaders.join(", ")}`,
    };
  }

  const rows: NormalizedCsvRow[] = [];
  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const parsedLine = splitCsvLine(lines[lineIndex], delimiter);
    const isEmptyRow = parsedLine.every((cell) => cell.trim().length === 0);
    if (isEmptyRow) {
      continue;
    }

    try {
      const bookingDate = normalizeDate(getMappedValue(parsedLine, mapping, "booking_date"));
      const amount = normalizeAmount(getMappedValue(parsedLine, mapping, "amount"));
      const currency =
        getMappedValue(parsedLine, mapping, "currency").trim().toUpperCase() ||
        defaultCurrency ||
        "";
      const description = truncateText(
        getMappedValue(parsedLine, mapping, "description").trim() ||
          getMappedValue(parsedLine, mapping, "counterparty").trim() ||
          `Imported row ${lineIndex}`
      );
      const counterparty =
        truncateText(getMappedValue(parsedLine, mapping, "counterparty").trim()) || null;
      const senderAccount =
        truncateText(getMappedValue(parsedLine, mapping, "sender_account").trim()) || null;
      const receiverAccount =
        truncateText(getMappedValue(parsedLine, mapping, "receiver_account").trim()) || null;
      const balanceAfterBookingRaw =
        getMappedValue(parsedLine, mapping, "balance_after_booking").trim() || null;
      const balanceAfterBooking = balanceAfterBookingRaw
        ? normalizeAmount(balanceAfterBookingRaw)
        : null;
      const reference =
        truncateText(getMappedValue(parsedLine, mapping, "reference").trim()) || null;

      const validatedRow = csvRowSchema.safeParse({
        bookingDate,
        amount,
        currency,
        description,
        counterparty,
        senderAccount,
        receiverAccount,
        balanceAfterBooking,
        reference,
      });

      if (!validatedRow.success) {
        return {
          success: false,
          error: `Row ${lineIndex} failed validation: ${validatedRow.error.issues[0]?.message ?? "Invalid row"}`,
        };
      }

      rows.push({
        rowIndex: lineIndex,
        ...validatedRow.data,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown CSV parsing error";
      return {
        success: false,
        error: `Row ${lineIndex} parsing failed: ${message}`,
      };
    }
  }

  if (rows.length === 0) {
    return { success: false, error: "CSV does not contain parsable rows" };
  }

  return { success: true, delimiter, rows };
}

function isAllowedCsvFile(mimeType: string, fileName: string): boolean {
  if (CSV_MIME_TYPES.includes(mimeType)) {
    return true;
  }
  return GENERIC_MIME_TYPES.includes(mimeType) && /\.(csv|txt)$/i.test(fileName);
}

export function createCsvImportStagingService(deps: CsvImportStagingServiceDeps) {
  return {
    async stageCsvUpload(input: CsvImportStagingInput): Promise<CsvImportStagingResult> {
      if (input.fileSize <= 0) {
        return { success: false, error: "CSV file is empty" };
      }

      if (input.fileSize > MAX_CSV_UPLOAD_BYTES) {
        return {
          success: false,
          error: `CSV file too large. Maximum size is ${Math.floor(MAX_CSV_UPLOAD_BYTES / 1024 / 1024)}MB`,
        };
      }

      if (!isAllowedCsvFile(input.mimeType, input.fileName)) {
        return { success: false, error: "Unsupported file type. Please upload a CSV file" };
      }

      const accountCurrency = await deps.store.getOwnedAccountCurrency(
        input.userId,
        input.accountId
      );
      if (!accountCurrency) {
        return { success: false, error: "Account not found or not owned by user" };
      }

      const parseResult = parseAndNormalizeCsv(
        input.csvContent,
        input.headerMapping,
        accountCurrency
      );
      if (!parseResult.success) {
        return { success: false, error: parseResult.error };
      }

      const sourceFileHash = createHash("sha256").update(input.csvContent).digest("hex");
      const alreadyImportedAt = await deps.store.findConfirmedImportOfFile(
        input.userId,
        input.accountId,
        sourceFileHash
      );
      const { sessionId } = await deps.store.createSessionWithRows({
        userId: input.userId,
        accountId: input.accountId,
        sourceFileName: input.fileName,
        sourceFileHash,
        rows: parseResult.rows,
      });

      return {
        success: true,
        data: {
          sessionId,
          stagedRows: parseResult.rows.length,
          totalRows: parseResult.rows.length,
          alreadyImportedAt,
        },
      };
    },
  };
}
