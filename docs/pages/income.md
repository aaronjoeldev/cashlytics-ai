# Income Page

**Route**: `/income`
**File**: `src/app/(dashboard)/income/page.tsx`
**Client Component**: `src/app/(dashboard)/income/client.tsx`

## Overview
The income page manages all income sources, allowing users to track recurring income (like salaries) and one-time income entries. Each income is associated with an account where it's received.

## Features
- **Income List**: Display all income sources with:
  - Source name and associated account
  - Recurrence type (monthly, yearly, once)
  - Credit schedule (e.g., "every 1st")
  - Amount and start date
- **Create Income**: Modal form to add new income entries
- **Edit Income**: Modify existing income details
- **Delete Income**: Remove income entries with confirmation
- **Visual Indicators**: Green color scheme for income-related elements

## Components Used
| Component | Purpose |
|-----------|---------|
| `Card`, `CardHeader`, `CardContent` | Container components |
| `Button` | Action buttons |
| `IncomeForm` | Form for creating/editing income |
| `CalendarDays`, `Trash2`, `Pencil` | Action and indicator icons |
| `useToast` | Toast notifications |
| `useSettings` | Currency formatting |

## Server Actions Used
| Action | Purpose |
|--------|---------|
| `getAccounts` | Fetches accounts for income assignment |
| `getIncomes` | Gets all income entries |
| `deleteIncome` | Deletes an income entry |

## Recurrence Types
| Type | Label (DE) |
|------|------------|
| `once` | Einmalig |
| `monthly` | Monatlich |
| `yearly` | Jährlich |

## Data Structures

### IncomeWithAccount
```typescript
interface IncomeWithAccount {
  id: string;
  source: string;
  amount: string;
  startDate: Date | string;
  endDate: Date | string | null;
  recurrenceType: 'once' | 'monthly' | 'yearly';
  account: Account | null;
}
```

## Debit Label Logic
- **Monthly**: "jeden {day}." (e.g., "jeden 1.")
- **Yearly**: "{day}. {month} (jährlich)" (e.g., "1. Jan (jährlich)")
- **Once**: Formatted date

## User Interactions
- View all income sources
- Create new income entries
- Edit existing income details
- Delete income with confirmation
- See credit schedule for recurring income

## Related Pages
- [Dashboard](./dashboard.md) - Income included in monthly totals
- [Overview](./overview.md) - Income vs expenses breakdown
- [Accounts](./accounts.md) - Accounts receiving income
