# SearchDialog

**Path**: `src/components/molecules/search-dialog.tsx`
**Type**: Molecule
**Status**: ✅ Stable

## Overview

A global search dialog that provides quick access to accounts, incomes, expenses, daily expenses, and transfers. Features debounced search, keyboard navigation, and type-specific icons with color coding.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `open` | `boolean` | Yes | - | Controls dialog visibility |
| `onOpenChange` | `(open: boolean) => void` | Yes | - | Callback when dialog open state changes |

## Usage

```tsx
import { SearchDialog } from '@/components/molecules/search-dialog';

function Header() {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <button onClick={() => setSearchOpen(true)}>
        Search...
      </button>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
```

## Features

- Debounced search (250ms delay)
- Keyboard navigation (↑↓ arrows, Enter to select)
- Type-specific icons and color coding:
  - Account (Building2, blue)
  - Income (ArrowUpRight, emerald)
  - Expense (ArrowDownRight, red)
  - Daily Expense (Receipt, orange)
  - Transfer (ArrowRightLeft, purple)
- Currency formatting for results with amounts
- Auto-focus on input when opened
- Keyboard shortcut hints

## Dependencies

- `react` (useState, useEffect, useCallback)
- `next/navigation` (useRouter)
- `lucide-react` (Search, Loader2, Building2, ArrowRightLeft, ArrowUpRight, ArrowDownRight, Receipt)
- `@/components/ui/dialog` (Dialog, DialogContent)
- `@/actions/search-actions` (globalSearch, SearchResult)
- `@/lib/settings-context` (useSettings)
- `@/lib/utils` (cn)

## Related Components

- [Header](../layout/header.md) - Contains the search trigger

## Search Result Types

```typescript
interface SearchResult {
  id: string;
  type: 'account' | 'income' | 'expense' | 'daily_expense' | 'transfer';
  title: string;
  href: string;
  amount?: string;
}
```
