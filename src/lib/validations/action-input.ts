import { z } from "zod";
import { currencies } from "@/lib/currency";

/**
 * Server-side schemas for the create and update actions.
 *
 * Server actions are public endpoints: the zod schemas in the forms do not protect them, and the
 * AI tools call the same actions with model-generated values. Every write therefore parses its
 * input here. Unknown keys are dropped, so a payload cannot set `userId`, `id` or `createdAt`.
 */

// decimal(12, 2) holds at most 10 integer digits
const MAX_AMOUNT = 9_999_999_999.99;
// numeric(10, 6) holds at most 4 integer digits
const MAX_EXCHANGE_RATE = 9_999.999999;
// custom recurrence interval in months
const MAX_RECURRENCE_INTERVAL = 120;

const toNumber = (value: string | number) =>
  typeof value === "number" ? value : value.trim() === "" ? Number.NaN : Number(value);

/** Accepts "12.5", " 12.50 " or 12.5 and stores "12.50". */
function decimal(options: { min: number; max: number; scale: number; label: string }) {
  return z
    .union([z.string(), z.number()])
    .transform(toNumber)
    .refine((n) => Number.isFinite(n), `${options.label} ist keine gültige Zahl`)
    .refine(
      (n) => n >= options.min && n <= options.max,
      `${options.label} liegt außerhalb des erlaubten Bereichs`
    )
    .transform((n) => n.toFixed(options.scale));
}

const positiveAmount = decimal({ min: 0.01, max: MAX_AMOUNT, scale: 2, label: "Betrag" });
const signedAmount = decimal({ min: -MAX_AMOUNT, max: MAX_AMOUNT, scale: 2, label: "Betrag" });
const exchangeRate = decimal({ min: 0.000001, max: MAX_EXCHANGE_RATE, scale: 6, label: "Kurs" });

const date = z.coerce
  .date({ message: "Ungültiges Datum" })
  .refine((d) => d.getUTCFullYear() >= 1900 && d.getUTCFullYear() <= 2200, "Ungültiges Datum");

const currency = z.enum(currencies, { message: "Ungültige Währung" });
// z.guid() checks the format only; z.uuid() also rejects the fixed ids of the demo seed
const id = z.guid({ message: "Ungültige ID" });
const text = (max: number, label: string) =>
  z.string().trim().min(1, `${label} ist erforderlich`).max(max, `${label} ist zu lang`);
const info = z.string().trim().max(1000, "Notiz ist zu lang").nullable().optional();

export const expenseRecurrenceTypes = [
  "once",
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "semiannual",
  "yearly",
  "custom",
] as const;
export const incomeRecurrenceTypes = ["once", "monthly", "yearly"] as const;
export const transferRecurrenceTypes = ["once", "monthly", "quarterly", "yearly"] as const;
export const accountTypes = ["checking", "savings", "etf"] as const;

type DateRange = { startDate?: Date; endDate?: Date | null };
const endNotBeforeStart = (data: DateRange) =>
  !data.startDate || !data.endDate || data.endDate >= data.startDate;
const END_BEFORE_START = "Enddatum liegt vor dem Startdatum";
// zod normalises the params object passed to refine() in place, so do not read from it
const endDateIssue = { message: END_BEFORE_START, path: ["endDate"] };

/** True when an update changes the date range, so it has to be checked against the stored row. */
export function changesDateRange(updates: DateRange): boolean {
  return updates.startDate !== undefined || updates.endDate != null;
}

/**
 * Checks an update against the stored range. The schema can only compare dates sent together;
 * an update that sets only the end date must not end before the stored start, and vice versa.
 */
export function checkUpdatedRange(
  updates: DateRange,
  stored: { startDate: Date; endDate: Date | null }
): string | null {
  const merged = {
    startDate: updates.startDate ?? stored.startDate,
    endDate: updates.endDate === undefined ? stored.endDate : updates.endDate,
  };
  return endNotBeforeStart(merged) ? null : END_BEFORE_START;
}

// --- Accounts ---------------------------------------------------------------

const accountFields = z.object({
  name: text(50, "Name"),
  type: z.enum(accountTypes, { message: "Ungültiger Kontotyp" }),
  balance: signedAmount,
  currency,
});
export const createAccountInput = accountFields.extend({
  balance: signedAmount.default("0.00"),
});
export const updateAccountInput = accountFields.partial();

