# Analytics API

This document covers analytics-related server actions for financial reporting and insights.

## File

**Path**: `src/actions/analytics-actions.ts`  
**Type**: Server Action

---

## Overview

Provides comprehensive financial analytics including monthly overviews, forecasts, category breakdowns, and chart-specific data for visualizations.

### Core Functions

#### getMonthlyOverview

Calculates financial summary for a specific month.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `month` | `number` | Yes | Month (1-12) |
| `year` | `number` | Yes | Year (e.g., 2024) |

**Returns**: `ApiResponse<MonthlyOverview>`

```typescript
type MonthlyOverview = {
  month: number;
  year: number;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  expenses: ExpenseWithDetails[];
  incomes: IncomeWithAccount[];
};
```

**Example Usage**:
```typescript
const result = await getMonthlyOverview(1, 2024); // January 2024

if (result.success) {
  const { totalIncome, totalExpenses, balance } = result.data;
  console.log(`Income: ${totalIncome}€, Expenses: ${totalExpenses}€, Balance: ${balance}€`);
}
```

**Error Handling**: Returns `{ success: false, error: 'Monatsübersicht konnte nicht geladen werden.' }`

---

#### getForecast

Projects financial data over multiple future months.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `months` | `number` | Yes | Number of months to forecast |

**Returns**: `ApiResponse<Forecast>`

```typescript
type Forecast = {
  months: number;
  projectedIncome: number;
  projectedExpenses: number;
  projectedBalance: number;
  monthlyDetails: Array<{
    month: number;
    year: number;
    income: number;
    expenses: number;
    balance: number;
  }>;
};
```

**Example Usage**:
```typescript
const result = await getForecast(6); // Next 6 months

if (result.success) {
  console.log(`Projected balance over ${result.data.months} months: ${result.data.projectedBalance}€`);
  result.data.monthlyDetails.forEach(m => {
    console.log(`${m.month}/${m.year}: Income ${m.income}€, Expenses ${m.expenses}€`);
  });
}
```

**Error Handling**: Returns `{ success: false, error: 'Prognose konnte nicht erstellt werden.' }`

---

#### getCategoryBreakdown

Analyzes spending by category for a date range.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | `Date` | Yes | Start of date range |
| `endDate` | `Date` | Yes | End of date range |

**Returns**: `ApiResponse<CategoryBreakdown[]>`

```typescript
type CategoryBreakdown = {
  category: Category;
  amount: number;
  percentage: number;
};
```

**Example Usage**:
```typescript
const start = new Date('2024-01-01');
const end = new Date('2024-01-31');
const result = await getCategoryBreakdown(start, end);

if (result.success) {
  result.data.forEach(item => {
    console.log(`${item.category.name}: ${item.amount}€ (${item.percentage.toFixed(1)}%)`);
  });
}
```

**Error Handling**: Returns `{ success: false, error: 'Kategorie-Übersicht konnte nicht geladen werden.' }`

---

#### getNormalizedMonthlyExpenses

Returns all expenses normalized to monthly amounts.

**Parameters**: None

**Returns**: `ApiResponse<Array<{ expense: ExpenseWithDetails; monthlyAmount: number }>>`

**Example Usage**:
```typescript
const result = await getNormalizedMonthlyExpenses();

if (result.success) {
  const totalMonthly = result.data.reduce((sum, item) => sum + item.monthlyAmount, 0);
  console.log(`Total monthly expenses: ${totalMonthly}€`);
}
```

---

### Chart-Specific Functions

#### getMonthlyTrend

Returns income, expenses, and savings trend over several months.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `months` | `number` | No | Number of months (default: 6) |

**Returns**: `ApiResponse<MonthlyTrendEntry[]>`

```typescript
interface MonthlyTrendEntry {
  month: string;      // "Jan", "Feb", etc.
  income: number;
  expenses: number;
  savings: number;
}
```

**Example Usage**:
```typescript
const result = await getMonthlyTrend(6);

if (result.success) {
  result.data.forEach(entry => {
    console.log(`${entry.month}: Savings ${entry.savings}€`);
  });
}
```

---

#### getExpensesByCategory

Returns expense totals grouped by category for a specific month.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `year` | `number` | No | Year (defaults to current year) |
| `month` | `number` | No | Month (defaults to current month) |

**Returns**: `ApiResponse<CategoryExpense[]>`

```typescript
interface CategoryExpense {
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string | null;
  total: number;
  percentage: number;
}
```

**Example Usage**:
```typescript
const result = await getExpensesByCategory(2024, 0); // January 2024

if (result.success) {
  result.data.forEach(cat => {
    console.log(`${cat.categoryIcon} ${cat.categoryName}: ${cat.total}€ (${cat.percentage}%)`);
  });
}
```

---

#### getIncomeVsExpensesByMonth

Returns year-long comparison of income vs expenses by month.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `year` | `number` | No | Year (defaults to current year) |

**Returns**: `ApiResponse<IncomeVsExpensesEntry[]>`

```typescript
interface IncomeVsExpensesEntry {
  month: string;      // "Jan", "Feb", etc.
  income: number;
  expenses: number;
}
```

**Example Usage**:
```typescript
const result = await getIncomeVsExpensesByMonth(2024);

if (result.success) {
  result.data.forEach(entry => {
    const net = entry.income - entry.expenses;
    console.log(`${entry.month}: Net ${net}€`);
  });
}
```

---

#### getSavingsProgress

Returns current month's savings metrics.

**Parameters**: None

**Returns**: `ApiResponse<SavingsProgress>`

```typescript
interface SavingsProgress {
  totalIncome: number;
  totalExpenses: number;
  savingsAmount: number;
  savingsRate: number;  // Percentage (0-100)
}
```

**Example Usage**:
```typescript
const result = await getSavingsProgress();

if (result.success) {
  const { savingsRate, savingsAmount } = result.data;
  console.log(`Savings rate: ${savingsRate}% (${savingsAmount}€)`);
}
```

---

## Helper Functions

### normalizeToMonthly

Internal helper that converts amounts based on recurrence type to monthly equivalent.

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

---

## Type Definitions

```typescript
interface MonthlyTrendEntry {
  month: string;
  income: number;
  expenses: number;
  savings: number;
}

interface CategoryExpense {
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string | null;
  total: number;
  percentage: number;
}

interface IncomeVsExpensesEntry {
  month: string;
  income: number;
  expenses: number;
}

interface SavingsProgress {
  totalIncome: number;
  totalExpenses: number;
  savingsAmount: number;
  savingsRate: number;
}
```
