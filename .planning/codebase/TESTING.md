# Testing Patterns

**Analysis Date:** 2026-02-20

## Test Framework

**Status:** Not Configured

**Current State:**
- No test framework installed in the project
- No test configuration files found
- No test files in the `src/` directory
- No testing scripts in `package.json`

**Available Scripts in package.json:**
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "db:push": "drizzle-kit push",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  }
}
```

## Test File Organization

**Current State:** No test files exist in the project

**Recommended Location (if tests are added):**
```
src/
├── actions/
│   ├── expense-actions.ts
│   └── expense-actions.test.ts    # Co-located tests
├── components/
│   └── organisms/
│       ├── expense-form.tsx
│       └── expense-form.test.tsx  # Co-located tests
└── lib/
    └── utils.test.ts
```

**Alternative Structure (separate directory):**
```
__tests__/
├── actions/
│   └── expense-actions.test.ts
├── components/
│   └── expense-form.test.tsx
└── lib/
    └── utils.test.ts
```

## Recommended Test Framework Setup

**Suggested Stack:**
- **Vitest** - Fast, Vite-compatible test runner
- **@testing-library/react** - React component testing
- **MSW (Mock Service Worker)** - API mocking for server actions

**Installation Command:**
```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom
```

**Suggested vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**Suggested Scripts to Add:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest watch",
    "test:coverage": "vitest --coverage"
  }
}
```

## Recommended Test Patterns

### Unit Tests for Utilities

**Pattern for testing utility functions:**
```typescript
// src/lib/utils.test.ts
import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    expect(cn('base', true && 'included', false && 'excluded')).toBe('base included');
  });
});
```

### Server Action Tests

**Pattern for testing server actions:**
```typescript
// src/actions/expense-actions.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getExpenses, createExpense } from './expense-actions';
import { db } from '@/lib/db';

// Mock the database
vi.mock('@/lib/db', () => ({
  db: {
    query: {
      expenses: {
        findMany: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(),
      })),
    })),
  },
}));

describe('expense-actions', () => {
  describe('getExpenses', () => {
    it('should return expenses with success status', async () => {
      const mockExpenses = [{ id: '1', name: 'Test' }];
      db.query.expenses.findMany.mockResolvedValue(mockExpenses);
      
      const result = await getExpenses();
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockExpenses);
    });

    it('should filter by accountId', async () => {
      await getExpenses({ accountId: 'account-123' });
      
      // Verify filter was applied
    });
  });

  describe('createExpense', () => {
    it('should create expense and revalidate paths', async () => {
      const newExpense = { name: 'Rent', amount: '1000' };
      
      const result = await createExpense(newExpense);
      
      expect(result.success).toBe(true);
    });
  });
});
```

### React Component Tests

**Pattern for testing components:**
```typescript
// src/components/organisms/expense-form.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExpenseForm } from './expense-form';

// Mock server actions
vi.mock('@/actions/expense-actions', () => ({
  createExpense: vi.fn(() => Promise.resolve({ success: true, data: { id: '1' } })),
}));

describe('ExpenseForm', () => {
  const mockAccounts = [
    { id: '1', name: 'Checking', type: 'checking' },
  ];
  const mockCategories = [
    { id: '1', name: 'Rent', icon: '🏠' },
  ];

  it('should render form with required fields', () => {
    render(
      <ExpenseForm 
        accounts={mockAccounts} 
        categories={mockCategories} 
      />
    );
    
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
  });

  it('should call onSuccess after successful submission', async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    
    render(
      <ExpenseForm 
        accounts={mockAccounts} 
        categories={mockCategories}
        onSuccess={onSuccess}
      />
    );
    
    // Open dialog, fill form, submit
    await user.click(screen.getByRole('button', { name: /add/i }));
    await user.type(screen.getByLabelText(/name/i), 'Test Expense');
    await user.type(screen.getByLabelText(/amount/i), '100');
    await user.click(screen.getByRole('button', { name: /create/i }));
    
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
```

### Hook Tests

**Pattern for testing custom hooks:**
```typescript
// src/hooks/use-conversations.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useConversations } from './use-conversations';

// Mock server actions
vi.mock('@/actions/conversation-actions', () => ({
  getConversations: vi.fn(() => Promise.resolve({ 
    success: true, 
    data: [{ id: '1', title: 'Test' }] 
  })),
  createConversation: vi.fn(() => Promise.resolve({ 
    success: true, 
    data: { id: '2', title: 'New Chat' } 
  })),
}));

describe('useConversations', () => {
  it('should load conversations on mount', async () => {
    const { result } = renderHook(() => useConversations());
    
    await waitFor(() => {
      expect(result.current.isLoadingConversations).toBe(false);
    });
    
    expect(result.current.conversations).toHaveLength(1);
  });

  it('should create new chat', async () => {
    const { result } = renderHook(() => useConversations());
    
    await act(async () => {
      await result.current.startNewChat();
    });
    
    expect(result.current.conversations).toHaveLength(2);
  });
});
```

