# AccountForm

**Path**: `src/components/organisms/account-form.tsx`
**Type**: Organism
**Status**: ✅ Stable

## Overview

A dialog form for creating financial accounts. Supports three account types (checking, savings, ETF) with initial balance setting. Can be used in controlled or uncontrolled mode.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `onSuccess` | `(data: any) => void` | No | - | Callback after successful account creation |
| `open` | `boolean` | No | - | Controlled dialog open state |
| `onOpenChange` | `(open: boolean) => void` | No | - | Callback when dialog state changes |

## Usage

```tsx
import { AccountForm } from '@/components/organisms/account-form';

// Controlled mode
<AccountForm
  open={isOpen}
  onOpenChange={setIsOpen}
  onSuccess={(account) => {
    console.log('Created:', account);
    refreshAccounts();
  }}
/>

// Uncontrolled mode (renders trigger button)
<AccountForm onSuccess={handleSuccess} />
```

## Features

- Three account types:
  - Checking (Girokonto) 🏦
  - Savings (Sparkonto) piggy
  - ETF (ETF-Konto) 📈
- Initial balance input
- Form validation (name required)
- Loading state during submission
- Toast notifications for success/error
- Automatic form reset after success
- Controlled and uncontrolled dialog modes

## Dependencies

- `react` (useState)
- `next/navigation` (useRouter)
- `lucide-react` (Plus)
- `@/components/ui/dialog` (Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger)
- `@/components/ui/button` (Button)
- `@/components/ui/input` (Input)
- `@/components/ui/label` (Label)
- `@/components/ui/select` (Select, SelectContent, SelectItem, SelectTrigger, SelectValue)
- `@/actions/account-actions` (createAccount)
- `@/hooks/use-toast` (useToast)

## Form Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | text | Yes | Account display name |
| `type` | select | Yes | Account type (checking/savings/etf) |
| `balance` | number | No | Initial balance (defaults to 0) |

## Related Components

- [FloatingActions](./floating-actions.md) - Quick access to account creation
- [TransferForm](./transfer-form.md) - Uses accounts for transfers
- [IncomeForm](./income-form.md) - Uses accounts for income
- [ExpenseForm](./expense-form.md) - Uses accounts for expenses
