# Incomes API

This document covers all income-related server actions.

## Files

| File | Purpose |
|------|---------|
| `src/actions/incomes-actions.ts` | Primary income CRUD operations |
| `src/actions/income-actions.ts` | Alternative income actions with account balance updates |

---

## Primary Income Actions (incomes-actions.ts)

**Path**: `src/actions/incomes-actions.ts`  
**Type**: Server Action

### Overview

Manages recurring income sources such as salary, freelance income, and passive income. Supports once, monthly, and yearly recurrence patterns.

### Functions

#### getIncomes

Retrieves all incomes with optional filtering.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filters.accountId` | `string` | No | Filter by account ID |
| `filters.startDate` | `Date` | No | Filter incomes starting from this date |
| `filters.endDate` | `Date` | No | Filter incomes ending before this date |

**Returns**: `ApiResponse<IncomeWithAccount[]>`

```typescript
type IncomeWithAccount = Income & {
  account: Account | null;
};
```

**Example Usage**:
```typescript
const result = await getIncomes({ accountId: 'acc-123' });

if (result.success) {
  result.data.forEach(income => {
    console.log(`${income.source}: ${income.amount}€ (${income.recurrenceType})`);
  });
}
```

**Error Handling**: Returns `{ success: false, error: 'Einnahmen konnten nicht geladen werden.' }`

---

#### getIncomeById

Retrieves a single income by ID.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Income ID |

**Returns**: `ApiResponse<IncomeWithAccount>`

**Example Usage**:
```typescript
const result = await getIncomeById('income-uuid');
if (result.success) {
  console.log(result.data.source, result.data.amount);
}
```

**Error Handling**: Returns `{ success: false, error: 'Einnahme nicht gefunden.' }` if not found.

---

#### createIncome

Creates a new income source.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data.accountId` | `string` | Yes | Account to receive income |
| `data.source` | `string` | Yes | Income source name |
| `data.amount` | `number` | Yes | Income amount |
| `data.recurrenceType` | `IncomeRecurrenceType` | Yes | Recurrence pattern |
| `data.startDate` | `Date \| string` | Yes | When income starts |

**Income Recurrence Types**:
```typescript
type IncomeRecurrenceType = 'once' | 'monthly' | 'yearly';
```

**Returns**: `ApiResponse<Income>`

**Example Usage**:
```typescript
const result = await createIncome({
  accountId: 'acc-123',
  source: 'Monthly Salary',
  amount: 3500,
  recurrenceType: 'monthly',
  startDate: new Date('2024-01-01')
});
```

**Error Handling**: Returns `{ success: false, error: 'Einnahme konnte nicht erstellt werden.' }`

---

#### updateIncome

Updates an existing income.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Income ID to update |
| `data` | `Partial<Omit<NewIncome, 'id' \| 'createdAt'>>` | Yes | Fields to update |

**Returns**: `ApiResponse<Income>`

**Example Usage**:
```typescript
const result = await updateIncome('income-uuid', {
  amount: 3700,
  source: 'Monthly Salary (with raise)'
});
```

**Error Handling**: Returns `{ success: false, error: 'Einnahme nicht gefunden.' }` if not found.

---

#### deleteIncome

Deletes an income source.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Income ID to delete |

**Returns**: `ApiResponse<void>`

**Example Usage**:
```typescript
const result = await deleteIncome('income-uuid');
```

**Error Handling**: Returns `{ success: false, error: 'Einnahme konnte nicht gelöscht werden.' }`

---

## Alternative Income Actions (income-actions.ts)

**Path**: `src/actions/income-actions.ts`  
**Type**: Server Action

### Overview

Alternative income actions that automatically update account balances:
- **createIncome**: Adds amount to account balance
- **deleteIncome**: Subtracts amount from account balance

### Functions

The functions mirror `incomes-actions.ts` with the same signatures but include automatic account balance adjustments.

#### createIncome (with balance update)

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data.accountId` | `string` | Yes | Account to receive income |
| `data.source` | `string` | Yes | Income source name |
| `data.amount` | `number` | Yes | Income amount |
| `data.recurrenceType` | `IncomeRecurrenceType` | Yes | Recurrence pattern |
| `data.startDate` | `Date \| string` | Yes | When income starts |

**Returns**: `ApiResponse<Income>`

**Side Effect**: Updates the associated account's balance by adding the income amount.

---

#### deleteIncome (with balance revert)

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Income ID to delete |

**Returns**: `ApiResponse<void>`

**Side Effect**: Reverts the associated account's balance by subtracting the income amount.

---

## Type Definitions

```typescript
// From types/database.ts
type Income = {
  id: string;
  accountId: string | null;
  source: string;
  amount: string;
  recurrenceType: 'once' | 'monthly' | 'yearly';
  startDate: Date;
  endDate: Date | null;
  createdAt: Date;
};

type IncomeWithAccount = Income & {
  account: Account | null;
};

type NewIncome = {
  accountId?: string | null;
  source: string;
  amount: string | number;
  recurrenceType: 'once' | 'monthly' | 'yearly';
  startDate: Date | string;
  endDate?: Date | string | null;
};
```

## Usage Recommendations

| Use Case | Recommended Module |
|----------|-------------------|
| UI list views (no balance updates needed) | `incomes-actions.ts` |
| Creating/deleting income with balance sync | `income-actions.ts` |
| Integration with other financial calculations | `incomes-actions.ts` |
