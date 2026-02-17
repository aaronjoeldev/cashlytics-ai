# Account Detail Page

**Route**: `/accounts/[id]`
**File**: `src/app/(dashboard)/accounts/[id]/page.tsx`
**Client Component**: `src/app/(dashboard)/accounts/[id]/client.tsx`
**Forecast Component**: `src/app/(dashboard)/accounts/[id]/forecast-client.tsx`

## Overview
The account detail page provides an in-depth view of a single account, showing its transaction history, monthly summaries, and future balance projections.

## Features
- **Account Header**: Displays account name, type, and current balance
- **Tabbed Interface**: 
  - **Transactions Tab**: Filterable transaction list by month
  - **Forecast Tab**: Financial projection for 3/6/12 months
- **Monthly Summary Cards**: Income, expenses, transfers, and balance for selected month
- **Transaction List**: Combined view of expenses, incomes, and transfers
- **Time Horizon Selector**: Choose forecast period (3, 6, or 12 months)
- **Projection Visualization**: Visual bars showing balance progression

## Components Used
| Component | Purpose |
|-----------|---------|
| `Card`, `CardHeader`, `CardContent` | Container components |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | Tab navigation |
| `Select` | Month and time horizon selectors |
| `Button` | Navigation and action buttons |
| `ForecastClient` | Financial forecast visualization |
| `ArrowUpRight`, `ArrowDownRight`, `ArrowRightLeft` | Transaction type icons |

## Server Actions Used
| Action | Purpose |
|--------|---------|
| `getAccountById` | Fetches single account details |
| `getExpenses` | Gets expenses for the account |
| `getIncomes` | Gets incomes for the account |
| `getTransfers` | Gets transfers involving the account |
| `getAccountForecast` | Calculates future balance projections |

## Transaction Types
| Type | Icon | Color | Description |
|------|------|-------|-------------|
| `income` | ArrowUpRight | Green | Money received |
| `expense` | ArrowDownRight | Red | Money spent |
| `transfer_in` | ArrowRightLeft | Blue | Incoming transfer |
| `transfer_out` | ArrowRightLeft | Blue | Outgoing transfer |

## Data Structures

### Transaction (Unified)
```typescript
type Transaction = {
  id: string;
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  name: string;
  amount: string;
  date: Date | string;
  category?: { name: string } | null;
  description?: string | null;
};
```

### AccountForecast
```typescript
interface AccountForecast {
  currentBalance: number;
  isCumulativeAccount: boolean;
  projectedMonths: Array<{
    month: number;
    year: number;
    monthName: string;
    income: number;
    expenses: number;
    transfersIn: number;
    transfersOut: number;
    balance: number;
    cumulativeBalance: number;
  }>;
}
```

## User Interactions
- Navigate back to accounts list
- Switch between Transactions and Forecast tabs
- Select different months to view historical transactions
- Choose forecast time horizon (3/6/12 months)
- View projected income, expenses, and final balance

## Related Pages
- [Accounts](./accounts.md) - Account listing
- [Expenses](./expenses.md) - Expense management
- [Income](./income.md) - Income management
- [Transfers](./transfers.md) - Transfer management
