# Database Schema

## Overview

Cashlytics uses PostgreSQL with Drizzle ORM. The schema supports personal finance management including accounts, transactions, categories, and AI conversations.

## Enums

### `account_type`
| Value | Description |
|-------|-------------|
| `checking` | Girokonto (Checking account) |
| `savings` | Sparkonto (Savings account) |
| `etf` | ETF Portfolio |

### `recurrence_type`
| Value | Description |
|-------|-------------|
| `once` | One-time transaction |
| `daily` | Recurs daily |
| `weekly` | Recurs weekly |
| `monthly` | Recurs monthly |
| `quarterly` | Recurs quarterly |
| `yearly` | Recurs yearly |
| `custom` | Custom interval |

### `income_recurrence_type`
| Value | Description |
|-------|-------------|
| `once` | One-time income |
| `monthly` | Recurs monthly |
| `yearly` | Recurs yearly |

### `transfer_recurrence_type`
| Value | Description |
|-------|-------------|
| `once` | One-time transfer |
| `monthly` | Recurs monthly |
| `quarterly` | Recurs quarterly |
| `yearly` | Recurs yearly |

---

## Tables

### `accounts`

Financial accounts belonging to the user.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` | Unique identifier |
| `name` | `text` | NOT NULL | Account name |
| `type` | `account_type` | NOT NULL | Account type (checking/savings/etf) |
| `balance` | `decimal(12,2)` | NOT NULL, DEFAULT '0' | Current balance |
| `currency` | `text` | NOT NULL, DEFAULT 'EUR' | Currency code |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW() | Creation timestamp |

**Relationships**:
- Has many `expenses`
- Has many `incomes`
- Has many `daily_expenses`
- Has many `transfers` (as source)
- Has many `transfers` (as target)

---

### `categories`

Expense/income categories for organization.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` | Unique identifier |
| `name` | `text` | NOT NULL | Category name |
| `icon` | `text` | NULLABLE | Emoji icon |
| `color` | `text` | NULLABLE | Hex color code |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW() | Creation timestamp |

**Relationships**:
- Has many `expenses`
- Has many `daily_expenses`

**Default Categories**:
- Wohnen (Housing) - 🏠 - #3b82f6
- Lebensmittel (Groceries) - 🍔 - #22c55e
- Transport - 🚗 - #f59e0b
- Abonnements (Subscriptions) - 📱 - #8b5cf6
- Versicherungen (Insurance) - 🛡️ - #ef4444
- Freizeit (Leisure) - 🎮 - #ec4899
- Gesundheit (Health) - 💊 - #14b8a6
- Einkommen (Income) - 💰 - #22c55e

---

### `expenses`

Recurring/periodic expenses.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` | Unique identifier |
| `account_id` | `uuid` | FK → accounts.id, ON DELETE CASCADE | Associated account |
| `category_id` | `uuid` | FK → categories.id | Associated category |
| `name` | `text` | NOT NULL | Expense name/description |
| `amount` | `decimal(12,2)` | NOT NULL | Expense amount |
| `recurrence_type` | `recurrence_type` | NOT NULL | Recurrence pattern |
| `recurrence_interval` | `integer` | NULLABLE | Interval for custom recurrence |
| `start_date` | `timestamp` | NOT NULL | When expense starts |
| `end_date` | `timestamp` | NULLABLE | When expense ends (optional) |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW() | Creation timestamp |

**Relationships**:
- Belongs to `accounts`
- Belongs to `categories` (optional)

---

### `incomes`

Recurring/periodic income sources.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` | Unique identifier |
| `account_id` | `uuid` | FK → accounts.id, ON DELETE CASCADE | Associated account |
| `source` | `text` | NOT NULL | Income source name |
| `amount` | `decimal(12,2)` | NOT NULL | Income amount |
| `recurrence_type` | `income_recurrence_type` | NOT NULL | Recurrence pattern |
| `start_date` | `timestamp` | NOT NULL | When income starts |
| `end_date` | `timestamp` | NULLABLE | When income ends (optional) |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW() | Creation timestamp |

