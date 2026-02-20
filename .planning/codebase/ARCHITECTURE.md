# Architecture

**Analysis Date:** 2026-02-20

## Pattern Overview

**Overall:** Next.js App Router with Server Actions

**Key Characteristics:**
- React Server Components (RSC) for data fetching
- Server Actions for mutations
- Atomic Design component hierarchy
- AI SDK integration for conversational UI
- Drizzle ORM with relational queries

## Layers

### Presentation Layer
- Purpose: UI rendering and user interactions
- Location: `src/app/`, `src/components/`
- Contains: Pages, layouts, client components, UI primitives
- Depends on: Server actions, hooks, context providers
- Used by: Browser

### Data Access Layer
- Purpose: Database operations and query building
- Location: `src/lib/db/`, `src/actions/`
- Contains: Schema definitions, server actions, query logic
- Depends on: Drizzle ORM, PostgreSQL client
- Used by: Presentation layer, API routes

### AI Integration Layer
- Purpose: AI assistant functionality
- Location: `src/lib/ai/`, `src/app/api/chat/`
- Contains: Tool definitions, chat route, system prompts
- Depends on: Vercel AI SDK, OpenAI, server actions
- Used by: Chat interface component

### Infrastructure Layer
- Purpose: Cross-cutting concerns and configuration
- Location: `src/lib/`, `src/i18n/`, `src/hooks/`, `src/types/`
- Contains: Utilities, validations, i18n config, type definitions
- Depends on: Framework packages
- Used by: All other layers

## Data Flow

### Page Data Loading Flow:

1. Server Component (page.tsx) imports server actions
2. Server actions execute database queries via Drizzle
3. Data is passed as props to Client Component
4. Client component renders UI with data

```typescript
// Example: src/app/(dashboard)/dashboard/page.tsx
export default async function DashboardPage() {
  const [statsResult, breakdownResult] = await Promise.all([
    getDashboardStats(),
    getCategoryBreakdown(),
  ]);
  return <DashboardClient stats={stats} categoryBreakdown={breakdown} />;
}
```

### Mutation Flow:

1. Client component triggers server action via form or button
2. Server action validates input with Zod schemas
3. Server action executes database mutation via Drizzle
4. Server action calls `revalidatePath()` for cache invalidation
5. Server action returns `ApiResponse<T>` type
6. Client handles success/error response

```typescript
// Response type pattern: src/types/database.ts
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

### AI Chat Flow:

1. User sends message via `useChat` hook
2. POST request to `src/app/api/chat/route.ts`
3. Server builds system prompt with current context
4. `streamText()` processes with tools
5. Tools requiring approval show confirmation card
6. User approves/denies via `addToolApprovalResponse()`
7. On completion, messages saved to database

**State Management:**
- React Context for global settings (locale, currency, theme)
- `useChat` hook for AI conversation state
- Local state in organisms for form handling
- Server state managed by Next.js cache + revalidation

## Key Abstractions

### Server Actions
- Purpose: Server-side mutations accessible from client
- Examples: `src/actions/accounts-actions.ts`, `src/actions/expense-actions.ts`
- Pattern: Export async functions with `'use server'` directive

```typescript
// Pattern: src/actions/*.ts
'use server';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function createAccount(data: CreateInput): Promise<ApiResponse<Account>> {
  const [result] = await db.insert(accounts).values(data).returning();
  revalidatePath('/accounts');
  return { success: true, data: result };
}
```

### AI Tools
- Purpose: Define callable functions for AI assistant
- Examples: `src/lib/ai/tools.ts`
- Pattern: Export tool definitions with Zod schemas

```typescript
// Pattern: src/lib/ai/tools.ts
export const tools = {
  createExpense: tool({
    description: 'Erstellt eine wiederkehrende Ausgabe',
    inputSchema: z.object({
      accountId: z.uuid(),
      amount: z.number().positive(),
      // ...
    }),
    needsApproval: true,
    execute: async (input) => createExpense(input),
  }),
};
```

### Atomic Components
- Purpose: Reusable UI building blocks
- Examples: `src/components/atoms/`, `src/components/molecules/`, `src/components/organisms/`
- Pattern: Hierarchical composition with shadcn/ui base

```
atoms/     → Basic UI elements (wrappers around shadcn)
molecules/ → Composed UI patterns (forms, cards, inputs)
organisms/ → Full features (chat interface, expense form)
templates/ → Page layouts
layout/    → App structure (sidebar, header)
```

### Type Inference
- Purpose: Derive TypeScript types from Drizzle schema
- Examples: `src/types/database.ts`
- Pattern: Use `InferSelectModel` and `InferInsertModel`

```typescript
// Pattern: src/types/database.ts
import type { InferSelectModel } from 'drizzle-orm';
import { accounts, expenses } from '@/lib/db/schema';

export type Account = InferSelectModel<typeof accounts>;
export type ExpenseWithDetails = Expense & {
  category: Category | null;
  account: Account | null;
};
```

## Entry Points

### Web Application Entry:
- Location: `src/app/layout.tsx`
- Triggers: Initial page load
- Responsibilities: Root layout, providers setup, fonts, metadata

### Dashboard Entry:
- Location: `src/app/(dashboard)/layout.tsx`
- Triggers: Navigation to any dashboard route
- Responsibilities: Sidebar, header, main content area, background styling

### API Routes:
- Location: `src/app/api/chat/route.ts`, `src/app/api/documents/[id]/route.ts`
- Triggers: HTTP requests
- Responsibilities: AI chat streaming, document CRUD

### Landing Page:
- Location: `src/app/page.tsx`
- Triggers: Root path access
- Responsibilities: Redirects to `/dashboard`

## Error Handling

**Strategy:** Typed response pattern with success/error discrimination

**Patterns:**
- Server actions return `ApiResponse<T>` discriminated union
- Client components check `result.success` before accessing data
- Toast notifications for user feedback via `sonner`
- Console.error logging on server side

```typescript
// Client-side error handling pattern
const result = await createExpense(data);
if (result.success) {
  toast.success('Ausgabe erstellt');
  onSuccess?.(result.data);
} else {
  toast.error(result.error);
}
```

## Cross-Cutting Concerns

**Logging:** Console-based with development-only AI step logging in chat route

**Validation:** Zod schemas in `src/lib/validations/` and `src/lib/validators/`
- Used with `@hookform/resolvers` for form validation
- Used in AI tools for input validation

**Authentication:** Not implemented (single-user/self-hosted application)

**Internationalization:** 
- `next-intl` for translations
- Message files in `messages/de.json`, `messages/en.json`
- Locale and currency stored in cookies

**Theme:** 
- `next-themes` for dark/light mode
- CSS variables for theming
- System preference detection

**Caching:**
- Next.js built-in cache
- `revalidatePath()` for targeted invalidation
- `revalidateTag()` not currently used
