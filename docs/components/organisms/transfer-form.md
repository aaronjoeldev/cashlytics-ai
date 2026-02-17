# TransferForm

**Path**: `src/components/organisms/transfer-form.tsx`
**Type**: Organism
**Status**: ✅ Stable

## Overview

A dialog form for creating money transfers between accounts. Supports recurring transfers with various recurrence patterns and date range specification.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `accounts` | `Account[]` | Yes | - | Available accounts for selection |
| `onSuccess` | `(data: any) => void` | No | - | Callback after successful transfer creation |
| `open` | `boolean` | No | - | Controlled dialog open state |
| `onOpenChange` | `(open: boolean) => void` | No | - | Callback when dialog state changes |

## Usage

```tsx
import { TransferForm } from '@/components/organisms/transfer-form';

function TransfersPage({ accounts }: { accounts: Account[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <TransferForm
      accounts={accounts}
      open={isOpen}
      onOpenChange={setIsOpen}
      onSuccess={(transfer) => {
        toast.success('Transfer created');
        refreshTransfers();
      }}
    />
  );
}
```

## Features

- Source and target account selection
- Prevents selecting same account as source and target
- Amount input with decimal support
- Recurrence options:
  - Once (Einmalig)
  - Monthly (Monatlich)
  - Quarterly (Quartalsweise)
  - Yearly (Jährlich)
- Optional description
- Start and optional end date
- Zod form validation
- Controlled and uncontrolled modes

## Dependencies

- `react` (useState)
- `react-hook-form` (useForm)
- `@hookform/resolvers/zod` (zodResolver)
- `lucide-react` (Plus, ArrowRight)
- `@/lib/validations/transaction` (transferSchema, transferRecurrenceTypes, TransferInput)
- `@/actions/transfer-actions` (createTransfer)
- `@/components/ui/button` (Button)
- `@/components/ui/input` (Input)
- `@/components/ui/label` (Label)
- `@/components/ui/select` (Select, SelectContent, SelectItem, SelectTrigger, SelectValue)
- `@/components/ui/dialog` (Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription)
- `@/types/database` (Account)

## Form Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sourceAccountId` | select | Yes | Source account for transfer |
| `targetAccountId` | select | Yes | Target account for transfer |
| `amount` | number | Yes | Transfer amount in EUR |
| `description` | text | No | Optional transfer description |
| `recurrenceType` | select | Yes | Recurrence pattern |
| `startDate` | date | Yes | Transfer start date |
| `endDate` | date | No | Optional end date for recurring transfers |

## Related Components

- [FloatingActions](./floating-actions.md) - Quick access to transfer creation
- [AccountForm](./account-form.md) - Create accounts for transfers
