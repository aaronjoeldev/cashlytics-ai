# EmojiPicker

**Path**: `src/components/molecules/emoji-picker.tsx`
**Type**: Molecule
**Status**: ✅ Stable

## Overview

A popover-based emoji picker with categorized emoji groups relevant to financial tracking (food, transport, housing, shopping, health, leisure, finance, education, travel, family).

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `value` | `string` | Yes | - | Currently selected emoji |
| `onChange` | `(emoji: string) => void` | Yes | - | Callback when emoji is selected |

## Usage

```tsx
import { EmojiPicker } from '@/components/molecules/emoji-picker';

function CategoryForm() {
  const [emoji, setEmoji] = useState('');

  return (
    <EmojiPicker
      value={emoji}
      onChange={setEmoji}
    />
  );
}
```

## Features

- 11 themed emoji categories
- Scrollable popover with max height
- Preview of selected emoji in trigger button
- Auto-closes on selection
- Financial-use-case optimized emoji selection

## Dependencies

- `react` (useState)
- `lucide-react` (Smile)
- `@/components/ui/button` (Button)
- `@/components/ui/popover` (Popover, PopoverContent, PopoverTrigger)

## Emoji Categories

| Category | Example Emojis |
|----------|----------------|
| Essen & Trinken | 🍔, 🍕, 🍜, ☕, 🍺 |
| Transport | 🚗, 🚌, 🚇, ✈️, ⛽ |
| Haus & Wohnen | 🏠, 💡, 🛋️, 🔧 |
| Shopping | 🛒, 👗, 📱, 💻 |
| Gesundheit | 💊, 🏥, 💪, 🧘 |
| Freizeit | 🎬, 🎵, 🎮, ⚽ |
| Finanzen | 💰, 💳, 🏦, 📈 |
| Bildung | 📚, 🎓, ✏️, 💼 |
| Reisen | ✈️, 🏨, 🗺️, 🏝️ |
| Familie | 👶, 👨‍👩‍👧, 🐶, 🎂 |
| Standard | 📁, ✨, ⭐, 📌 |

## Related Components

- [CategoryForm](./category-form.md) - Uses EmojiPicker for icon selection
- [ExpenseForm](../organisms/expense-form.md) - Uses inline category creation with emoji
