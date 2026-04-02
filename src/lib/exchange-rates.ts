import { db } from "@/lib/db";
import { exchangeRates as exchangeRatesTable } from "@/lib/db/schema";
import { currencies, exchangeRates as fallbackRates, type Currency } from "@/lib/currency";
import { logger } from "@/lib/logger";
import { eq } from "drizzle-orm";

const FRANKFURTER_URL =
  "https://api.frankfurter.app/latest?base=EUR&symbols=USD,GBP,CHF,DKK";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface FrankfurterResponse {
  base: string;
  rates: Record<string, number>;
}

/**
 * Fetches fresh exchange rates from the Frankfurter API.
 * Returns null if the API is unreachable or returns invalid data.
 */
async function fetchRatesFromApi(): Promise<Record<string, number> | null> {
  try {
    const response = await fetch(FRANKFURTER_URL, {
      next: { revalidate: 0 }, // disable Next.js caching — we manage TTL ourselves
    });

    if (!response.ok) {
      logger.warn(
        `Frankfurter API returned status ${response.status}`,
        "fetchRatesFromApi"
      );
      return null;
    }

    const data: FrankfurterResponse = await response.json();

    if (!data?.rates || typeof data.rates !== "object") {
      logger.warn("Frankfurter API returned unexpected format", "fetchRatesFromApi");
      return null;
    }

    return data.rates;
  } catch (error) {
    logger.error("Failed to fetch from Frankfurter API", "fetchRatesFromApi", error);
    return null;
  }
}

/**
 * Loads all rates from the DB cache (base = EUR).
 * Returns null when the table is empty.
 */
async function loadRatesFromDb(): Promise<Record<Currency, number> | null> {
  try {
    const rows = await db
      .select()
      .from(exchangeRatesTable)
      .where(eq(exchangeRatesTable.baseCurrency, "EUR"));

    if (rows.length === 0) return null;

    const rates: Partial<Record<Currency, number>> = { EUR: 1 };
    for (const row of rows) {
      const target = row.targetCurrency as Currency;
      if (currencies.includes(target)) {
        rates[target] = parseFloat(row.rate);
      }
    }

    // Only return when all supported currencies are present
    const allPresent = currencies.every((c) => c === "EUR" || rates[c] !== undefined);
    return allPresent ? (rates as Record<Currency, number>) : null;
  } catch (error) {
    logger.error("Failed to load rates from DB", "loadRatesFromDb", error);
    return null;
  }
}

/**
 * Checks whether the cached DB rates are older than CACHE_TTL_MS.
 * Returns true when a refresh is needed (or when no row is found).
 */
async function isCacheStale(): Promise<boolean> {
  try {
    const rows = await db
      .select({ fetchedAt: exchangeRatesTable.fetchedAt })
      .from(exchangeRatesTable)
      .where(eq(exchangeRatesTable.baseCurrency, "EUR"))
      .limit(1);

    if (rows.length === 0) return true;

    const age = Date.now() - new Date(rows[0].fetchedAt).getTime();
    return age > CACHE_TTL_MS;
  } catch (error) {
    logger.error("Failed to check cache staleness", "isCacheStale", error);
    return true; // assume stale on error → triggers a fresh fetch
  }
}

/**
 * Persists fresh rates to the DB using an UPSERT strategy.
 * baseCurrency is always EUR; EUR → EUR (rate 1.0) is not stored.
 */
async function saveRatesToDb(rates: Record<string, number>): Promise<void> {
  try {
    const now = new Date();
    const upserts = Object.entries(rates).map(([target, rate]) =>
      db
        .insert(exchangeRatesTable)
        .values({
          baseCurrency: "EUR",
          targetCurrency: target,
          rate: rate.toString(),
          fetchedAt: now,
        })
        .onConflictDoUpdate({
          target: [exchangeRatesTable.baseCurrency, exchangeRatesTable.targetCurrency],
          set: {
            rate: rate.toString(),
            fetchedAt: now,
          },
        })
    );

    await Promise.all(upserts);
  } catch (error) {
    logger.error("Failed to save rates to DB", "saveRatesToDb", error);
  }
}

/**
 * Returns all current rates (base = EUR).
 * Fetch priority: fresh API → stale DB cache → hardcoded fallback.
 */
export async function getAllRates(): Promise<Record<Currency, number>> {
  try {
    const stale = await isCacheStale();

    if (!stale) {
      const dbRates = await loadRatesFromDb();
      if (dbRates) return dbRates;
    }

    // Cache is stale (or empty) → try to fetch fresh rates
    const apiRates = await fetchRatesFromApi();

    if (apiRates) {
      await saveRatesToDb(apiRates);
      const result: Record<Currency, number> = { EUR: 1 } as Record<Currency, number>;
      for (const c of currencies) {
        if (c === "EUR") continue;
        result[c] = apiRates[c] ?? fallbackRates[c];
      }
      return result;
    }

    // API unreachable → try stale DB data
    logger.warn(
      "Frankfurter API unavailable — falling back to DB cache",
      "getAllRates"
    );
    const staleDbRates = await loadRatesFromDb();
    if (staleDbRates) return staleDbRates;

    // No DB data at all → hardcoded fallback
    logger.warn("DB cache empty — using hardcoded fallback rates", "getAllRates");
    return { ...fallbackRates };
  } catch (error) {
    logger.error("getAllRates failed unexpectedly", "getAllRates", error);
    return { ...fallbackRates };
  }
}

/**
 * Returns the rate to convert `from` → `to` (via EUR as base).
 */
export async function getExchangeRate(from: Currency, to: Currency): Promise<number> {
  if (from === to) return 1;

  try {
    const rates = await getAllRates();
    const fromRate = rates[from];
    const toRate = rates[to];

    if (!fromRate || !toRate) {
      logger.warn(
        `Missing rate for ${from} or ${to} — using fallback`,
        "getExchangeRate"
      );
      return fallbackRates[to] / fallbackRates[from];
    }

    // rates are expressed as EUR → currency, so:
    // from → EUR = 1 / fromRate, EUR → to = toRate
    return toRate / fromRate;
  } catch (error) {
    logger.error("getExchangeRate failed", "getExchangeRate", error);
    return fallbackRates[to] / fallbackRates[from];
  }
}

/**
 * Converts `amount` from one currency to another using live rates.
 */
export async function convertAmount(
  amount: number,
  from: Currency,
  to: Currency
): Promise<number> {
  const rate = await getExchangeRate(from, to);
  return amount * rate;
}

/**
 * Manually refreshes the DB cache from the Frankfurter API.
 * Intended for use by a cronjob.
 */
export async function refreshExchangeRates(): Promise<void> {
  const apiRates = await fetchRatesFromApi();

  if (!apiRates) {
    logger.warn(
      "refreshExchangeRates: API unavailable, cache not updated",
      "refreshExchangeRates"
    );
    return;
  }

  await saveRatesToDb(apiRates);
  logger.info("Exchange rates refreshed successfully", "refreshExchangeRates");
}
