# Categories Page

**Route**: `/categories`
**File**: `src/app/(dashboard)/categories/page.tsx`
**Client Component**: `src/app/(dashboard)/categories/client.tsx`

## Overview
The categories page allows users to manage expense categories, which are used to organize and classify spending. Categories support custom names, icons (emoji), and colors.

## Features
- **Category List**: Display all categories with icons and colors
- **Create Category**: Modal form to add new categories
- **Edit Category**: Modify existing category details
- **Delete Category**: Remove categories with confirmation
- **Default Categories**: One-click addition of predefined categories
- **Visual Styling**: Categories display with gradient backgrounds based on their color

## Components Used
| Component | Purpose |
|-----------|---------|
| `Card`, `CardHeader`, `CardContent` | Container components |
| `Button` | Action buttons |
| `Dialog` | Modal for create/edit form |
| `AlertDialog` | Delete confirmation dialog |
| `CategoryForm` | Form for category input |
| `FolderOpen`, `Plus`, `Pencil`, `Trash2` | Action icons |
| `useToast` | Toast notifications |

## Server Actions Used
| Action | Purpose |
|--------|---------|
| `getCategories` | Fetches all categories |
| `createCategory` | Creates a new category |
| `updateCategory` | Updates existing category |
| `deleteCategory` | Deletes a category |

## Default Categories
The application provides default categories for quick setup:
- Various common expense categories with predefined icons and colors

## Data Structures

### Category
```typescript
interface Category {
  id: string;
  name: string;
  icon: string | null;    // Emoji icon
  color: string | null;   // Hex color code
  createdAt: Date;
  updatedAt: Date;
}
```

### CategoryInput (Form)
```typescript
interface CategoryInput {
  name: string;
  icon?: string;
  color?: string;
}
```

## User Interactions
- View all categories in a grid/list layout
- Add new category via modal form
- Edit existing category details
- Delete category with confirmation
- Add all default categories at once
- See category creation date

## Related Pages
- [Expenses](./expenses.md) - Categories used for expense classification
- [Settings Categories](./settings.md) - Alternate category management route
