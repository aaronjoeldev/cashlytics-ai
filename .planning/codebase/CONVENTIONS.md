# Coding Conventions

**Analysis Date:** 2026-02-20

## Naming Patterns

**Files:**
- Use kebab-case for all source files
- React components: `expense-form.tsx`, `chat-interface.tsx`
- Server actions: `expense-actions.ts`, `account-actions.ts`
- Hooks: `use-conversations.ts`, `use-toast.ts`
- Utilities: `utils.ts`, `currency.ts`
- Schemas: `schema.ts`, `expense.ts`

**Functions and Variables:**
- Use camelCase for functions and variables
- React components use PascalCase: `ExpenseForm`, `ChatInterface`
- Server action functions use camelCase: `getExpenses`, `createAccount`
- Helper functions use camelCase: `formatDate`, `normalizeToMonthly`

**Types:**
- Use PascalCase for type names
- Entity types: `Account`, `Expense`, `Category`
- Input types: `ExpenseInput`, `CategoryInput`
- Composite types: `ExpenseWithDetails`, `ApiResponse<T>`
- Enum values: `recurrenceTypeEnum`, `accountTypeEnum`

**Constants:**
- UPPER_SNAKE_CASE for true constants: `MAX_FILE_SIZE`, `ALLOWED_FILE_TYPES`
- camelCase for configuration objects

## Code Style

**Formatting:**
- ESLint configured via `eslint.config.mjs` using `eslint-config-next`
- TypeScript strict mode enabled
- No Prettier configuration detected - relies on ESLint

**TypeScript Configuration:**
- Target: ES2017
- Module: ESNext with bundler resolution
- JSX: react-jsx
- Path alias: `@/*` maps to `./src/*`

## Import Organization

**Order:**
1. React/Next.js imports
2. Third-party libraries (sorted alphabetically)
3. Internal imports via `@/` alias
4. Type imports (using `import type`)

**Example pattern from `src/actions/expense-actions.ts`:**
```typescript
'use server';

import { db } from '@/lib/db';
import { expenses, dailyExpenses, accounts } from '@/lib/db/schema';
import { eq, and, gte, lte, desc, sql, ilike } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { ApiResponse, Expense, NewExpense, DailyExpense, NewDailyExpense, ExpenseWithDetails, DailyExpenseWithDetails } from '@/types/database';
```

**Path Aliases:**
- `@/*` - maps to `./src/*`
- Use for all internal imports
- Never use relative paths like `../lib/` or `../../components/`

## Client/Server Separation

**Directives:**
- `'use client'` - Top of client components
- `'use server'` - Top of server action files

**Pattern:**
- `page.tsx` - Server component that fetches data
- `client.tsx` - Client component with interactivity

**Example from `src/app/(dashboard)/expenses/`:**
```typescript
// page.tsx (server)
import { getAccounts } from '@/actions/account-actions';
import { ExpensesClient } from './client';

export default async function ExpensesPage() {
  const accountsResult = await getAccounts();
  const accounts = accountsResult.success ? accountsResult.data : [];
  return <ExpensesClient accounts={accounts} />;
}

// client.tsx (client)
'use client';
import { useState } from 'react';
// ... interactive code
export function ExpensesClient({ accounts }: ExpensesClientProps) { ... }
```

## Error Handling

**Server Actions Pattern:**
```typescript
// All server actions return ApiResponse<T>
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// Example implementation
export async function createExpense(data: NewExpense): Promise<ApiResponse<Expense>> {
  try {
    const [expense] = await db.insert(expenses).values(data).returning();
    revalidatePath('/expenses');
    return { success: true, data: expense };
  } catch (error) {
    console.error('Failed to create expense:', error);
    return { success: false, error: 'Failed to create expense' };
  }
}
```

**Client-Side Error Handling:**
```typescript
// Check result.success before accessing data
const result = await deleteExpense(id);
if (result.success) {
  setExpenses(prev => prev.filter(e => e.id !== id));
  toast({ title: 'Deleted successfully' });
} else {
  toast({ title: 'Delete failed', variant: 'destructive' });
}
```

## API Response Pattern

**Standard Response Type:**
```typescript
// Defined in src/types/database.ts
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

**Usage Guidelines:**
- All server actions return `ApiResponse<T>`
- Client code checks `result.success` before accessing `result.data`
- Error messages can be localized (German strings seen in codebase)

## Form Handling

**Pattern using react-hook-form + zod:**
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { expenseSchema, type ExpenseInput } from '@/lib/validations/expense';

const form = useForm<ExpenseInput>({
  resolver: zodResolver(expenseSchema),
  defaultValues: {
    accountId: '',
    name: '',
    amount: '',
    recurrenceType: 'monthly',
    startDate: new Date(),
  },
});

// Submit handler
const handleSubmit = async (data: ExpenseInput) => {
  const result = await createExpense(data);
  if (result.success) {
    form.reset();
    onSuccess?.(result.data);
  }
};
```

