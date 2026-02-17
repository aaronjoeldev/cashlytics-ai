# Dashboard API

This document covers dashboard-related server actions for main dashboard statistics and widgets.

## File

**Path**: `src/actions/dashboard-actions.ts`  
**Type**: Server Action

---

## Overview

Provides dashboard-specific data including overall financial statistics, category breakdowns, and recent transactions. Optimized for dashboard display performance.

### Functions

#### getDashboardStats

Returns key financial metrics for the dashboard overview.

**Parameters**: None

**Returns**: `ApiResponse<DashboardStats>`

```typescript
interface DashboardStats {
  totalAssets: number;      // Sum of all account balances
  monthlyIncome: number;    // Current month's total income
  monthlyExpenses: number;  // Current month's total expenses
  savingsRate: number;      // Income - expenses (absolute amount)
  incomeTrend: number;      // Income change percentage (currently 0)
  expenseTrend: number;     // Expense change vs last month (negative = good)
}
```

**Example Usage**:
```typescript
const result = await getDashboardStats();

if (result.success) {
  const { totalAssets, monthlyIncome, monthlyExpenses, savingsRate } = result.data;
  console.log(`Total Assets: ${totalAssets}€`);
  console.log(`Monthly Savings: ${savingsRate}€`);
}
```

**Error Handling**: Returns `{ success: false, error: 'Failed to fetch dashboard stats' }`

**Calculation Details**:
- `totalAssets`: Sum of all account balances
- `monthlyIncome`: Recurring monthly income + one-time income this month
- `monthlyExpenses`: Daily expenses this month + normalized periodic expenses
- `expenseTrend`: Percentage change from last month (negative means spending decreased)

---

#### getCategoryBreakdown

Returns expense breakdown by category for the dashboard pie chart.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | `Date` | No | Start date (defaults to current month start) |

**Returns**: `ApiResponse<CategoryBreakdown[]>`

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

**Example Usage**:
```typescript
// Current month breakdown
const result = await getCategoryBreakdown();

// Custom date range
const result = await getCategoryBreakdown(new Date('2024-01-01'));

if (result.success) {
  result.data.forEach(cat => {
    console.log(`${cat.categoryIcon} ${cat.categoryName}: ${cat.total}€`);
  });
}
```

**Error Handling**: Returns `{ success: false, error: 'Failed to fetch category breakdown' }`

---

#### getRecentTransactions

Returns the most recent daily expenses for the dashboard activity feed.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | `number` | No | Number of transactions (default: 5) |

**Returns**: `ApiResponse<DailyExpenseWithDetails[]>`

```typescript
type DailyExpenseWithDetails = DailyExpense & {
  category: Category | null;
  account: Account | null;
};
```

**Example Usage**:
```typescript
const result = await getRecentTransactions(10);

if (result.success) {
  result.data.forEach(tx => {
    console.log(`${tx.description}: ${tx.amount}€ (${tx.account?.name})`);
  });
}
```

**Error Handling**: Returns `{ success: false, error: 'Failed to fetch recent transactions' }`

---

#### getAccounts

Returns all accounts for the dashboard accounts widget.

**Parameters**: None

**Returns**: `ApiResponse<Account[]>`

**Example Usage**:
```typescript
const result = await getAccounts();

if (result.success) {
  result.data.forEach(account => {
    console.log(`${account.name}: ${account.balance} ${account.currency}`);
  });
}
```

**Error Handling**: Returns `{ success: false, error: 'Failed to fetch accounts' }`

---

## Helper Functions

### normalizeToMonthly

Internal helper that converts expense amounts to monthly equivalents.

```typescript
function normalizeToMonthly(
  amount: number, 
  recurrenceType: string, 
  recurrenceInterval: number | null
): number
```

**Conversion Logic**:

| Recurrence Type | Formula |
|-----------------|---------|
| `daily` | amount × 30 |
| `weekly` | amount × 4.33 |
| `monthly` | amount |
| `quarterly` | amount ÷ 3 |
| `yearly` | amount ÷ 12 |
| `custom` | amount ÷ interval |
| `once` | 0 |

---

## Type Definitions

```typescript
interface DashboardStats {
  totalAssets: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
  incomeTrend: number;
  expenseTrend: number;
}

interface CategoryBreakdown {
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  total: number;
  percentage: number;
}
```

## Dashboard Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      Dashboard                               │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Stats Card    │  Category Pie   │   Recent Transactions   │
│                 │     Chart       │         List            │
├─────────────────┼─────────────────┼─────────────────────────┤
│getDashboardStats│getCategoryBreakdown│getRecentTransactions │
└─────────────────┴─────────────────┴─────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │      getAccounts       │
              │   (Accounts Widget)    │
              └────────────────────────┘
```

## Usage Example

```typescript
// Parallel data fetching for dashboard
const [stats, categories, transactions, accounts] = await Promise.all([
  getDashboardStats(),
  getCategoryBreakdown(),
  getRecentTransactions(5),
  getAccounts()
]);

if (stats.success && categories.success && transactions.success && accounts.success) {
  // Render dashboard with all data
  renderDashboard({
    stats: stats.data,
    categories: categories.data,
    transactions: transactions.data,
    accounts: accounts.data
  });
}
```
