# ExpenseForm

**Path**: `src/components/organisms/expense-form.tsx`
**Type**: Organism
**Status**: ✅ Stable

## Overview

A comprehensive dialog form for creating and editing expenses. Supports two expense types: periodic (recurring) and daily (one-time), with inline category creation capability.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `accounts` | `Account[]` | Yes | - | Available accounts |
| `categories` | `Category[]` | Yes | - | Available categories |
| `onSuccess` | `(data: { type: 'periodic' \| 'daily'; item: any }) => void` | No | - | Callback after successful operation |
| `onCategoryCreated` | `(category: Category) => void` | No | - | Callback when new category is created |
| `editExpense` | `Expense \| null` | No | - | Existing periodic expense to edit |
| `editDailyExpense` | `DailyExpense \| null` | No | - | Existing daily expense to edit |
| `open` | `boolean` | No | - | Controlled dialog open state |
| `onOpenChange` | `(open: boolean) => void` | No | - | Callback when dialog state changes |

## Usage

```tsx
import { ExpenseForm } from '@/components/organisms/expense-form';

function ExpensesPage({ accounts, categories }) {
  return (
    <ExpenseForm
      accounts={accounts}
      categories={categories}
      onSuccess={({ type, item }) => {
        toast.success(`${type} expense created`);
      }}
      onCategoryCreated={(cat) => {
        setCategories(prev => [...prev, cat]);
      }}
    />
  );
}
```

## Features

### Two Expense Types
- **Periodic**: Recurring expenses with patterns (once, daily, weekly, monthly, quarterly, yearly, custom)
- **Daily**: One-time expenses with specific date

### Inline Category Creation
- Create new categories without leaving the form
- Emoji picker for category icon
- Color picker for category color
- Auto-selects newly created category

### Edit Mode
- Pre-populates form with existing expense data
- Automatically selects correct tab (periodic/daily)
- Hides tab switcher in edit mode

### Other Features
- Zod validation for both form types
- Optional category assignment
- Date range for recurring expenses
- Loading states during submission

## Dependencies

- `react` (useState, useEffect)
- `react-hook-form` (useForm)
- `@hookform/resolvers/zod` (zodResolver)
- `lucide-react` (Plus)
- `@/lib/validations/transaction` (expenseSchema, dailyExpenseSchema, ExpenseInput, DailyExpenseInput, recurrenceTypes)
- `@/lib/validations/category` (CategoryInput)
- `@/actions/expense-actions` (createExpense, createDailyExpense, updateExpense, updateDailyExpense)
- `@/actions/category-actions` (createCategory)
- `@/components/molecules/emoji-picker` (EmojiPicker)
- `@/components/ui/button` (Button)
- `@/components/ui/input` (Input)
- `@/components/ui/label` (Label)
- `@/components/ui/select` (Select, SelectContent, SelectItem, SelectTrigger, SelectValue)
- `@/components/ui/dialog` (Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription)
- `@/components/ui/tabs` (Tabs, TabsContent, TabsList, TabsTrigger)
- `@/types/database` (Account, Category, Expense, DailyExpense)

## Form Fields

### Periodic Expense

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | text | Yes | Expense name |
| `amount` | number | Yes | Amount in EUR |
| `recurrenceType` | select | Yes | Recurrence pattern |
| `accountId` | select | Yes | Source account |
| `categoryId` | select | No | Optional category |
| `startDate` | date | Yes | Start date |
| `endDate` | date | No | Optional end date |

### Daily Expense

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | text | Yes | Expense description |
| `amount` | number | Yes | Amount in EUR |
| `date` | date | Yes | Expense date |
| `accountId` | select | Yes | Source account |
| `categoryId` | select | No | Optional category |

## Related Components

- [FloatingActions](./floating-actions.md) - Quick access to expense creation
- [IncomeForm](./income-form.md) - Similar form for income
- [EmojiPicker](../molecules/emoji-picker.md) - Used for inline category creation
