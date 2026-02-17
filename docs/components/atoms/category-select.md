# CategorySelect

**Path**: `src/components/atoms/category-select.tsx`
**Type**: Atom
**Status**: ✅ Stable

## Overview

A reusable dropdown select component for choosing categories. Displays categories with their icons and names in a styled select interface using shadcn/ui's Select component.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `categories` | `Category[]` | Yes | - | Array of category objects to display |
| `value` | `string` | No | - | Currently selected category ID |
| `onValueChange` | `(value: string) => void` | Yes | - | Callback when selection changes |
| `placeholder` | `string` | No | `'Kategorie wählen'` | Placeholder text when no selection |
| `disabled` | `boolean` | No | `false` | Whether the select is disabled |

## Usage

```tsx
import { CategorySelect } from '@/components/atoms/category-select';
import type { Category } from '@/types/database';

function ExpenseForm({ categories }: { categories: Category[] }) {
  const [categoryId, setCategoryId] = useState<string>();

  return (
    <CategorySelect
      categories={categories}
      value={categoryId}
      onValueChange={setCategoryId}
      placeholder="Select a category"
    />
  );
}
```

## Features

- Displays category icons alongside names
- Shows empty state when no categories exist
- Forward ref support for form integration
- Fully typed with TypeScript

## Dependencies

- `react` (forwardRef)
- `@/components/ui/select` (Select, SelectContent, SelectItem, SelectTrigger, SelectValue)
- `@/types/database` (Category type)

## Related Components

- [CategoryForm](../molecules/category-form.md) - Form for creating categories
- [CategoryList](../organisms/category-list.md) - Category management list
- [ExpenseForm](../organisms/expense-form.md) - Uses CategorySelect for expense categorization
