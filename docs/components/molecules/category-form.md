# CategoryForm

**Path**: `src/components/molecules/category-form.tsx`
**Type**: Molecule
**Status**: ✅ Stable

## Overview

A form component for creating and editing expense/income categories. Includes name input, emoji icon selection via EmojiPicker, and color selection with both preset and custom color options.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `category` | `Category` | No | - | Existing category to edit (omit for create mode) |
| `onSubmit` | `(data: CategoryInput) => Promise<void>` | Yes | - | Callback with form data on submit |
| `onCancel` | `() => void` | No | - | Callback when cancel button is clicked |

## Usage

```tsx
import { CategoryForm } from '@/components/molecules/category-form';
import type { Category } from '@/types/database';
import type { CategoryInput } from '@/lib/validations/category';

function CategoryDialog({ category }: { category?: Category }) {
  const handleSubmit = async (data: CategoryInput) => {
    await createCategory(data);
  };

  return (
    <CategoryForm
      category={category}
      onSubmit={handleSubmit}
      onCancel={() => console.log('cancelled')}
    />
  );
}
```

## Features

- Zod schema validation for form data
- Emoji icon selection via EmojiPicker
- 17 preset colors + custom color picker
- Live color preview
- Edit mode support (populates form with existing data)
- Submit loading state
- Cancel button (conditionally rendered)

## Dependencies

- `react` (useState)
- `react-hook-form` (useForm, handleSubmit)
- `@hookform/resolvers/zod` (zodResolver)
- `@/lib/validations/category` (categorySchema, CategoryInput)
- `@/components/ui/button` (Button)
- `@/components/ui/input` (Input)
- `@/components/ui/label` (Label)
- `@/components/molecules/emoji-picker` (EmojiPicker)
- `@/types/database` (Category)

## Form Data Structure

```typescript
interface CategoryInput {
  name: string;
  icon?: string;
  color?: string;
}
```

## Related Components

- [EmojiPicker](./emoji-picker.md) - Used for icon selection
- [CategoryList](../organisms/category-list.md) - Contains this form in a dialog
- [CategorySelect](../atoms/category-select.md) - Select component for categories
