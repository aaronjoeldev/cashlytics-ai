# Cashlytics API Documentation

This document provides comprehensive documentation for all Server Actions and API routes in the Cashlytics application.

## Overview

Cashlytics uses **Next.js Server Actions** for data mutations and queries, and a single **API Route** for the AI chat assistant. All server actions are defined with `'use server'` directive and return a standardized `ApiResponse<T>` type.

## Architecture

```
src/
├── actions/              # Server Actions (data layer)
│   ├── expense-actions.ts
│   ├── expenses-actions.ts
│   ├── daily-expenses-actions.ts
│   ├── income-actions.ts
│   ├── incomes-actions.ts
│   ├── account-actions.ts
│   ├── accounts-actions.ts
│   ├── account-detail-actions.ts
│   ├── category-actions.ts
│   ├── transfer-actions.ts
│   ├── analytics-actions.ts
│   ├── dashboard-actions.ts
│   ├── forecast-actions.ts
│   ├── conversation-actions.ts
│   └── search-actions.ts
└── app/api/             # API Routes
    └── chat/route.ts
```

## Response Type

All server actions return a standardized response type:

```typescript
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

## Documentation Sections

| Section | Description |
|---------|-------------|
| [Expenses](./expenses.md) | Periodic and daily expense management |
| [Incomes](./incomes.md) | Income source management |
| [Accounts](./accounts.md) | Account CRUD and transaction details |
| [Categories](./categories.md) | Category management for expenses |
| [Transfers](./transfers.md) | Inter-account transfers |
| [Analytics](./analytics.md) | Financial analytics and reports |
| [Dashboard](./dashboard.md) | Dashboard statistics and widgets |
| [Forecast](./forecast.md) | Account balance forecasting |
| [Chat Assistant](./chat-assistant.md) | AI chatbot and conversation management |
| [Search](./search.md) | Global search functionality |

## Database Types

Core types are inferred from Drizzle ORM schemas:

| Type | Description |
|------|-------------|
| `Account` | Bank account (checking, savings, ETF) |
| `Category` | Expense category with icon/color |
| `Expense` | Periodic expense with recurrence |
| `DailyExpense` | One-time daily expense |
| `Income` | Income source with recurrence |
| `Transfer` | Transfer between accounts |
| `Conversation` | AI chat conversation |
| `Message` | Chat message (user/assistant) |

## Entity Relationship Diagram

```
┌─────────────┐     ┌─────────────┐
│   Account   │────<│   Expense   │
└─────────────┘     └─────────────┘
       │                   │
       │            ┌──────┘
       │            │
       ▼            ▼
┌─────────────┐     ┌─────────────┐
│DailyExpense │     │   Income    │
└─────────────┘     └─────────────┘
       │
       │
       ▼
┌─────────────┐     ┌─────────────┐
│  Category   │     │  Transfer   │
└─────────────┘     └─────────────┘
```

## Cache Revalidation

Server actions automatically revalidate relevant paths after mutations:

- `/expenses` - Expense-related changes
- `/income` - Income-related changes
- `/accounts` - Account balance changes
- `/dashboard` - Any financial change
- `/transfers` - Transfer-related changes
- `/settings` - Category/settings changes
- `/assistant` - Conversation changes
