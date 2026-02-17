# IncomeForm

**Path**: `src/components/organisms/income-form.tsx`
**Type**: Organism
**Status**: ✅ Stable

## Overview

A dialog form for creating and editing income entries. Supports recurring income with various patterns, date range specification, and account assignment.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `accounts` | `Account[]` | Yes | - | Available accounts for selection |
| `onSuccess` | `(data: any) => void` | No | - | Callback after successful operation |
| `editIncome` | `Income \| null` | No | - | Existing income to edit (switches to edit mode) |
| `open` | `boolean` | No | - | Controlled dialog open state |
| `onOpenChange` | `(open: boolean) => void` | No | - | Callback when dialog state changes |

## Usage

```tsx
import { IncomeForm } from '@/components/organisms/income-form';

function IncomePage({ accounts }: { accounts: Account[] }) {
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);

  return (
    <IncomeForm
      accounts={accounts}
      editIncome={editingIncome}
      onSuccess={(income) => {
        toast.success(editingIncome ? 'Updated' : 'Created');
        refreshIncomes();
      }}
    />
  );
}
```

## Features

- Create and edit modes
- Income source name input
- Amount with decimal support
- Recurrence options:
  - Once (Einmalig)
  - Monthly (Monatlich)
  - Yearly (Jährlich)
- Account selection
- Start and optional end date
- Form resets appropriately on mode switch
- Zod validation

## Dependencies

- `react` (useState, useEffect)
- `react-hook-form` (useForm)
- `@hookform/resolvers/zod` (zodResolver)
- `lucide-react` (Plus)
- `@/lib/validations/transaction` (incomeSchema, IncomeInput, incomeRecurrenceTypes)
- `@/actions/income-actions` (createIncome, updateIncome)
- `@/components/ui/button` (Button)
- `@/components/ui/input` (Input)
- `@/components/ui/label` (Label)
- `@/components/ui/select` (Select, SelectContent, SelectItem, SelectTrigger, SelectValue)
- `@/components/ui/dialog` (Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription)
- `@/types/database` (Account, Income)

## Form Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source` | text | Yes | Income source name (e.g., "Salary") |
| `amount` | number | Yes | Income amount in EUR |
| `recurrenceType` | select | Yes | Recurrence pattern |
| `accountId` | select | Yes | Target account |
| `startDate` | date | Yes | Income start date |
| `endDate` | date | No | Optional end date |

## Related Components

- [FloatingActions](./floating-actions.md) - Quick access to income creation
- [ExpenseForm](./expense-form.md) - Similar form for expenses
- [TransferForm](./transfer-form.md) - Similar form for transfers
