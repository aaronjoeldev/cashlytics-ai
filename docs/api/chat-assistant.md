# Chat Assistant API

This document covers the AI chat assistant API route and conversation management server actions.

## Files

| File | Type | Purpose |
|------|------|---------|
| `src/app/api/chat/route.ts` | API Route | AI chat endpoint with OpenAI integration |
| `src/actions/conversation-actions.ts` | Server Action | Conversation and message CRUD |

---

## Chat API Route

**Path**: `src/app/api/chat/route.ts`  
**Type**: API Route (POST)

### Overview

Provides streaming chat responses using OpenAI's GPT-4o model with tool calling capabilities. The assistant is specialized for financial tasks within Cashlytics.

### Endpoint

```
POST /api/chat
```

### Request Body

```typescript
interface Request {
  messages: UIMessage[];
}

// UIMessage from 'ai' package
type UIMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  // ... additional fields from ai package
};
```

### Response

Returns a streaming response compatible with the AI SDK's `useChat` hook.

```
Content-Type: text/event-stream
```

### Example Usage

```typescript
// Client-side with AI SDK
import { useChat } from 'ai/react';

function ChatComponent() {
  const { messages, input, handleSubmit } = useChat({
    api: '/api/chat',
  });

  return (
    <form onSubmit={handleSubmit}>
      {messages.map(m => (
        <div key={m.id}>{m.role}: {m.content}</div>
      ))}
      <input value={input} onChange={...} />
    </form>
  );
}
```

### Error Handling

```typescript
// Error response format
{
  "error": "Ein Fehler ist aufgetreten. Bitte versuche es erneut."
}
```

Status code: 500

---

## System Prompt

The assistant uses a comprehensive system prompt with:

1. **Role Restriction**: Only answers finance-related questions
2. **Context Injection**: Real-time account, category, and expense data
3. **Tool Selection Guidance**: When to use which tools
4. **Date Handling**: German date format and relative dates

### Prompt Structure

```
BASE_SYSTEM_PROMPT
  ├── Role Definition (Cashlytics Finance Assistant)
  ├── Strict Topic Restriction
  ├── Expense Type Guidelines (Daily vs Periodic)
  ├── Critical Creation Rules
  ├── Date Rules
  ├── Tool Selection Logic
  └── Behavior Guidelines

+ DYNAMIC CONTEXT
  ├── Current Date (German format + ISO)
  ├── Available Accounts (with IDs and balances)
  ├── Available Categories (with IDs and icons)
  └── Existing Periodic Expenses (for updates)
```

### Context Injection

The system prompt is built dynamically with current data:

```typescript
async function buildSystemPrompt(): Promise<string> {
  const [accounts, categories, expenses] = await Promise.all([
    getAccounts(),
    getCategories(),
    getExpenses(),
  ]);
  
  // Formats context with IDs for tool calls
  // Example: "Girokonto | Typ: checking | Stand: 2500 EUR | ID: abc-123"
}
```

---

## Conversation Actions

**Path**: `src/actions/conversation-actions.ts`  
**Type**: Server Action

### Overview

Manages chat conversations and message persistence for the AI assistant.

### Functions

#### getConversations

Retrieves all conversations sorted by last update.

**Parameters**: None

**Returns**: `ApiResponse<Conversation[]>`

```typescript
type Conversation = {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
};
```

---

#### getConversationById

Retrieves a conversation with all its messages.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Conversation ID |

**Returns**: `ApiResponse<ConversationWithMessages>`

```typescript
type ConversationWithMessages = Conversation & {
  messages: Message[];
};

type Message = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
};
```

---

#### createConversation

Creates a new conversation.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | `string` | No | Conversation title (default: "Neuer Chat") |

**Returns**: `ApiResponse<Conversation>`

---

#### updateConversationTitle

Updates a conversation's title.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Conversation ID |
| `title` | `string` | Yes | New title |

**Returns**: `ApiResponse<Conversation>`

---

#### deleteConversation

Deletes a conversation and its messages.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Conversation ID |

**Returns**: `ApiResponse<void>`

---

#### saveMessage

Saves a message to a conversation.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversationId` | `string` | Yes | Target conversation |
| `role` | `'user' \| 'assistant'` | Yes | Message role |
| `content` | `string` | Yes | Message content |

**Returns**: `ApiResponse<Message>`

**Side Effect**: Updates conversation's `updatedAt` timestamp.

---

#### getMessages

Retrieves all messages for a conversation.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversationId` | `string` | Yes | Conversation ID |

**Returns**: `ApiResponse<Message[]>`

---

#### updateConversationTitleFromFirstMessage

Auto-generates title from first message.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversationId` | `string` | Yes | Conversation ID |
| `firstMessage` | `string` | Yes | First message content |

**Returns**: `ApiResponse<Conversation>`

**Behavior**: Takes first 50 characters + "..." if longer.

---

## Type Definitions

```typescript
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

type ConversationWithMessages = Conversation & {
  messages: Message[];
};
```

## Revalidation

Conversation mutations trigger cache revalidation for:
- `/assistant`

## AI Tools Integration

The chat API integrates with tools defined in `src/lib/ai/tools.ts`. Common tools include:

- `createDailyExpense` - Record one-time expenses
- `createExpense` - Record recurring expenses
- `createIncome` - Record income
- `createAccount` - Create new accounts
- `createCategory` - Create categories
- `getMonthlyOverview` - Get financial summaries
- `getExpenses`, `getIncomes`, `getAccounts` - Query data
