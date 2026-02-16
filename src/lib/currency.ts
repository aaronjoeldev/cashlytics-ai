export const currencies = ['EUR', 'USD', 'GBP', 'CHF', 'DKK'] as const;
export type Currency = (typeof currencies)[number];

export const defaultCurrency: Currency = (process.env.NEXT_PUBLIC_DEFAULT_CURRENCY as Currency) || 'EUR';

export const currencySymbols: Record<Currency, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  CHF: 'CHF',
  DKK: 'kr',
};

export const currencyLocales: Record<Currency, string> = {
  EUR: 'de-DE',
  USD: 'en-US',
  GBP: 'en-GB',
  CHF: 'de-CH',
  DKK: 'da-DK',
};

export const exchangeRates: Record<Currency, number> = {
  EUR: 1,
  USD: 1.08,
  GBP: 0.85,
  CHF: 0.94,
  DKK: 7.46,
};

export function convertCurrency(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency
): number {
  if (fromCurrency === toCurrency) return amount;
  const amountInEUR = amount / exchangeRates[fromCurrency];
  return amountInEUR * exchangeRates[toCurrency];
}

export function formatCurrency(
  amount: number,
  currency: Currency = defaultCurrency,
  locale?: string,
  baseCurrency: Currency = 'EUR'
): string {
  const formatLocale = locale || currencyLocales[currency];
  const convertedAmount = convertCurrency(amount, baseCurrency, currency);
  return new Intl.NumberFormat(formatLocale, {
    style: 'currency',
    currency,
  }).format(convertedAmount);
}

export function formatNumber(
  amount: number,
  locale: string = 'de-DE',
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(locale, options).format(amount);
}

export function parseCurrencyInput(value: string, locale: string = 'de-DE'): number {
  if (locale.startsWith('de') || locale.startsWith('fr') || locale.startsWith('da')) {
    return parseFloat(value.replace(/\./g, '').replace(',', '.'));
  }
  return parseFloat(value.replace(/,/g, ''));
}
