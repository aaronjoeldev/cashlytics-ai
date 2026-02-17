# Utility Functions

## Overview

Cashlytics provides utility functions for styling, currency handling, and general helpers.

---

## Styling Utilities

### cn()

**Location**: `src/lib/utils.ts`

Combines class names with Tailwind CSS class merging.

```typescript
import { cn } from '@/lib/utils';

function cn(...inputs: ClassValue[]): string
```

#### Usage

```typescript
// Basic usage
cn('px-4 py-2', 'bg-blue-500')  // 'px-4 py-2 bg-blue-500'

// Conditional classes
cn('base-class', isActive && 'active-class')  // 'base-class active-class' or 'base-class'

// Override handling (tailwind-merge resolves conflicts)
cn('px-4', 'px-2')  // 'px-2' (second wins)

// With object syntax
cn({ 'bg-red-500': hasError, 'bg-green-500': !hasError })
```

#### Implementation

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## Currency Utilities

**Location**: `src/lib/currency.ts`

### Supported Currencies

```typescript
const currencies = ['EUR', 'USD', 'GBP', 'CHF', 'DKK'] as const;
type Currency = (typeof currencies)[number];
```

### Currency Symbols

```typescript
const currencySymbols: Record<Currency, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  CHF: 'CHF',
  DKK: 'kr',
};
```

### Currency Locales

```typescript
const currencyLocales: Record<Currency, string> = {
  EUR: 'de-DE',
  USD: 'en-US',
  GBP: 'en-GB',
  CHF: 'de-CH',
  DKK: 'da-DK',
};
```

### Exchange Rates

Base currency is EUR. Rates are approximate static values.

```typescript
const exchangeRates: Record<Currency, number> = {
  EUR: 1,
  USD: 1.08,
  GBP: 0.85,
  CHF: 0.94,
  DKK: 7.46,
};
```

---

### convertCurrency()

Converts amount between currencies using EUR as base.

```typescript
function convertCurrency(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency
): number
```

#### Usage

```typescript
import { convertCurrency } from '@/lib/currency';

// Convert 100 USD to EUR
convertCurrency(100, 'USD', 'EUR')  // ~92.59

// Convert 50 EUR to GBP
convertCurrency(50, 'EUR', 'GBP')  // ~42.50
```

#### Implementation

```typescript
export function convertCurrency(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency
): number {
  if (fromCurrency === toCurrency) return amount;
  const amountInEUR = amount / exchangeRates[fromCurrency];
  return amountInEUR * exchangeRates[toCurrency];
}
```

---

### formatCurrency()

Formats amount as localized currency string.

```typescript
function formatCurrency(
  amount: number,
  currency?: Currency,      // Default: 'EUR' or env var
  locale?: string,          // Default: currency-specific locale
  baseCurrency?: Currency   // Default: 'EUR'
): string
```

#### Usage

```typescript
import { formatCurrency, defaultCurrency } from '@/lib/currency';

// Basic usage
formatCurrency(1234.56)  // '1.234,56 €' (German locale)

// With currency
formatCurrency(1234.56, 'USD')  // '$1,234.56'

// With locale override
formatCurrency(1234.56, 'EUR', 'en-US')  // '€1,234.56'
```

#### Environment Variable

```bash
NEXT_PUBLIC_DEFAULT_CURRENCY=EUR
```

---

### formatNumber()

Formats number with locale-specific formatting.

```typescript
function formatNumber(
  amount: number,
  locale?: string,  // Default: 'de-DE'
  options?: Intl.NumberFormatOptions
): string
```

#### Usage

```typescript
import { formatNumber } from '@/lib/currency';

formatNumber(1234.567)  // '1.234,567'

formatNumber(0.123, 'en-US', { 
  style: 'percent',
  minimumFractionDigits: 1 
})  // '12.3%'
```

---

### parseCurrencyInput()

Parses localized number strings to numbers.

```typescript
function parseCurrencyInput(
  value: string,
  locale?: string  // Default: 'de-DE'
): number
```

#### Usage

```typescript
import { parseCurrencyInput } from '@/lib/currency';

// German format (comma as decimal separator)
parseCurrencyInput('1.234,56', 'de-DE')  // 1234.56

// English format (period as decimal separator)
parseCurrencyInput('1,234.56', 'en-US')  // 1234.56
```

#### Implementation

Handles both European and Anglo number formats:

```typescript
export function parseCurrencyInput(value: string, locale: string = 'de-DE'): number {
  if (locale.startsWith('de') || locale.startsWith('fr') || locale.startsWith('da')) {
    return parseFloat(value.replace(/\./g, '').replace(',', '.'));
  }
  return parseFloat(value.replace(/,/g, ''));
}
```

---

## Settings Context

**Location**: `src/lib/settings-context.tsx`

### SettingsProvider

React context provider for application settings.

```typescript
interface SettingsProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
  initialCurrency?: Currency;
}

function SettingsProvider({ children, initialLocale, initialCurrency }: SettingsProviderProps)
```

#### Usage

```typescript
// In layout or app wrapper
<SettingsProvider initialLocale="de" initialCurrency="EUR">
  <App />
</SettingsProvider>
```

### useSettings Hook

Access settings from any component.

```typescript
function useSettings(): SettingsContextType
```

#### Returns

```typescript
interface SettingsContextType {
  locale: Locale;                    // Current locale ('de' | 'en')
  setLocale: (locale: Locale) => void;  // Changes locale (reloads page)
  currency: Currency;                // Current currency
  setCurrency: (currency: Currency) => void;  // Changes currency
  formatCurrency: (amount: number) => string;  // Formats with current settings
}
```

#### Usage

```typescript
import { useSettings } from '@/lib/settings-context';

function PriceTag({ price }: { price: number }) {
  const { formatCurrency } = useSettings();
  return <span>{formatCurrency(price)}</span>;
}
```

---

## Version

**Location**: `src/lib/version.ts`

Application version, auto-generated by release workflow.

```typescript
export const APP_VERSION = '0.1.0';
```

#### Usage

```typescript
import { APP_VERSION } from '@/lib/version';

console.log(`Cashlytics v${APP_VERSION}`);
```

---

## Utility Summary Table

| Function | Location | Purpose |
|----------|----------|---------|
| `cn()` | `lib/utils.ts` | Merge Tailwind classes |
| `convertCurrency()` | `lib/currency.ts` | Convert between currencies |
| `formatCurrency()` | `lib/currency.ts` | Format number as currency |
| `formatNumber()` | `lib/currency.ts` | Format number with locale |
| `parseCurrencyInput()` | `lib/currency.ts` | Parse localized number string |
| `useSettings()` | `lib/settings-context.tsx` | Access locale/currency settings |
