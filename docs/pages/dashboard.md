# Dashboard Page

**Route**: `/dashboard`
**File**: `src/app/(dashboard)/dashboard/page.tsx`
**Client Component**: `src/app/(dashboard)/dashboard/client.tsx`

## Overview
The main dashboard provides a comprehensive overview of the user's financial situation, displaying key performance indicators (KPIs), category breakdown, and recent transactions.

## Features
- **KPI Cards**: Total assets, monthly income, monthly expenses, savings rate
- **Trend indicators**: Shows income/expense changes vs previous month
- **Category Breakdown**: Visual breakdown of expenses by category with progress bars
- **Recent Transactions**: List of the 5 most recent transactions
- **Responsive design**: Adapts from 1 to 4 columns based on screen size

## Components Used
| Component | Purpose |
|-----------|---------|
| `KpiCard` | Displays individual metric with icon, value, and trend |
| `Card`, `CardHeader`, `CardContent` | Container components |
| `Progress` | Visual progress bar for category percentages |
| `TrendingUp`, `TrendingDown`, `Minus` | Trend indicator icons |
| `useSettings` | Currency formatting hook |

## Server Actions Used
| Action | Purpose |
|--------|---------|
| `getDashboardStats` | Fetches total assets, monthly income/expenses, savings rate |
| `getCategoryBreakdown` | Gets expense breakdown by category for current month |
| `getRecentTransactions` | Retrieves last N daily expenses |

## Data Structures

### DashboardStats
```typescript
interface DashboardStats {
  totalAssets: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
  incomeTrend: number;    // Percentage change vs last month
  expenseTrend: number;   // Percentage change vs last month
}
```

### CategoryBreakdown
```typescript
interface CategoryBreakdown {
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  total: number;
  percentage: number;
}
```

## User Interactions
- View financial KPIs at a glance
- See expense trends (up/down/neutral indicators)
- Browse category spending with visual progress bars
- Review recent transaction history

## Related Pages
- [Overview](./overview.md) - Detailed monthly breakdown
- [Expenses](./expenses.md) - Full expense management
- [Analytics](./analytics.md) - Charts and trends
