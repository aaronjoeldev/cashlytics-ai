# Overview Page

**Route**: `/overview`
**File**: `src/app/(dashboard)/overview/page.tsx`
**Client Component**: `src/app/(dashboard)/overview/client.tsx`

## Overview
The overview page provides a detailed monthly financial summary, including income vs expenses, category breakdown, fixed costs, periodic reserves, and a 3-month financial forecast.

## Features
- **Monthly Balance KPIs**: Income, expenses, and net balance for the month
- **Category Breakdown**: Expenses organized by category with percentages
- **Monthly Fixed Costs**: List of all monthly recurring expenses
- **Periodic Reserves**: Non-monthly expenses converted to monthly reserve amounts
- **3-Month Forecast**: Projected financial outlook for next 3 months
- **Summary Card**: Combined view of fixed costs, reserves, and total monthly commitment

## Components Used
| Component | Purpose |
|-----------|---------|
| `Card`, `CardHeader`, `CardContent` | Container components |
| `Progress` | Visual progress bar for categories |
| `ArrowUpRight`, `ArrowDownRight`, `Scale` | Income/expense/balance icons |
| `PieChart`, `Wallet`, `PiggyBank`, `CalendarRange` | Section icons |
| `useSettings` | Currency formatting hook |

## Server Actions Used
| Action | Purpose |
|--------|---------|
| `getMonthlyOverview` | Fetches income, expenses, and balance for specified month |
| `getForecast` | Gets 3-month financial projection |
| `getCategoryBreakdown` | Retrieves expense breakdown by category |
| `getNormalizedMonthlyExpenses` | Converts all expenses to monthly equivalents |

## Data Structures

### MonthlyOverview
```typescript
interface MonthlyOverview {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}
```

### Forecast
```typescript
interface Forecast {
  projectedBalance: number;
  monthlyDetails: Array<{
    month: number;
    year: number;
    income: number;
    expenses: number;
    balance: number;
  }>;
}
```

## Recurrence Types & Labels
| Type | Label (DE) |
|------|------------|
| `daily` | Täglich |
| `weekly` | Wöchentlich |
| `monthly` | Monatlich |
| `quarterly` | Vierteljährlich |
| `yearly` | Jährlich |
| `custom` | Alle N Monate |
| `once` | Einmalig |

## User Interactions
- View current month's income vs expenses
- Analyze spending by category
- See which expenses are monthly fixed costs
- Understand monthly reserve requirements for periodic expenses
- Review 3-month financial forecast

## Related Pages
- [Dashboard](./dashboard.md) - Quick KPI overview
- [Expenses](./expenses.md) - Full expense management
- [Analytics](./analytics.md) - Charts and historical trends
