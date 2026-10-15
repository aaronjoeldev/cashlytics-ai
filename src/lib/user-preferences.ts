import { cache } from "react";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import { currencies, defaultCurrency, type Currency } from "@/lib/currency";
import { defaultLocale, locales, type Locale } from "@/i18n/config";

const LOCALE_COOKIE = "locale";
const CURRENCY_COOKIE = "currency";

export type UserPreferences = { currency: Currency; locale: Locale };

const asCurrency = (value: string | undefined | null): Currency | undefined =>
  value && currencies.includes(value as Currency) ? (value as Currency) : undefined;

const asLocale = (value: string | undefined | null): Locale | undefined =>
  value && locales.includes(value as Locale) ? (value as Locale) : undefined;

/** Stored settings of a user, or null when they never saved any. */
async function loadStoredPreferences(userId: string): Promise<Partial<UserPreferences> | null> {
  const [row] = await db
    .select({ baseCurrency: userSettings.baseCurrency, locale: userSettings.locale })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  if (!row) return null;
  return { currency: asCurrency(row.baseCurrency), locale: asLocale(row.locale) };
}

/**
 * Display currency and locale for the current request. The signed-in user's stored settings win;
 * the cookies are only a fallback for signed-out pages and users without saved settings. Reading
 * the database here (instead of trusting the cookie) keeps the server from computing totals in a
 * stale currency right after login. Cached per request.
 */
export const getUserPreferences = cache(async (): Promise<UserPreferences> => {
  const cookieStore = await cookies();
  const fallback: UserPreferences = {
    currency: asCurrency(cookieStore.get(CURRENCY_COOKIE)?.value) ?? defaultCurrency,
    locale: asLocale(cookieStore.get(LOCALE_COOKIE)?.value) ?? defaultLocale,
  };

  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return fallback;
    const stored = await loadStoredPreferences(userId);
    return {
      currency: stored?.currency ?? fallback.currency,
      locale: stored?.locale ?? fallback.locale,
    };
  } catch (error) {
    logger.error("Failed to load user preferences", "getUserPreferences", error);
    return fallback;
  }
});

/** The currency totals are converted into for the current request. */
export async function getBaseCurrency(): Promise<Currency> {
  return (await getUserPreferences()).currency;
}
