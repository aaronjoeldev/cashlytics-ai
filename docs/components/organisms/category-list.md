# CategoryList

**Path**: `src/components/organisms/category-list.tsx`
**Type**: Organism
**Status**: ✅ Stable

## Overview

A full-featured category management component with CRUD operations. Displays categories in a styled list with edit/delete actions, includes a dialog form for creation/editing, and provides a confirmation dialog for deletion.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `initialCategories` | `Category[]` | Yes | - | Initial list of categories |

## Usage

```tsx
import { CategoryList } from '@/components/organisms/category-list';

async function CategoriesPage() {
  const categories = await getCategories();
  
  return (
    <CategoryList initialCategories={categories} />
  );
}
```

## Features

- Display categories with icons and colors
- Gradient backgrounds based on category color
- Create new category via dialog
- Edit existing categories
- Delete with confirmation dialog
- Add default categories button (when empty)
- Optimistic state updates
- Responsive hover effects

## Dependencies

- `react` (useState)
- `lucide-react` (Pencil, Trash2, Plus)
- `@/components/ui/button` (Button)
- `@/components/ui/card` (Card, CardContent, CardHeader, CardTitle)
- `@/components/ui/dialog` (Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger)
- `@/components/ui/alert-dialog` (AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle)
- `@/components/molecules/category-form` (CategoryForm)
- `@/actions/category-actions` (createCategory, updateCategory, deleteCategory)
- `@/lib/validations/category` (defaultCategories, CategoryInput)
- `@/types/database` (Category)

## Internal State

| State | Type | Description |
|-------|------|-------------|
| `categories` | `Category[]` | Current list of categories |
| `editingCategory` | `Category \| null` | Category being edited |
| `deleteId` | `string \| null` | ID of category to delete |
| `isDialogOpen` | `boolean` | Dialog visibility |

## Related Components

- [CategoryForm](../molecules/category-form.md) - Form used in dialog
- [CategorySelect](../atoms/category-select.md) - Select component for categories
- [ExpenseForm](./expense-form.md) - Uses categories for expense assignment
