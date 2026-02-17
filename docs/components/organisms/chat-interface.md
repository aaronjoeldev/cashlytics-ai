# ChatInterface

**Path**: `src/components/organisms/chat-interface.tsx`
**Type**: Organism
**Status**: ✅ Stable

## Overview

The complete chat interface for interacting with the AI financial assistant. Includes conversation history sidebar, message display, input handling, and suggested prompts for new users.

## Props

This component does not accept props. It uses the `useConversations` hook for state management.

## Usage

```tsx
import { ChatInterface } from '@/components/organisms/chat-interface';

function AssistantPage() {
  return (
    <div className="h-screen">
      <ChatInterface />
    </div>
  );
}
```

## Features

- Full conversation history management via `useConversations` hook
- Welcome message with usage instructions
- Suggested prompts for quick start:
  - "Wie sieht mein Budget aus?"
  - "Ich habe 45€ bei REWE ausgegeben"
  - "Zeige meine Ausgaben diesen Monat"
- AI SDK integration for streaming responses
- Loading state with animated indicator
- Error handling with retry functionality
- Auto-scroll to latest message
- Responsive sidebar (collapsible on mobile)

## Dependencies

- `react` (useRef, useEffect, useState)
- `lucide-react` (MessageSquare, RefreshCw, Sparkles)
- `@/components/ui/button` (Button)
- `@/components/ui/card` (Card)
- `@/components/molecules/chat-message` (ChatMessage, ChatMessageLoading)
- `@/components/molecules/chat-input` (ChatInput)
- `@/components/organisms/chat-history-sidebar` (ChatHistorySidebar)
- `@/hooks/use-conversations` (useConversations)

## Hook: useConversations

The component relies on the `useConversations` hook which provides:

| Property | Type | Description |
|----------|------|-------------|
| `conversations` | `Conversation[]` | List of all conversations |
| `activeConversationId` | `string \| null` | Current conversation ID |
| `isLoadingConversations` | `boolean` | Loading state for conversations |
| `selectConversation` | `(id: string) => void` | Switch to a conversation |
| `startNewChat` | `() => void` | Start a new conversation |
| `deleteConversationWithSwitch` | `(id: string) => void` | Delete and switch conversation |
| `messages` | `UIMessage[]` | Current conversation messages |
| `sendMessage` | `(msg: { text: string }) => void` | Send a message |
| `status` | `string` | AI SDK status |
| `error` | `Error \| null` | Any error that occurred |

## Welcome Message

The default welcome message includes:
- Introduction as Cashlytics Assistant
- Quick command examples
- Prompt for user input

## Related Components

- [ChatHistorySidebar](./chat-history-sidebar.md) - Conversation navigation
- [ChatMessage](../molecules/chat-message.md) - Message display
- [ChatInput](../molecules/chat-input.md) - Message input
