# Categories API

This document covers category-related server actions for expense categorization.

## File

**Path**: `src/actions/category-actions.ts`  
**Type**: Server Action

---

## Overview

Categories are used to group and classify expenses. Each category can have a name, icon, and color for visual representation in the UI.

### Functions

#### getCategories

Retrieves all categories sorted alphabetically by name.

**Parameters**: None

**Returns**: `ApiResponse<Category[]>`

```typescript
type Category = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  createdAt: Date;
};
```

**Example Usage**:
```typescript
const result = await getCategories();

if (result.success) {
  result.data.forEach(category => {
    console.log(`${category.icon ?? ''} ${category.name}`);
  });
}
```

**Error Handling**: Returns `{ success: false, error: 'Failed to fetch categories' }`

---

#### createCategory

Creates a new category.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data.name` | `string` | Yes | Category name |
| `data.icon` | `string \| null` | No | Emoji or icon identifier |
| `data.color` | `string \| null` | No | Color hex code or name |

**Returns**: `ApiResponse<Category>`

**Example Usage**:
```typescript
const result = await createCategory({
  name: 'Groceries',
  icon: '🛒',
  color: '#4CAF50'
});
```

**Error Handling**: Returns `{ success: false, error: 'Failed to create category' }`

---

#### updateCategory

Updates an existing category.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Category ID to update |
| `data` | `Partial<NewCategory>` | Yes | Fields to update |

**Returns**: `ApiResponse<Category>`

**Example Usage**:
```typescript
const result = await updateCategory('cat-123', {
  icon: '🛍️',
  color: '#FF5722'
});
```

**Error Handling**: Returns `{ success: false, error: 'Category not found' }` if not found.

---

#### deleteCategory

Deletes a category.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Category ID to delete |

**Returns**: `ApiResponse<void>`

**Example Usage**:
```typescript
const result = await deleteCategory('cat-123');
```

**Error Handling**: Returns `{ success: false, error: 'Failed to delete category' }`

---

## Type Definitions

```typescript
// From types/database.ts
type Category = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  createdAt: Date;
};

type NewCategory = {
  name: string;
  icon?: string | null;
  color?: string | null;
};
```

## Revalidation

Category mutations trigger cache revalidation for:
- `/settings`
- `/settings/categories`
- `/categories`
- `/expenses`

## Usage Patterns

### Creating Common Categories

```typescript
const categories = [
  { name: 'Food & Dining', icon: '🍽️', color: '#FF9800' },
  { name: 'Transportation', icon: '🚗', color: '#2196F3' },
  { name: 'Shopping', icon: '🛍️', color: '#E91E63' },
  { name: 'Entertainment', icon: '🎬', color: '#9C27B0' },
  { name: 'Bills & Utilities', icon: '📄', color: '#607D8B' },
  { name: 'Health', icon: '💊', color: '#4CAF50' },
  { name: 'Housing', icon: '🏠', color: '#795548' },
];

for (const cat of categories) {
  await createCategory(cat);
}
```

### Using Categories with Expenses

```typescript
// Get categories for dropdown
const categoriesResult = await getCategories();

if (categoriesResult.success) {
  const foodCategory = categoriesResult.data.find(c => c.name === 'Food & Dining');
  
  if (foodCategory) {
    await createDailyExpense({
      accountId: 'acc-123',
      categoryId: foodCategory.id,
      description: 'Restaurant dinner',
      amount: 45.00,
      date: new Date()
    });
  }
}
```
