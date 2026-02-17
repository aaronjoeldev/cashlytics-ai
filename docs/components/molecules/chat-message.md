# ChatMessage

**Path**: `src/components/molecules/chat-message.tsx`
**Type**: Molecule
**Status**: ✅ Stable

## Overview

Components for displaying chat messages between user and AI assistant. Includes support for markdown formatting, loading states, and different variants for full AI SDK integration and simple usage.

## Exports

### ChatMessage

Main message display component using AI SDK's UIMessage type.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `message` | `UIMessage` | Yes | Message object from AI SDK |

### ChatMessageSimple

Simplified message component for basic usage.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `role` | `'user' \| 'assistant'` | Yes | - | Message sender role |
| `content` | `string` | Yes | - | Message text content |
| `isLoading` | `boolean` | No | `false` | Shows loading animation |

### ChatMessageLoading

Standalone loading indicator component with bouncing dots animation. Takes no props.

## Usage

```tsx
import { ChatMessage, ChatMessageSimple, ChatMessageLoading } from '@/components/molecules/chat-message';

// With AI SDK
<ChatMessage message={uiMessage} />

// Simple usage
<ChatMessageSimple role="user" content="Hello!" />
<ChatMessageSimple role="assistant" content="Hi there!" />

// Loading state
{isLoading && <ChatMessageLoading />}
```

## Features

- Differentiated styling for user vs assistant messages
- User messages: amber gradient background
- Assistant messages: card background
- Basic markdown formatting:
  - Bold text (`**text**`)
  - Bullet points
- Avatar icons (User/Bot)
- Bouncing dots loading animation
- Auto text wrapping

## Dependencies

- `react`
- `lucide-react` (User, Bot)
- `ai` (UIMessage, isTextUIPart)
- `@/lib/utils` (cn)
- `@/components/ui/card` (Card)

## Related Components

- [ChatInput](./chat-input.md) - Input component for chat
- [ChatInterface](../organisms/chat-interface.md) - Full chat interface
- [FloatingActions](../organisms/floating-actions.md) - Contains quick chat panel
