# Forecast API

This document covers forecast-related server actions for account balance projections.

## File

**Path**: `src/actions/forecast-actions.ts`  
**Type**: Server Action

---

## Overview

Provides detailed financial forecasting for individual accounts, projecting balances based on scheduled incomes, expenses, and transfers. Supports different account types (checking, savings, ETF) with appropriate cumulative calculations.

### Functions

#### getAccountForecast

Generates a detailed month-by-month forecast for a specific account.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `accountId` | `string` | Yes | Account ID to forecast |
| `months` | `number` | Yes | Number of months to project |

**Returns**: `ApiResponse<AccountForecast>`

```typescript
type AccountForecast = {
  account: Account;
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
    balance: number;           // Net monthly balance
    cumulativeBalance: number;  // Running total
  }>;
};
```

**Example Usage**:
```typescript
const result = await getAccountForecast('checking-acc', 12);

if (result.success) {
  const { account, currentBalance, projectedMonths } = result.data;
  console.log(`Account: ${account.name}`);
  console.log(`Current Balance: ${currentBalance}€`);
  
  projectedMonths.forEach(month => {
    console.log(`${month.monthName} ${month.year}:`);
    console.log(`  Income: ${month.income}€`);
    console.log(`  Expenses: ${month.expenses}€`);
    console.log(`  Net: ${month.balance}€`);
    console.log(`  Cumulative: ${month.cumulativeBalance}€`);
  });
}
```

**Error Handling**: 
- Returns `{ success: false, error: 'Konto nicht gefunden.' }` if account doesn't exist
- Returns `{ success: false, error: 'Prognose konnte nicht erstellt werden.' }` on calculation error

---

## Account Type Behavior

The forecast behaves differently based on account type:

### Checking Accounts (Girokonto)
- `isCumulativeAccount: false`
- `cumulativeBalance` shows only the net monthly balance (not a running total)
- Useful for seeing monthly cash flow

### Savings & ETF Accounts
- `isCumulativeAccount: true`
- `cumulativeBalance` starts with current balance and accumulates
- Shows projected growth over time

---

## Calculation Functions

### calculateIncomeForMonth

Calculates income amount for a specific month based on recurrence.

| Recurrence Type | Behavior |
|-----------------|----------|
| `once` | Only applies in the month of startDate |
| `monthly` | Applies every month |
| `yearly` | Applies in the same month as startDate |

### calculateExpenseForMonth

Calculates expense amount for a specific month based on recurrence.

| Recurrence Type | Formula |
|-----------------|---------|
| `once` | Only in startDate month |
| `daily` | amount × days in month |
| `weekly` | amount × (days in month ÷ 7) |
| `monthly` | amount |
| `quarterly` | amount (every 3rd month from startDate) |
| `yearly` | amount (in anniversary month) |
| `custom` | amount (every N months based on interval) |

### calculateTransferForMonth

Calculates transfer amount for a specific month based on recurrence.

| Recurrence Type | Behavior |
|-----------------|----------|
| `once` | Only in startDate month |
| `monthly` | Applies every month |
| `quarterly` | Every 3rd month from startDate |
| `yearly` | In anniversary month |

---

## Type Definitions

```typescript
type AccountForecast = {
  account: Account;
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
};

// Internal helper types
type MonthProjection = {
  month: number;
  year: number;
  monthName: string;
  income: number;
  expenses: number;
  transfersIn: number;
  transfersOut: number;
  balance: number;
  cumulativeBalance: number;
};
```

## Month Names

German month names are used for display:

```typescript
const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];
```

## Usage Patterns

### 12-Month Financial Projection

```typescript
const result = await getAccountForecast('main-checking', 12);

if (result.success) {
  const forecast = result.data;
  
  // Find months with negative balance
  const deficitMonths = forecast.projectedMonths.filter(m => m.cumulativeBalance < 0);
  
  if (deficitMonths.length > 0) {
    console.warn('Warning: Potential overdraft in these months:');
    deficitMonths.forEach(m => console.log(`  ${m.monthName} ${m.year}`));
  }
  
  // Calculate total annual savings
  const annualNet = forecast.projectedMonths.reduce((sum, m) => sum + m.balance, 0);
  console.log(`Projected annual net: ${annualNet}€`);
}
```

### Compare Multiple Accounts

```typescript
const accounts = ['checking', 'savings', 'etf'];
const forecasts = await Promise.all(
  accounts.map(id => getAccountForecast(id, 6))
);

forecasts.forEach(result => {
  if (result.success) {
    const { account, projectedMonths } = result.data;
    const finalBalance = projectedMonths[projectedMonths.length - 1].cumulativeBalance;
    console.log(`${account.name}: ${finalBalance}€`);
  }
});
```
