# AI Integration

## Overview

Cashlytics includes an AI-powered financial assistant that uses OpenAI's language models via the Vercel AI SDK. The assistant can perform CRUD operations on financial data through structured tool calls.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  Chat API   │────▶│   OpenAI    │
│  (useChat)  │◀────│  (/api/chat)│◀────│   Model     │
└─────────────┘     └──────┬──────┘     └──────┬──────┘
                           │                   │
                           │                   │ Tool Calls
                           ▼                   ▼
                    ┌─────────────────────────────┐
                    │         AI Tools            │
                    │  (src/lib/ai/tools.ts)      │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │      Server Actions         │
                    │  (src/actions/*.ts)         │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │      Database (Drizzle)     │
                    └─────────────────────────────┘
```

## Available Tools

### Account Management

#### `createAccount`

Creates a new financial account.

```typescript
{
  name: string;        // Account name
  type: 'checking' | 'savings' | 'etf';
  balance?: string;    // Default: '0'
  currency?: string;   // Default: 'EUR'
}
```

#### `getAccounts`

Returns all user accounts with balances and types.

```typescript
// Input: {}
// Returns: Account[]
```

#### `updateAccount`

Updates an existing account.

```typescript
{
  id: string;          // UUID
  name?: string;
  type?: 'checking' | 'savings' | 'etf';
  balance?: string;
}
```

#### `deleteAccount`

Deletes an account and all associated transactions.

```typescript
{
  id: string;  // UUID
}
```

---

### Recurring Expenses

#### `createExpense`

Creates a recurring expense (rent, subscriptions, etc.).

```typescript
{
  accountId: string;
  categoryId?: string | null;
  name: string;
  amount: number;
  recurrenceType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  recurrenceInterval?: number | null;  // For custom recurrence
  startDate: string;  // ISO format
  endDate?: string | null;
}
```

#### `getExpenses`

Returns recurring expenses with optional filters.

```typescript
{
  accountId?: string;
  categoryId?: string;
  name?: string;       // Partial match, case-insensitive
  startDate?: string;
  endDate?: string;
}
```

#### `updateExpense`

Updates an existing recurring expense.

```typescript
{
  id: string;
  name?: string;
  amount?: number;
  recurrenceType?: 'once' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  endDate?: string | null;
}
```

#### `deleteExpense`

Deletes a recurring expense.

```typescript
{
  id: string;
}
```

---

### One-time Expenses

#### `createDailyExpense`

Creates a one-time expense (groceries, gas, etc.).

```typescript
{
  accountId: string;
  categoryId?: string | null;
  description: string;
  amount: number;
  date: string;  // ISO format
}
```

#### `getDailyExpenses`

Returns one-time expenses with optional filters.

```typescript
{
  accountId?: string;
  categoryId?: string;
  description?: string;  // Partial match, case-insensitive
  startDate?: string;
  endDate?: string;
}
```

#### `deleteDailyExpense`

Deletes a one-time expense.

```typescript
{
  id: string;
}
```

---

### Income Management

#### `createIncome`

Creates an income source.

```typescript
{
  accountId: string;
  source: string;
  amount: number;
  recurrenceType: 'once' | 'monthly' | 'yearly';
  startDate: string;
}
```

#### `getIncomes`

Returns income records with optional filters.

```typescript
{
  accountId?: string;
  startDate?: string;
  endDate?: string;
}
```

#### `updateIncome`

Updates an existing income.

```typescript
{
  id: string;
  source?: string;
  amount?: number;
  recurrenceType?: 'once' | 'monthly' | 'yearly';
}
```

#### `deleteIncome`

Deletes an income record.

```typescript
{
  id: string;
}
```

---

### Category Management

#### `getCategories`

Returns all available categories.

```typescript
// Input: {}
// Returns: Category[]
```

#### `createCategory`

Creates a new expense category.

```typescript
{
  name: string;
  icon?: string;   // Emoji
  color?: string;  // Hex code
}
```

---

### Analytics

#### `getMonthlyOverview`

Returns financial summary for a specific month.

```typescript
{
  month: number;  // 1-12
  year: number;   // 2020-2100
}

// Returns:
{
  month: number;
  year: number;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  expenses: Array<{
    name: string;
    amount: string;
    recurrenceType: string;
    category: string | null;
  }>;
  incomes: Array<{
    source: string;
    amount: string;
    recurrenceType: string;
  }>;
}
```

#### `getForecast`

Creates a financial forecast for upcoming months.

```typescript
{
  months: number;  // 1-24
}

// Returns monthly projections for income, expenses, and balance
```

#### `getCategoryBreakdown`

Returns expense breakdown by category for a date range.

```typescript
{
  startDate: string;
  endDate: string;
}
```

#### `getNormalizedMonthlyExpenses`

Returns all recurring expenses normalized to monthly amounts.

```typescript
// Input: {}
// Useful for understanding actual monthly financial burden
```

---

## Client-Side Integration

### useChat Hook

The AI assistant uses the Vercel AI SDK's `useChat` hook:

```typescript
import { useChat } from '@ai-sdk/react';

const chat = useChat({
  api: '/api/chat',
  body: { tools },  // Tool definitions
  onFinish: async ({ message }) => {
    // Save message to database
    // Update conversation title
  },
});
```

### useConversations Hook

Custom hook managing chat state and persistence:

```typescript
interface UseConversationsReturn {
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoadingConversations: boolean;
  loadConversations: () => Promise<ApiResponse<Conversation[]>>;
  selectConversation: (id: string) => Promise<void>;
  startNewChat: () => Promise<void>;
  deleteConversationWithSwitch: (id: string) => Promise<void>;
  messages: Message[];
  sendMessage: (message: string) => void;
  status: 'idle' | 'loading' | 'error';
  error: Error | null;
  setMessages: (messages: Message[]) => void;
}
```

---

## Conversation Persistence

### Database Storage

Conversations and messages are stored in PostgreSQL:

- `conversations` table: Stores chat sessions with title and timestamps
- `messages` table: Stores individual messages with role (user/assistant)

### Flow

1. User sends message via `sendMessage`
2. Message streamed to `/api/chat` endpoint
3. OpenAI processes message with available tools
4. Tool calls execute server actions
5. Response streamed back to client
6. `onFinish` callback saves user and assistant messages to database
7. Conversation title updated from first message

---

## Example Interactions

### Creating an Account

```
User: "Create a new checking account called 'Main Account' with 5000 euros"
AI: Uses createAccount tool → Confirms account creation
```

### Adding an Expense

```
User: "I pay 1200 euros rent monthly starting January"
AI: Uses createExpense tool with recurrenceType='monthly'
```

### Recording a Purchase

```
User: "I spent 45 euros at the grocery store today"
AI: Uses createDailyExpense tool
```

### Checking Finances

```
User: "How much did I spend this month?"
AI: Uses getMonthlyOverview tool → Provides summary
```

### Forecasting

```
User: "What will my finances look like in 6 months?"
AI: Uses getForecast tool → Provides projections
```

---

## Tool Descriptions (German)

Tools have German descriptions for the AI model:

- `createAccount`: "Erstellt ein neues Konto"
- `createExpense`: "Erstellt eine WIEDERKEHRENDE Ausgabe"
- `createDailyExpense`: "Erstellt eine einmalige Ausgabe"
- `getMonthlyOverview`: "Gibt eine kompakte Übersicht über Einnahmen, Ausgaben und Saldo"

This ensures the AI responds appropriately in the user's preferred language.
