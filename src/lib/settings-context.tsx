'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { type Locale, defaultLocale, locales } from '@/i18n/config';
import { type Currency, defaultCurrency, currencies, formatCurrency as formatCurrencyUtil } from '@/lib/currency';

interface SettingsContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  formatCurrency: (amount: number) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const LOCALE_COOKIE = 'locale';
const CURRENCY_COOKIE = 'currency';

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
}

function setCookie(name: string, value: string, days: number = 365): void {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

interface SettingsProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
  initialCurrency?: Currency;
}

function getInitialLocale(fallback: Locale): Locale {
  if (typeof document === 'undefined') return fallback;
  const cookieLocale = getCookie(LOCALE_COOKIE) as Locale | undefined;
  return cookieLocale && locales.includes(cookieLocale) ? cookieLocale : fallback;
}

function getInitialCurrency(fallback: Currency): Currency {
  if (typeof document === 'undefined') return fallback;
  const cookieCurrency = getCookie(CURRENCY_COOKIE) as Currency | undefined;
  return cookieCurrency && currencies.includes(cookieCurrency) ? cookieCurrency : fallback;
}

export function SettingsProvider({
  children,
  initialLocale,
  initialCurrency,
}: SettingsProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => getInitialLocale(initialLocale || defaultLocale));
  const [currency, setCurrencyState] = useState<Currency>(() => getInitialCurrency(initialCurrency || defaultCurrency));

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    setCookie(LOCALE_COOKIE, newLocale);
    // Reload the page to apply new locale
    window.location.reload();
  }, []);

  const setCurrency = useCallback((newCurrency: Currency) => {
    setCurrencyState(newCurrency);
    setCookie(CURRENCY_COOKIE, newCurrency);
  }, []);

  const formatCurrency = useCallback(
    (amount: number) => {
      const localeMap: Record<Locale, string> = {
        de: 'de-DE',
        en: 'en-US',
      };
      return formatCurrencyUtil(amount, currency, localeMap[locale]);
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
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