**Relationships**:
- Belongs to `accounts`

---

### `daily_expenses`

One-time/ad-hoc expenses.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` | Unique identifier |
| `account_id` | `uuid` | FK → accounts.id, ON DELETE CASCADE | Associated account |
| `category_id` | `uuid` | FK → categories.id | Associated category |
| `description` | `text` | NOT NULL | Expense description |
| `amount` | `decimal(12,2)` | NOT NULL | Expense amount |
| `date` | `timestamp` | NOT NULL | Date of expense |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW() | Creation timestamp |

**Relationships**:
- Belongs to `accounts`
- Belongs to `categories` (optional)

---

### `transfers`

Account-to-account transfers.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` | Unique identifier |
| `source_account_id` | `uuid` | FK → accounts.id, ON DELETE CASCADE, NOT NULL | Source account |
| `target_account_id` | `uuid` | FK → accounts.id, ON DELETE CASCADE, NOT NULL | Target account |
| `amount` | `decimal(12,2)` | NOT NULL | Transfer amount |
| `description` | `text` | NULLABLE | Transfer description |
| `recurrence_type` | `transfer_recurrence_type` | NOT NULL | Recurrence pattern |
| `start_date` | `timestamp` | NOT NULL | When transfer starts |
| `end_date` | `timestamp` | NULLABLE | When transfer ends (optional) |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW() | Creation timestamp |

**Relationships**:
- Belongs to `accounts` (as source)
- Belongs to `accounts` (as target)

**Constraints**:
- `source_account_id` must differ from `target_account_id`

---

### `conversations`

AI assistant chat conversations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` | Unique identifier |
| `title` | `text` | NOT NULL, DEFAULT 'Neuer Chat' | Conversation title |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | `timestamp` | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Relationships**:
- Has many `messages`

---

### `messages`

Individual messages within conversations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` | Unique identifier |
| `conversation_id` | `uuid` | FK → conversations.id, ON DELETE CASCADE, NOT NULL | Parent conversation |
| `role` | `text` | NOT NULL, ENUM ('user', 'assistant') | Message sender role |
| `content` | `text` | NOT NULL | Message content |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW() | Creation timestamp |

**Relationships**:
- Belongs to `conversations`

---

## Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐
│  accounts   │       │  categories │
└──────┬──────┘       └──────┬──────┘
       │                     │
       │     ┌───────────────┼───────────────┐
       │     │               │               │
       ▼     ▼               ▼               ▼
┌─────────────┐       ┌─────────────┐ ┌─────────────┐
│   expenses  │       │daily_expenses│ │   incomes   │
└─────────────┘       └─────────────┘ └─────────────┘
       │
       ▼
┌─────────────┐
│  transfers  │ (self-referential via accounts)
└─────────────┘

┌─────────────┐
│conversations│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  messages   │
└─────────────┘
```

## TypeScript Types

```typescript
type Account = {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'etf';
  balance: string;
  currency: string;
  createdAt: Date;
};

type Category = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  createdAt: Date;
};

type Expense = {
  id: string;
  accountId: string | null;
  categoryId: string | null;
  name: string;
  amount: string;
  recurrenceType: 'once' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  recurrenceInterval: number | null;
  startDate: Date;
  endDate: Date | null;
  createdAt: Date;
};

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

type DailyExpense = {
  id: string;
  accountId: string | null;
  categoryId: string | null;
  description: string;
  amount: string;
  date: Date;
  createdAt: Date;
};

type Transfer = {
  id: string;
  sourceAccountId: string;
  targetAccountId: string;
  amount: string;
  description: string | null;
  recurrenceType: 'once' | 'monthly' | 'quarterly' | 'yearly';
  startDate: Date;
  endDate: Date | null;
  createdAt: Date;
};

type Conversation = {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
};

type Message = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
};
```
