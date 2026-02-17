# Expenses API

This document covers all expense-related server actions including periodic expenses and daily expenses.

## Files

| File | Purpose |
|------|---------|
| `src/actions/expenses-actions.ts` | Periodic expense CRUD operations |
| `src/actions/expense-actions.ts` | Alternative expense actions with account balance updates |
| `src/actions/daily-expenses-actions.ts` | Daily/one-time expense CRUD operations |

---

## Periodic Expenses (expenses-actions.ts)

**Path**: `src/actions/expenses-actions.ts`  
**Type**: Server Action

### Overview

Manages recurring/periodic expenses such as rent, subscriptions, and insurance. These expenses have recurrence patterns (daily, weekly, monthly, quarterly, yearly, or custom intervals).

### Functions

#### getExpenses

Retrieves periodic expenses with optional filtering.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filters.accountId` | `string` | No | Filter by account ID |
| `filters.categoryId` | `string` | No | Filter by category ID |
| `filters.startDate` | `Date` | No | Filter expenses starting from this date |
| `filters.endDate` | `Date` | No | Filter expenses ending before this date |

**Returns**: `ApiResponse<ExpenseWithDetails[]>`

```typescript
type ExpenseWithDetails = Expense & {
  category: Category | null;
  account: Account | null;
};
```

**Example Usage**:
```typescript
const result = await getExpenses({ 
  accountId: 'acc-123',
  startDate: new Date('2024-01-01')
});

if (result.success) {
  result.data.forEach(expense => {
    console.log(`${expense.name}: ${expense.amount}€`);
  });
}
```

**Error Handling**: Returns `{ success: false, error: 'Ausgaben konnten nicht geladen werden.' }`

---

#### getExpenseById

Retrieves a single periodic expense by ID.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Expense ID |

**Returns**: `ApiResponse<ExpenseWithDetails>`

**Example Usage**:
```typescript
const result = await getExpenseById('expense-uuid');
if (result.success) {
  console.log(result.data.name, result.data.amount);
}
```

**Error Handling**: Returns `{ success: false, error: 'Ausgabe nicht gefunden.' }` if not found.

---

#### createExpense

Creates a new periodic expense.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data.accountId` | `string` | Yes | Account to charge expense to |
| `data.categoryId` | `string \| null` | No | Category ID |
| `data.name` | `string` | Yes | Expense name/description |
| `data.amount` | `number` | Yes | Expense amount |
| `data.recurrenceType` | `RecurrenceType` | Yes | Recurrence pattern |
| `data.recurrenceInterval` | `number \| null` | No | Custom interval (for 'custom' type) |
| `data.startDate` | `Date \| string` | Yes | When expense starts |
| `data.endDate` | `Date \| string \| null` | No | When expense ends |

**Recurrence Types**:
```typescript
type RecurrenceType = 'once' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
```

**Returns**: `ApiResponse<Expense>`

**Example Usage**:
```typescript
const result = await createExpense({
  accountId: 'acc-123',
  categoryId: 'cat-456',
  name: 'Netflix Subscription',
  amount: 15.99,
  recurrenceType: 'monthly',
  startDate: new Date('2024-01-01')
});
```

**Error Handling**: Returns `{ success: false, error: 'Ausgabe konnte nicht erstellt werden.' }`

---

#### updateExpense

Updates an existing periodic expense.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Expense ID to update |
| `data` | `Partial<NewExpense>` | Yes | Fields to update |

**Returns**: `ApiResponse<Expense>`

**Example Usage**:
```typescript
const result = await updateExpense('expense-uuid', {
  amount: 17.99,
  name: 'Netflix Premium'
});
```

**Error Handling**: Returns `{ success: false, error: 'Ausgabe nicht gefunden.' }` if not found.

---

#### deleteExpense

Deletes a periodic expense.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Expense ID to delete |

**Returns**: `ApiResponse<void>`

**Example Usage**:
```typescript
const result = await deleteExpense('expense-uuid');
```

**Error Handling**: Returns `{ success: false, error: 'Ausgabe konnte nicht gelöscht werden.' }`

---

## Alternative Expense Actions (expense-actions.ts)

**Path**: `src/actions/expense-actions.ts`  
**Type**: Server Action

### Overview

Alternative expense actions that automatically update account balances on create/delete operations.

### Key Difference

This module updates account balances when creating expenses (subtracts amount) and when deleting expenses (adds amount back).

### Additional Functions

#### getDailyExpenses

Retrieves daily expenses with optional filtering.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filters.accountId` | `string` | No | Filter by account ID |
| `filters.categoryId` | `string` | No | Filter by category ID |
| `filters.description` | `string` | No | Filter by description (case-insensitive) |
| `filters.startDate` | `Date` | No | Filter from this date |
| `filters.endDate` | `Date` | No | Filter until this date |

**Returns**: `ApiResponse<DailyExpenseWithDetails[]>`

---

## Daily Expenses (daily-expenses-actions.ts)

**Path**: `src/actions/daily-expenses-actions.ts`  
**Type**: Server Action

### Overview

Manages one-time daily expenses like groceries, gas, restaurant visits. These are single transactions without recurrence.

### Functions

#### getDailyExpenses

Retrieves daily expenses with optional filtering.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filters.accountId` | `string` | No | Filter by account ID |
| `filters.categoryId` | `string` | No | Filter by category ID |
| `filters.startDate` | `Date` | No | Filter from this date |
| `filters.endDate` | `Date` | No | Filter until this date |

**Returns**: `ApiResponse<DailyExpenseWithDetails[]>`

```typescript
type DailyExpenseWithDetails = DailyExpense & {
  category: Category | null;
  account: Account | null;
};
```

**Example Usage**:
```typescript
const result = await getDailyExpenses({
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31')
});
```

---

#### getDailyExpenseById

Retrieves a single daily expense by ID.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Daily expense ID |

**Returns**: `ApiResponse<DailyExpenseWithDetails>`

---

#### createDailyExpense

Creates a new daily expense.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data.accountId` | `string` | Yes | Account to charge |
| `data.categoryId` | `string \| null` | No | Category ID |
| `data.description` | `string` | Yes | Expense description |
| `data.amount` | `number` | Yes | Expense amount |
| `data.date` | `Date \| string` | Yes | Transaction date |

**Returns**: `ApiResponse<DailyExpense>`

**Example Usage**:
```typescript
const result = await createDailyExpense({
  accountId: 'acc-123',
  categoryId: 'cat-groceries',
  description: 'Weekly groceries',
  amount: 85.50,
  date: new Date()
});
```

---

#### updateDailyExpense

Updates an existing daily expense.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Daily expense ID |
| `data` | `Partial<NewDailyExpense>` | Yes | Fields to update |

**Returns**: `ApiResponse<DailyExpense>`

---

#### deleteDailyExpense

Deletes a daily expense.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Daily expense ID |

**Returns**: `ApiResponse<void>`

---

## Type Definitions

```typescript
// From types/database.ts
type Expense = {
  id: string;
  accountId: string | null;
  categoryId: string | null;
  name: string;
  amount: string;
  recurrenceType: string;
  recurrenceInterval: number | null;
  startDate: Date;
  endDate: Date | null;
  createdAt: Date;
};

type DailyExpense = {
  id: string;
  accountId: string | null;
  categoryId: string | null;
  description: string;
  amount: string;
  date: Date;
  createdAt: Date;
};
```
