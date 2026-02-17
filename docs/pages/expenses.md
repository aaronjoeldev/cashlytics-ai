# Expenses Page

**Route**: `/expenses`
**File**: `src/app/(dashboard)/expenses/page.tsx`
**Client Component**: `src/app/(dashboard)/expenses/client.tsx`

## Overview
The expenses page is the central hub for managing all expenses, including both recurring (periodic) expenses and one-time daily expenses. It provides a comprehensive view of fixed costs, reserve requirements, and daily spending.

## Features
- **Summary Cards**: 
  - Monthly fixed costs total
  - Monthly reserve amount (for non-monthly expenses)
  - Total normalized monthly expenses
- **Tabbed Interface**:
  - **Fixed Costs**: Monthly recurring expenses
  - **Reserves**: Periodic expenses (quarterly, yearly, custom)
  - **One-time**: Single occurrence expenses
  - **Daily**: Individual daily spending entries
- **Expense Rows**: Each expense shows:
  - Category icon and name
  - Recurrence type and monthly reserve (if applicable)
  - Debit schedule (e.g., "every 15th")
  - Amount and start/end dates
- **CRUD Operations**: Create, edit, and delete expenses

## Components Used
| Component | Purpose |
|-----------|---------|
| `Card`, `CardHeader`, `CardContent` | Container components |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | Tab navigation |
| `Button` | Action buttons |
| `ExpenseForm` | Form for creating/editing expenses |
| `Wallet`, `PiggyBank`, `Repeat`, `CalendarDays` | Section icons |
| `useToast` | Toast notifications |
| `useSettings` | Currency formatting |

## Server Actions Used
| Action | Purpose |
|--------|---------|
| `getAccounts` | Fetches accounts for expense assignment |
| `getCategories` | Fetches categories for classification |
| `getExpenses` | Gets all periodic expenses |
| `getDailyExpenses` | Gets all daily expense entries |
| `deleteExpense` | Deletes a periodic expense |
| `deleteDailyExpense` | Deletes a daily expense entry |

## Recurrence Types
| Type | Label (DE) | Monthly Factor |
|------|------------|----------------|
| `once` | Einmalig | 0 |
| `daily` | Täglich | ×30 |
| `weekly` | Wöchentlich | ×4.33 |
| `monthly` | Monatlich | ×1 |
| `quarterly` | Quartalsweise | ÷3 |
| `yearly` | Jährlich | ÷12 |
| `custom` | Benutzerdefiniert | ÷interval |

## Data Structures

### ExpenseWithDetails
```typescript
interface ExpenseWithDetails {
  id: string;
  name: string;
  amount: string;
  startDate: Date | string;
  endDate: Date | string | null;
  recurrenceType: string;
  recurrenceInterval: number | null;
  category: Category | null;
  account: Account | null;
}
```

### DailyExpenseWithDetails
```typescript
interface DailyExpenseWithDetails {
  id: string;
  description: string;
  amount: string;
  date: Date | string;
  category: Category | null;
  account: Account | null;
}
```

## User Interactions
- View expenses organized by type
- Create new expenses (periodic or daily)
- Edit existing expenses
- Delete expenses with confirmation
- See monthly reserve calculations
- Understand debit schedules

## Related Pages
- [Overview](./overview.md) - Summary of all expenses
- [Categories](./categories.md) - Manage expense categories
- [Accounts](./accounts.md) - Account details and balances
