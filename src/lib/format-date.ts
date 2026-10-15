import type { Locale } from "@/i18n/config";

/** BCP 47 tag used for number and date formatting of an app locale. */
export function intlLocaleOf(locale: Locale | string): string {
  return locale === "en" ? "en-US" : "de-DE";
}

/**
 * Formats a calendar day (stored as UTC midnight) in the given app locale. The fixed locale and
 * time zone give the same text on the server and in the browser, so hydration does not mismatch
 * and the day never shifts with the viewer's time zone.
 */
export function formatCalendarDate(
  value: Date | string,
  locale: Locale | string,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return new Intl.DateTimeFormat(intlLocaleOf(locale), { ...options, timeZone: "UTC" }).format(
    date
  );
}