**Validation Schemas:**
- Located in `src/lib/validations/`
- Named to match entity: `expense.ts`, `category.ts`
- Export schema and inferred type together

## Internationalization (i18n)

**Framework:** next-intl

**Usage Pattern:**
```typescript
import { useTranslations } from 'next-intl';

function Component() {
  const t = useTranslations('expenses');
  const tCommon = useTranslations('common');
  
  return (
    <>
      <h1>{t('title')}</h1>
      <button>{tCommon('save')}</button>
    </>
  );
}
```

**Translation Files:**
- Located in `messages/` directory
- JSON files: `en.json`, `de.json`
- Nested structure by feature: `expenses`, `accounts`, `common`

## Logging

**Server-Side:**
- Use `console.error()` for error logging in server actions
- Pattern: `console.error('Failed to [action]:', error)`

**Client-Side:**
- Use toast notifications via `useToast` hook or `sonner`
- Import from `sonner` for simple toasts: `toast.success('Message')`
- Use `useToast` hook for more control

## Toast Notifications

**Pattern via shadcn/ui toast:**
```typescript
import { useToast } from '@/hooks/use-toast';

function Component() {
  const { toast } = useToast();
  
  const handleDelete = async (id: string) => {
    const result = await deleteItem(id);
    if (result.success) {
      toast({ 
        title: 'Deleted', 
        description: 'Item was removed successfully' 
      });
    } else {
      toast({ 
        title: 'Error', 
        description: 'Delete failed',
        variant: 'destructive' 
      });
    }
  };
}
```

**Alternative via sonner:**
```typescript
import { toast } from 'sonner';

// Simple usage
toast.success('Operation completed');
toast.error('Something went wrong');
```

## Component Organization

**Atomic Design Structure:**
- `src/components/atoms/` - Basic UI elements (category-select)
- `src/components/molecules/` - Composed components (file-upload, chat-input)
- `src/components/organisms/` - Complex components (expense-form, chat-interface)
- `src/components/templates/` - Page layouts
- `src/components/layout/` - Layout components (header, sidebar)
- `src/components/ui/` - shadcn/ui primitives (button, dialog, input)
- `src/components/providers/` - Context providers

**Component Pattern:**
```typescript
// Props interface at top
interface ExpenseFormProps {
  accounts: Account[];
  categories: Category[];
  onSuccess?: (data: Expense) => void;
  editExpense?: Expense | null;
}

// Named export for components
export function ExpenseForm({ accounts, categories, onSuccess }: ExpenseFormProps) {
  // Hooks at top
  const t = useTranslations('expenses');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Event handlers
  const handleSubmit = async (data: ExpenseInput) => { ... };
  
  // JSX return
  return ( ... );
}
```

## Database Access

**Pattern via Drizzle ORM:**
```typescript
import { db } from '@/lib/db';
import { expenses, accounts } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

// Query with relations
const result = await db.query.expenses.findMany({
  where: conditions.length > 0 ? and(...conditions) : undefined,
  with: { account: true, category: true },
  orderBy: [desc(expenses.startDate)],
});

// Insert
const [expense] = await db.insert(expenses).values(data).returning();

// Update with SQL
await db.update(accounts)
  .set({ balance: sql`${accounts.balance} - ${amount}` })
  .where(eq(accounts.id, accountId));
```

## Cache Revalidation

**Pattern in Server Actions:**
```typescript
import { revalidatePath } from 'next/cache';

// After mutations
revalidatePath('/expenses');
revalidatePath('/dashboard');
revalidatePath('/accounts');
```

## Comments

**When to Comment:**
- AI tool descriptions (German language used for AI context)
- Complex business logic explanations
- Security-sensitive data filtering (e.g., document exclusion from AI context)

**JSDoc/TSDoc:**
- Not widely used
- Comments primarily in German for AI tooling

## Function Design

**Size:** Functions can be moderately long (50-100 lines) for complex components

**Parameters:** 
- Use interfaces for props with 3+ parameters
- Optional parameters use `?:` with undefined fallbacks

**Return Values:**
- Server actions always return `ApiResponse<T>`
- Client components return JSX
- Hooks return objects with named exports

## Module Design

**Exports:**
- Prefer named exports over default exports
- Server actions: multiple named exports per file
- Components: single named export matching filename

**Barrel Files:**
- `src/components/providers/index.tsx` exports `Providers`
- Use for grouping related exports

---

*Convention analysis: 2026-02-20*
