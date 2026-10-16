import { z } from "zod";

/** Longest range /api/v1/payments returns in one request. */
export const MAX_PAYMENT_RANGE_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

const intParam = (min: number, max: number, fallback: number) =>
  z.coerce.number().int().min(min).max(max).default(fallback);

/** A calendar day "YYYY-MM-DD" as a UTC-midnight date, the way entries are stored. */
const calendarDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
  .transform((value, ctx) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      ctx.addIssue({ code: "custom", message: "not a calendar day" });
      return z.NEVER;
    }
    return date;
  });

export const summaryQuery = z.object({
  upcomingDays: intParam(1, 90, 7),
  forecastMonths: intParam(1, 24, 3),
});

export const accountsQuery = z.object({
  forecastMonths: intParam(1, 24, 3),
});

export const paymentsQuery = z
  .object({ start: calendarDay, end: calendarDay })
  .superRefine((q, ctx) => {
    // zod still runs object checks when a field failed; there is nothing to compare then
    if (!(q.start instanceof Date) || !(q.end instanceof Date)) return;
    if (q.end < q.start) {
      ctx.addIssue({ code: "custom", message: "end is before start", path: ["end"] });
    } else if ((q.end.getTime() - q.start.getTime()) / DAY_MS >= MAX_PAYMENT_RANGE_DAYS) {
      ctx.addIssue({
        code: "custom",
        message: `range is longer than ${MAX_PAYMENT_RANGE_DAYS} days`,
        path: ["end"],
      });
    }
  });

/** Query parameters as a plain object; repeated keys keep the last value. */
export function searchParamsToObject(params: URLSearchParams): Record<string, string> {
  return Object.fromEntries(params.entries());
}
