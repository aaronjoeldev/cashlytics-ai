"use client";

import { createContext, useContext, useCallback, useEffect, type ReactNode } from "react";
import { type Locale, defaultLocale } from "@/i18n/config";
import {
  type Currency,
  defaultCurrency,
  currencies,
  formatCurrency as formatCurrencyUtil,
  convertCurrency,
  exchangeRates as fallbackRates,
  type ExchangeRateTable,
} from "@/lib/currency";
import { updateBaseCurrency, updateLocale } from "@/actions/settings-actions";
import { toast } from "sonner";
import type { ApiResponse } from "@/types/database";

export interface SettingsContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  /** Formats an amount that is already in the base currency. */
  formatCurrency: (amount: number) => string;
  /** Exchange rates (base EUR) the server computed this page with. */
  rates: ExchangeRateTable;
  /** Converts between currencies with the same rates the server uses. */
  convert: (amount: number, from: Currency, to: Currency) => number;
  /**
   * Formats an amount in its own currency, without conversion. Unknown or missing currencies
   * fall back to the base currency.
   */
  formatAmount: (amount: number | string, currency?: string | null) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const LOCALE_COOKIE = "locale";
const CURRENCY_COOKIE = "currency";

function setCookie(name: string, value: string, days: number = 365): void {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

interface SettingsProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
  initialCurrency?: Currency;
  rates?: ExchangeRateTable;
}

/**
 * Locale and currency come from the server (stored user settings, cookie as fallback), so client
 * and server always format and compute with the same values. Changing one saves it and reloads.
 */
export function SettingsProvider({
  children,
  initialLocale,
  initialCurrency,
  rates = fallbackRates,
}: SettingsProviderProps) {
  const locale = initialLocale ?? defaultLocale;
  const currency = initialCurrency ?? defaultCurrency;

  // Keep the cookies in line with the stored settings, so signed-out pages use them too
  useEffect(() => {
    setCookie(LOCALE_COOKIE, locale);
    setCookie(CURRENCY_COOKIE, currency);
  }, [locale, currency]);

  const saveAndReload = useCallback(
    async (save: () => Promise<ApiResponse<void>>, cookie: string, value: string) => {
      let result: ApiResponse<void>;
      try {
        result = await save();
      } catch {
        result = { success: false, error: "Einstellung konnte nicht gespeichert werden." };
      }
      // Signed out there is nothing to store; the cookie alone carries the choice
      if (!result.success && result.error !== "Unauthorized") {
        toast.error(result.error);
        return;
      }
      setCookie(cookie, value);
      window.location.reload();
    },
    []
  );

  const setLocale = useCallback(
    (newLocale: Locale) =>
      void saveAndReload(() => updateLocale(newLocale), LOCALE_COOKIE, newLocale),
    [saveAndReload]
  );

  const setCurrency = useCallback(
    (newCurrency: Currency) =>
      void saveAndReload(() => updateBaseCurrency(newCurrency), CURRENCY_COOKIE, newCurrency),
    [saveAndReload]
  );

  const convert = useCallback(
    (amount: number, from: Currency, to: Currency) => convertCurrency(amount, from, to, rates),
    [rates]
  );

  const formatCurrency = useCallback(
    (amount: number) => {
      const localeMap: Record<Locale, string> = {
        de: "de-DE",
        en: "en-US",
      };
      // Amount is already in baseCurrency (post-toBase conversion), so pass currency
      // as baseCurrency too — convertCurrency(amount, currency, currency) = no-op.
      return formatCurrencyUtil(amount, currency, localeMap[locale], currency);
    },
    [currency, locale]
  );

  const formatAmount = useCallback(
    (amount: number | string, entryCurrency?: string | null) => {
      const value = typeof amount === "string" ? Number.parseFloat(amount) : amount;
      const target =
        entryCurrency && currencies.includes(entryCurrency as Currency)
          ? (entryCurrency as Currency)
          : currency;
      return formatCurrencyUtil(
        Number.isFinite(value) ? value : 0,
        target,
        locale === "en" ? "en-US" : "de-DE",
        target
      );
    },
    [currency, locale]
  );

  return (
    <SettingsContext.Provider
      value={{
        locale,
        setLocale,
        currency,
        setCurrency,
        formatCurrency,
        formatAmount,
        rates,
        convert,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
