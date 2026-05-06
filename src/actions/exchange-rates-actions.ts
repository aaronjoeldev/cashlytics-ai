"use server";

import { getExchangeRate, refreshExchangeRates } from "@/lib/exchange-rates";
import { currencies, exchangeRates as fallbackRates, type Currency } from "@/lib/currency";
import { logger } from "@/lib/logger";

/**
 * Returns the exchange rate to convert `from` → `to`.
 * Validates that both currency codes are supported before delegating to the
 * live-rate service; falls back to hardcoded rates on unknown currencies.
 */
export async function getExchangeRateAction(from: string, to: string): Promise<number> {
  const validFrom = currencies.includes(from as Currency) ? (from as Currency) : null;
  const validTo = currencies.includes(to as Currency) ? (to as Currency) : null;

  if (!validFrom || !validTo) {
    logger.warn(
      `getExchangeRateAction: unsupported currency pair ${from}→${to}`,
      "getExchangeRateAction"
    );
    // Best-effort fallback
    const fromRate = fallbackRates[validFrom ?? "EUR"];
    const toRate = fallbackRates[validTo ?? "EUR"];
    return toRate / fromRate;
  }

  return getExchangeRate(validFrom, validTo);
}

/**
 * Manually triggers a refresh of the exchange-rate DB cache.
 * Useful for admin panels or on-demand cron triggers.
 */
export async function refreshRatesAction(): Promise<void> {
  await refreshExchangeRates();
}
