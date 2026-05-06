export const currencies = [
  "EUR",
  "USD",
  "JPY",
  "GBP",
  "CNY",
  "CHF",
  "AUD",
  "CAD",
  "HKD",
  "SGD",
  "KRW",
  "MXN",
  "INR",
  "NZD",
  "SEK",
  "NOK",
  "PLN",
  "TRY",
  "ZAR",
  "BRL",
  "DKK",
] as const;
export type Currency = (typeof currencies)[number];

export const popularConverterCurrencies = [
  "EUR",
  "USD",
  "JPY",
  "GBP",
  "CNY",
  "CHF",
  "AUD",
  "CAD",
  "HKD",
  "SGD",
  "KRW",
  "MXN",
  "INR",
  "NZD",
  "SEK",
  "NOK",
  "PLN",
  "TRY",
  "ZAR",
  "BRL",
] as const satisfies readonly Currency[];

export const defaultCurrency: Currency =
  (process.env.NEXT_PUBLIC_DEFAULT_CURRENCY as Currency) || "EUR";

export const currencySymbols: Record<Currency, string> = {
  EUR: "€",
  USD: "$",
  JPY: "¥",
  GBP: "£",
  CNY: "¥",
  CHF: "CHF",
  AUD: "A$",
  CAD: "C$",
  HKD: "HK$",
  SGD: "S$",
  KRW: "₩",
  MXN: "MX$",
  INR: "₹",
  NZD: "NZ$",
  SEK: "kr",
  NOK: "kr",
  PLN: "zł",
  TRY: "₺",
  ZAR: "R",
  BRL: "R$",
  DKK: "kr",
};

export const currencyLocales: Record<Currency, string> = {
  EUR: "de-DE",
  USD: "en-US",
  JPY: "ja-JP",
  GBP: "en-GB",
  CNY: "zh-CN",
  CHF: "de-CH",
  AUD: "en-AU",
  CAD: "en-CA",
  HKD: "zh-HK",
  SGD: "en-SG",
  KRW: "ko-KR",
  MXN: "es-MX",
  INR: "en-IN",
  NZD: "en-NZ",
  SEK: "sv-SE",
  NOK: "nb-NO",
  PLN: "pl-PL",
  TRY: "tr-TR",
  ZAR: "en-ZA",
  BRL: "pt-BR",
  DKK: "da-DK",
};

// TODO: Phase 7 — vollständig durch exchange-rates.ts ersetzen
export const exchangeRates: Record<Currency, number> = {
  EUR: 1,
  USD: 1.08,
  JPY: 163.5,
  GBP: 0.86,
  CNY: 7.82,
  CHF: 0.94,
  AUD: 1.65,
  CAD: 1.47,
  HKD: 8.42,
  SGD: 1.46,
  KRW: 1460,
  MXN: 18.4,
  INR: 90.1,
  NZD: 1.79,
  SEK: 11.5,
  NOK: 11.7,
  PLN: 4.31,
  TRY: 35.2,
  ZAR: 20.6,
  BRL: 6.18,
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
  baseCurrency: Currency = "EUR"
): string {
  const formatLocale = locale || currencyLocales[currency];
  const convertedAmount = convertCurrency(amount, baseCurrency, currency);
  return new Intl.NumberFormat(formatLocale, {
    style: "currency",
    currency,
  }).format(convertedAmount);
}

export function formatNumber(
  amount: number,
  locale: string = "de-DE",
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(locale, options).format(amount);
}

export function parseCurrencyInput(value: string, locale: string = "de-DE"): number {
  if (locale.startsWith("de") || locale.startsWith("fr") || locale.startsWith("da")) {
    return parseFloat(value.replace(/\./g, "").replace(",", "."));
  }
  return parseFloat(value.replace(/,/g, ""));
}