// --- Categories ---------------------------------------------------------------

const categoryFields = z.object({
  name: text(50, "Name"),
  icon: z.string().trim().max(16, "Icon ist zu lang").nullable().optional(),
  color: z
    .union([z.literal(""), z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Ungültige Farbe")])
    .nullable()
    .optional(),
});
export const createCategoryInput = categoryFields;
export const updateCategoryInput = categoryFields.partial();

// --- Periodic expenses --------------------------------------------------------

const expenseFields = z.object({
  accountId: id,
  categoryId: id.nullable().optional(),
  name: text(100, "Name"),
  amount: positiveAmount,
  recurrenceType: z.enum(expenseRecurrenceTypes, { message: "Ungültiger Wiederholungstyp" }),
  recurrenceInterval: z
    .number()
    .int()
    .min(1, "Intervall muss mindestens 1 sein")
    .max(MAX_RECURRENCE_INTERVAL, "Intervall ist zu groß")
    .nullable()
    .optional(),
  startDate: date,
  endDate: date.nullable().optional(),
  isSubscription: z.boolean().optional(),
  currency: currency.optional(),
  originalAmount: positiveAmount.nullable().optional(),
  exchangeRate: exchangeRate.nullable().optional(),
  info,
});
// A custom recurrence without interval counts as monthly (see src/lib/recurrence.ts), so the
// interval stays optional for older entries and the assistant.
export const createExpenseInput = expenseFields.refine(endNotBeforeStart, endDateIssue);
export const updateExpenseInput = expenseFields.partial().refine(endNotBeforeStart, endDateIssue);

// --- Daily expenses -----------------------------------------------------------

const dailyExpenseFields = z.object({
  accountId: id,
  categoryId: id.nullable().optional(),
  description: text(200, "Beschreibung"),
  amount: positiveAmount,
  date,
  currency: currency.optional(),
  originalAmount: positiveAmount.nullable().optional(),
  exchangeRate: exchangeRate.nullable().optional(),
  info,
});
export const createDailyExpenseInput = dailyExpenseFields;
export const updateDailyExpenseInput = dailyExpenseFields.partial();

// --- Incomes ------------------------------------------------------------------

const incomeFields = z.object({
  accountId: id,
  source: text(100, "Quelle"),
  amount: positiveAmount,
  recurrenceType: z.enum(incomeRecurrenceTypes, { message: "Ungültiger Wiederholungstyp" }),
  startDate: date,
  endDate: date.nullable().optional(),
  currency: currency.optional(),
  originalAmount: positiveAmount.nullable().optional(),
  exchangeRate: exchangeRate.nullable().optional(),
  info,
});
export const createIncomeInput = incomeFields.refine(endNotBeforeStart, endDateIssue);
export const updateIncomeInput = incomeFields.partial().refine(endNotBeforeStart, endDateIssue);

// --- Transfers ----------------------------------------------------------------

const transferFields = z.object({
  sourceAccountId: id,
  targetAccountId: id,
  amount: positiveAmount,
  description: z.string().trim().max(200, "Beschreibung ist zu lang").nullable().optional(),
  recurrenceType: z.enum(transferRecurrenceTypes, { message: "Ungültiger Wiederholungstyp" }),
  startDate: date,
  endDate: date.nullable().optional(),
  sourceCurrency: currency.optional(),
  targetCurrency: currency.optional(),
  targetAmount: positiveAmount.nullable().optional(),
  exchangeRate: exchangeRate.nullable().optional(),
});
export const createTransferInput = transferFields
  .refine(endNotBeforeStart, endDateIssue)
  .refine((data) => data.sourceAccountId !== data.targetAccountId, {
    message: "Quell- und Zielkonto müssen unterschiedlich sein",
    path: ["targetAccountId"],
  });
export const updateTransferInput = transferFields.partial().refine(endNotBeforeStart, endDateIssue);

// --- Helper -------------------------------------------------------------------

export type ParsedInput<T> = { success: true; data: T } | { success: false; error: string };

/** Parses action input and returns the first problem as a user-facing message. */
export function parseInput<S extends z.ZodType>(
  schema: S,
  data: unknown
): ParsedInput<z.output<S>> {
  const result = schema.safeParse(data ?? {});
  if (result.success) return { success: true, data: result.data };
  const issue = result.error.issues[0];
  return { success: false, error: issue?.message ?? "Ungültige Eingabe" };
}
