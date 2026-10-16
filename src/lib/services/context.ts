import { defaultCurrency, type Currency, type ExchangeRateTable } from "@/lib/currency";
import { getAllRates } from "@/lib/exchange-rates";
import { loadStoredPreferences } from "@/lib/user-preferences";

/**
 * Everything the finance services need to compute totals for one user. Server actions build it
 * from the session; the REST API builds it from an API token with `loadFinanceContext`.
 */
export type FinanceContext = {
  userId: string;
  baseCurrency: Currency;
  rates: ExchangeRateTable;
};

/** Context for a user without a session: stored base currency (or the default) and live rates. */
export async function loadFinanceContext(userId: string): Promise<FinanceContext> {
  const [stored, rates] = await Promise.all([loadStoredPreferences(userId), getAllRates()]);
  return { userId, baseCurrency: stored?.currency ?? defaultCurrency, rates };
}
