# Currency Converter: Variable Source Currency

**Date:** 2026-05-06
**Branch:** feat/multi-currency
**Status:** Approved

## Overview

The currency converter tool currently hardcodes EUR as the source currency. This spec describes making the source currency variable: defaulting to the user's base currency, freely changeable, and swappable with the target currency.

## Requirements

- Source currency defaults to the user's base currency (from `useSettings()`)
- Source currency is manually selectable from all 21 supported currencies
- A swap button exchanges source and target currency (amount stays unchanged)
- Source and target currency cannot be identical; selecting one auto-adjusts the other
- API remains unchanged (`base=EUR`); cross-rates are calculated client-side

## Architecture

### Cross-Rate Calculation

All rates are fetched once with `base=EUR`. For any source/target combination:

```ts
function getCrossRate(rates: Record<string, number>, source: string, target: string): number {
  const sourceRate = source === "EUR" ? 1 : rates[source];
  const targetRate = target === "EUR" ? 1 : rates[target];
  return targetRate / sourceRate;
}
```

This formula is accurate for all top-20 traded currencies. EUR has an implicit rate of 1.0 in the rates object.

### State Changes (`tools/page.tsx`)

New state:
```ts
const [sourceCurrency, setSourceCurrency] = useState<Currency>(baseCurrency);
```

Sync with user base currency on initial DB load (one-time only):
```ts
const [sourceSynced, setSourceSynced] = useState(false);
useEffect(() => {
  if (!sourceSynced && baseCurrency) {
    setSourceCurrency(baseCurrency);
    setSourceSynced(true);
  }
}, [baseCurrency, sourceSynced]);
```

### Swap Logic

```ts
function handleSwap() {
  setSourceCurrency(targetCurrency);
  setTargetCurrency(sourceCurrency);
  // amount stays unchanged
}
```

Collision guard (source === target after manual select):
- When setting source → if new source === current target, set target to previous source
- When setting target → if new target === current source, set source to previous target

## UI Changes (`tools/page.tsx`)

Current layout (single column, EUR fixed):
```
[Amount input]  EUR (fixed label)
               ↓
[Result]       [Target dropdown]
```

New layout (symmetric):
```
[Amount input]  [Source dropdown ▼]
        ⇄ (Swap button, centered)
[Result]        [Target dropdown ▼]
```

- **Source dropdown**: All 21 currencies, no quick-pick buttons
- **Target dropdown**: All 21 currencies + 8 quick-pick buttons (unchanged)
- **Swap button**: `ArrowRightLeft` icon (already imported), swaps source ↔ target
- **Rate display**: `1 {source} = X.XX {target}` (dynamic, was hardcoded `1 EUR = ...`)
- **Footer label**: unchanged ("Live rates" / "Fallback rates")

The `TARGET_CURRENCIES` filter that excluded EUR is removed — EUR is now a valid target (and source).

## Files Changed

| File | Change |
|------|--------|
| `src/app/(dashboard)/tools/page.tsx` | Source dropdown, swap button, cross-rate calc, sync effect |

No API changes. No DB schema changes. No new files.

## Out of Scope

- Persisting the last-used source currency across sessions
- Quick-pick buttons for source currency
- Fetching rates with a dynamic base from the Frankfurter API
