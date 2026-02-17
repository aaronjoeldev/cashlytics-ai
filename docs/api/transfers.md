# Transfers API

This document covers transfer-related server actions for moving money between accounts.

## File

**Path**: `src/actions/transfer-actions.ts`  
**Type**: Server Action

---

## Overview

Transfers represent movement of funds between two accounts within the system. They support one-time and recurring transfer patterns. For one-time transfers, account balances are automatically updated.

### Functions

#### getTransfers

Retrieves transfers with optional filtering.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filters.sourceAccountId` | `string` | No | Filter by source account |
| `filters.targetAccountId` | `string` | No | Filter by target account |
| `filters.startDate` | `Date` | No | Filter transfers starting from |
| `filters.endDate` | `Date` | No | Filter transfers ending before |

**Returns**: `ApiResponse<TransferWithDetails[]>`

```typescript
type TransferWithDetails = Transfer & {
  sourceAccount: Account | null;
  targetAccount: Account | null;
};
```

**Example Usage**:
```typescript
const result = await getTransfers({ 
  sourceAccountId: 'checking-acc' 
});

if (result.success) {
  result.data.forEach(transfer => {
    console.log(`${transfer.sourceAccount?.name} → ${transfer.targetAccount?.name}: ${transfer.amount}€`);
  });
}
```

**Error Handling**: Returns `{ success: false, error: 'Transfers konnten nicht geladen werden' }`

---

#### createTransfer

Creates a new transfer between accounts.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data.sourceAccountId` | `string` | Yes | Account to transfer from |
| `data.targetAccountId` | `string` | Yes | Account to transfer to |
| `data.amount` | `string \| number` | Yes | Transfer amount |
| `data.description` | `string \| null` | No | Transfer description |
| `data.recurrenceType` | `TransferRecurrenceType` | Yes | Recurrence pattern |
| `data.recurrenceInterval` | `number \| null` | No | Custom interval |
| `data.startDate` | `Date \| string` | Yes | When transfer starts |
| `data.endDate` | `Date \| string \| null` | No | When transfer ends |

**Transfer Recurrence Types**:
```typescript
type TransferRecurrenceType = 'once' | 'monthly' | 'quarterly' | 'yearly';
```

**Returns**: `ApiResponse<Transfer>`

**Side Effects**:
- For `recurrenceType: 'once'`: Immediately updates both account balances
  - Subtracts amount from source account
  - Adds amount to target account

**Example Usage**:
```typescript
// One-time transfer
const result = await createTransfer({
  sourceAccountId: 'checking-acc',
  targetAccountId: 'savings-acc',
  amount: 500,
  description: 'Monthly savings',
  recurrenceType: 'once',
  startDate: new Date()
});

// Recurring transfer
const recurring = await createTransfer({
  sourceAccountId: 'checking-acc',
  targetAccountId: 'savings-acc',
  amount: 200,
  description: 'Monthly savings transfer',
  recurrenceType: 'monthly',
  startDate: new Date('2024-01-01')
});
```

**Error Handling**: 
- Returns `{ success: false, error: 'Quell- und Zielkonto müssen unterschiedlich sein' }` if source equals target
- Returns `{ success: false, error: 'Transfer konnte nicht erstellt werden' }` on other errors

---

#### updateTransfer

Updates an existing transfer.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Transfer ID to update |
| `data` | `Partial<NewTransfer>` | Yes | Fields to update |

**Returns**: `ApiResponse<Transfer>`

**Validation**: Prevents setting source and target to the same account.

**Example Usage**:
```typescript
const result = await updateTransfer('transfer-uuid', {
  amount: 250,
  description: 'Increased savings transfer'
});
```

**Error Handling**: 
- Returns `{ success: false, error: 'Quell- und Zielkonto müssen unterschiedlich sein' }` if accounts match
- Returns `{ success: false, error: 'Transfer nicht gefunden' }` if not found

---

#### deleteTransfer

Deletes a transfer.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Transfer ID to delete |

**Returns**: `ApiResponse<void>`

**Side Effects**:
- For `recurrenceType: 'once'` transfers: Reverts account balances
  - Adds amount back to source account
  - Subtracts amount from target account

**Example Usage**:
```typescript
const result = await deleteTransfer('transfer-uuid');
```

**Error Handling**: Returns `{ success: false, error: 'Transfer konnte nicht gelöscht werden' }`

---

## Type Definitions

```typescript
// From types/database.ts
type Transfer = {
  id: string;
  sourceAccountId: string;
  targetAccountId: string;
  amount: string;
  description: string | null;
  recurrenceType: 'once' | 'monthly' | 'quarterly' | 'yearly';
  recurrenceInterval: number | null;
  startDate: Date;
  endDate: Date | null;
  createdAt: Date;
};

type NewTransfer = {
  sourceAccountId: string;
  targetAccountId: string;
  amount: string | number;
  description?: string | null;
  recurrenceType: 'once' | 'monthly' | 'quarterly' | 'yearly';
  recurrenceInterval?: number | null;
  startDate: Date | string;
  endDate?: Date | string | null;
};

type TransferWithDetails = Transfer & {
  sourceAccount: Account | null;
  targetAccount: Account | null;
};
```

## Revalidation

Transfer mutations trigger cache revalidation for:
- `/transfers`
- `/dashboard`
- `/accounts`

## Common Use Cases

### Setting Up Automatic Savings

```typescript
// Monthly transfer from checking to savings
await createTransfer({
  sourceAccountId: 'checking-acc',
  targetAccountId: 'savings-acc',
  amount: 500,
  description: 'Monthly savings',
  recurrenceType: 'monthly',
  startDate: new Date('2024-01-01')
});
```

### Quarterly Investment Transfer

```typescript
// Quarterly transfer to ETF account
await createTransfer({
  sourceAccountId: 'checking-acc',
  targetAccountId: 'etf-acc',
  amount: 1500,
  description: 'Quarterly investment',
  recurrenceType: 'quarterly',
  startDate: new Date('2024-01-01')
});
```