## Mocking

**Recommended Mocking Strategy:**

**What to Mock:**
- Database (`@/lib/db`) - Always mock for unit tests
- Server actions - Mock when testing components
- External services (OpenAI API) - Always mock
- Next.js specific modules (`next/navigation`, `next/cache`)

**What NOT to Mock:**
- Utility functions - Test their actual behavior
- Validation schemas - Test actual validation
- Type definitions - Not applicable

**Mock Pattern for Database:**
```typescript
// vitest.setup.ts
import { vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      expenses: { findMany: vi.fn() },
      accounts: { findMany: vi.fn() },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(),
    })),
  },
}));
```

## Fixtures and Factories

**Recommended Test Data Pattern:**
```typescript
// src/__tests__/fixtures/index.ts
import type { Account, Expense, Category } from '@/types/database';

export function createMockAccount(overrides?: Partial<Account>): Account {
  return {
    id: 'account-1',
    name: 'Test Account',
    type: 'checking',
    balance: '1000.00',
    currency: 'EUR',
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

export function createMockExpense(overrides?: Partial<Expense>): Expense {
  return {
    id: 'expense-1',
    accountId: 'account-1',
    categoryId: 'category-1',
    name: 'Test Expense',
    amount: '100.00',
    recurrenceType: 'monthly',
    startDate: new Date('2024-01-01'),
    endDate: null,
    isSubscription: false,
    info: null,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

export function createMockCategory(overrides?: Partial<Category>): Category {
  return {
    id: 'category-1',
    name: 'Test Category',
    icon: '📦',
    color: '#3b82f6',
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}
```

## Coverage

**Current State:** No coverage tracking

**Recommended Coverage Target:**
- Minimum: 70% line coverage
- Target: 80% line coverage
- Critical paths: 100% coverage (server actions, data transformations)

**View Coverage (when configured):**
```bash
npm run test:coverage
```

## Test Types

### Unit Tests

**Scope:**
- Utility functions (`src/lib/utils.ts`, `src/lib/currency.ts`)
- Validation schemas (`src/lib/validations/*.ts`)
- Helper functions (e.g., `formatDate`, `normalizeToMonthly`)

**Approach:**
- Test pure functions with various inputs
- Test edge cases and error conditions
- Use parameterized tests for multiple scenarios

### Integration Tests

**Scope:**
- Server actions with database interactions
- React components with user interactions
- Form submission flows

**Approach:**
- Mock database for consistent test data
- Test complete user flows
- Verify side effects (revalidation, redirects)

### End-to-End Tests

**Recommendation:** Consider Playwright for E2E tests

**Scope:**
- Critical user journeys
- Multi-step workflows
- Cross-page interactions

**Setup:**
```bash
npm install -D @playwright/test
npx playwright install
```

## Common Patterns

### Async Testing

```typescript
// Wait for async operations
import { waitFor } from '@testing-library/react';

it('should load data asynchronously', async () => {
  render(<Component />);
  
  await waitFor(() => {
    expect(screen.getByText('Loaded Data')).toBeInTheDocument();
  });
});
```

### Error Testing

```typescript
// Test error states
it('should handle errors gracefully', async () => {
  vi.mocked(createExpense).mockRejectedValueOnce(new Error('Network error'));
  
  render(<ExpenseForm />);
  
  await user.click(submitButton);
  
  await waitFor(() => {
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});
```

### Form Validation Testing

```typescript
// Test validation
it('should show validation errors', async () => {
  const user = userEvent.setup();
  render(<ExpenseForm accounts={[]} categories={[]} />);
  
  await user.click(submitButton);
  
  expect(screen.getByText(/name is required/i)).toBeInTheDocument();
  expect(screen.getByText(/amount is required/i)).toBeInTheDocument();
});
```

## Priority Test Areas

**High Priority:**
1. Server actions in `src/actions/` - Critical business logic
2. Validation schemas in `src/lib/validations/` - Data integrity
3. Currency formatting in `src/lib/currency.ts` - Financial accuracy

**Medium Priority:**
4. Form components - User input handling
5. Data transformations - Correct calculations

**Lower Priority:**
6. UI components - Visual regression handled separately
7. Provider components - Complex to test, lower risk

## Missing Test Infrastructure

**Current Gaps:**
- No test runner configured
- No assertion library installed
- No test utilities for React
- No mocking infrastructure
- No CI/CD test integration

**Recommendation:** Set up Vitest with React Testing Library as the foundation for testing this codebase.

---

*Testing analysis: 2026-02-20*
