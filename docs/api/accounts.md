# Accounts API

This document covers all account-related server actions including CRUD operations and detailed transaction views.

## Files

| File | Purpose |
|------|---------|
| `src/actions/accounts-actions.ts` | Primary account CRUD operations |
| `src/actions/account-actions.ts` | Basic account CRUD (legacy/simple) |
| `src/actions/account-detail-actions.ts` | Account transaction details and summaries |

---

## Primary Account Actions (accounts-actions.ts)

**Path**: `src/actions/accounts-actions.ts`  
**Type**: Server Action

### Overview

Manages financial accounts (checking, savings, ETF). Supports creation with initial balance and provides account-by-ID retrieval.

### Functions

#### getAccounts

Retrieves all accounts sorted by creation date (newest first).

**Parameters**: None

**Returns**: `ApiResponse<Account[]>`

```typescript
type Account = {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'etf';
  balance: string;
  currency: string;
  createdAt: Date;
};
```

**Example Usage**:
```typescript
const result = await getAccounts();

if (result.success) {
  result.data.forEach(account => {
    console.log(`${account.name} (${account.type}): ${account.balance} ${account.currency}`);
  });
}
```

**Error Handling**: Returns `{ success: false, error: 'Konten konnten nicht geladen werden.' }`

---

#### getAccountById

Retrieves a single account by ID.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Account ID |

**Returns**: `ApiResponse<Account>`

**Example Usage**:
```typescript
const result = await getAccountById('acc-123');
if (result.success) {
  console.log(`Balance: ${result.data.balance}`);
}
```

**Error Handling**: Returns `{ success: false, error: 'Konto nicht gefunden.' }` if not found.

---

#### createAccount

Creates a new account.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data.name` | `string` | Yes | Account name |
| `data.type` | `AccountType` | Yes | Account type |
| `data.initialBalance` | `number` | No | Initial balance (default: 0) |

**Account Types**:
```typescript
type AccountType = 'checking' | 'savings' | 'etf';
```

**Returns**: `ApiResponse<Account>`

**Example Usage**:
```typescript
const result = await createAccount({
  name: 'Main Checking',
  type: 'checking',
  initialBalance: 1000
});
```

**Error Handling**: Returns `{ success: false, error: 'Konto konnte nicht erstellt werden.' }`

---

#### updateAccount

Updates an existing account.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Account ID to update |
| `data` | `Partial<Omit<NewAccount, 'id' \| 'createdAt'>>` | Yes | Fields to update |

**Returns**: `ApiResponse<Account>`

**Example Usage**:
```typescript
const result = await updateAccount('acc-123', {
  name: 'Primary Checking',
  balance: '2500.00'
});
```

**Error Handling**: Returns `{ success: false, error: 'Konto konnte nicht aktualisiert werden.' }`

---

#### deleteAccount

Deletes an account.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Account ID to delete |

**Returns**: `ApiResponse<void>`

**Example Usage**:
```typescript
const result = await deleteAccount('acc-123');
```

**Error Handling**: Returns `{ success: false, error: 'Konto konnte nicht gelöscht werden.' }`

---

## Basic Account Actions (account-actions.ts)

**Path**: `src/actions/account-actions.ts`  
**Type**: Server Action

### Overview

Simpler version of account CRUD operations. Returns accounts sorted by name instead of creation date.

### Functions

Same as `accounts-actions.ts` but:
- `getAccounts()` sorts by name (alphabetical)
- `createAccount()` accepts full `NewAccount` type
- No `getAccountById()` function

---

## Account Detail Actions (account-detail-actions.ts)

**Path**: `src/actions/account-detail-actions.ts`  
**Type**: Server Action

### Overview

Provides detailed transaction information for a specific account, including incomes, expenses, daily expenses, and summary statistics.

### Functions

#### getAccountTransactions

Retrieves all transactions for an account with optional month filtering.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `accountId` | `string` | Yes | Account ID |
| `month` | `number` | No | Filter by month (1-12) |
| `year` | `number` | No | Filter by year |

**Returns**: `ApiResponse<AccountDetail>`

```typescript
type AccountDetail = {
  account: Account;
  incomes: IncomeWithAccount[];
  expenses: ExpenseWithDetails[];
  dailyExpenses: DailyExpenseWithDetails[];
  summary: {
    totalIncome: number;
    totalExpenses: number;
    totalDailyExpenses: number;
    balance: number;  // income - expenses - dailyExpenses
  };
};
```

**Example Usage**:
```typescript
// Get all transactions for account
const result = await getAccountTransactions('acc-123');

// Get transactions for specific month
const result = await getAccountTransactions('acc-123', 1, 2024); // January 2024

if (result.success) {
  const { account, summary, incomes, expenses, dailyExpenses } = result.data;
  console.log(`Account: ${account.name}`);
  console.log(`Net Balance: ${summary.balance}€`);
  console.log(`Total Income: ${summary.totalIncome}€`);
  console.log(`Total Expenses: ${summary.totalExpenses}€`);
}
```

**Error Handling**: 
- Returns `{ success: false, error: 'Konto nicht gefunden.' }` if account doesn't exist
- Returns `{ success: false, error: 'Transaktionen konnten nicht geladen werden.' }` on query error

---

## Type Definitions

```typescript
// From types/database.ts
type Account = {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'etf';
  balance: string;
  currency: string;
  createdAt: Date;
};

type NewAccount = {
  name: string;
  type: 'checking' | 'savings' | 'etf';
  balance?: string;
  currency?: string;
};

type AccountDetail = {
  account: Account;
  incomes: IncomeWithAccount[];
  expenses: ExpenseWithDetails[];
  dailyExpenses: DailyExpenseWithDetails[];
  summary: AccountDetailSummary;
};

type AccountDetailSummary = {
  totalIncome: number;
  totalExpenses: number;
  totalDailyExpenses: number;
  balance: number;
};
```

## Account Types

| Type | Description | German Name |
|------|-------------|-------------|
| `checking` | Daily transaction account | Girokonto |
| `savings` | Savings account | Sparkonto |
| `etf` | ETF/Investment account | ETF-Konto |

## Revalidation

All account mutations trigger cache revalidation for:
- `/accounts`
- `/dashboard`
