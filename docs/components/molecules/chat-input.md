# ChatInput

**Path**: `src/components/molecules/chat-input.tsx`
**Type**: Molecule
**Status**: ✅ Stable

## Overview

A chat input component with text field and submit button. Handles keyboard submission (Enter key), loading states, and responsive layout for mobile and desktop.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `input` | `string` | Yes | - | Current input value |
| `isLoading` | `boolean` | Yes | - | Whether a message is being sent |
| `onInputChange` | `(value: string) => void` | Yes | - | Callback when input value changes |
| `onSubmit` | `() => void` | Yes | - | Callback when message is submitted |
| `className` | `string` | No | - | Additional CSS classes |

## Usage

```tsx
import { ChatInput } from '@/components/molecules/chat-input';

function ChatContainer() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
    await sendMessage(input);
    setInput('');
    setIsLoading(false);
  };

  return (
    <ChatInput
      input={input}
      isLoading={isLoading}
      onInputChange={setInput}
      onSubmit={handleSubmit}
    />
  );
}
```

## Features

- Enter key submission (without Shift)
- Loading spinner indicator during submission
- Disabled state when empty or loading
- Responsive layout (full-width button on mobile)
- Auto-focus on input
- Accessibility labels

## Dependencies

- `lucide-react` (Send, Loader2)
- `@/components/ui/button` (Button)
- `@/components/ui/input` (Input)
- `@/lib/utils` (cn)

## Related Components

- [ChatMessage](./chat-message.md) - Displays chat messages
- [ChatInterface](../organisms/chat-interface.md) - Full chat interface using ChatInput
