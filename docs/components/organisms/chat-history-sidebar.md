# ChatHistorySidebar

**Path**: `src/components/organisms/chat-history-sidebar.tsx`
**Type**: Organism
**Status**: ✅ Stable

## Overview

A responsive sidebar for navigating chat conversation history. Adapts between a fixed sidebar on desktop and a slide-out sheet on mobile devices.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `conversations` | `Conversation[]` | Yes | - | List of conversations |
| `activeConversationId` | `string \| null` | Yes | - | Currently active conversation ID |
| `onSelectConversation` | `(id: string) => void` | Yes | - | Callback when conversation is selected |
| `onNewChat` | `() => void` | Yes | - | Callback to start new chat |
| `onDeleteConversation` | `(id: string) => void` | Yes | - | Callback to delete conversation |
| `isLoading` | `boolean` | No | `false` | Loading state for new chat button |

## Usage

```tsx
import { ChatHistorySidebar } from '@/components/organisms/chat-history-sidebar';

function ChatPage({ conversations }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <ChatHistorySidebar
      conversations={conversations}
      activeConversationId={activeId}
      onSelectConversation={setActiveId}
      onNewChat={() => setActiveId(null)}
      onDeleteConversation={handleDelete}
    />
  );
}
```

## Features

- Responsive design (sidebar on desktop, sheet on mobile)
- Active conversation highlighting with amber gradient
- Relative date formatting (Today, Yesterday, X days ago)
- Hover-reveal delete button
- New chat button with loading state
- Mobile sheet closes after selection
- Uses useIsMobile hook for responsive behavior

## Dependencies

- `react` (useState)
- `lucide-react` (Plus, Trash2, MessageSquare, Menu)
- `@/components/ui/button` (Button)
- `@/components/ui/sheet` (Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger)
- `@/lib/utils` (cn)
- `@/hooks/use-mobile` (useIsMobile)
- `@/types/database` (Conversation)

## Date Formatting

| Days Ago | Display |
|----------|---------|
| 0 | Heute (Today) |
| 1 | Gestern (Yesterday) |
| 2-6 | Vor X Tagen (X days ago) |
| 7+ | DD.MM. (localized date) |

## Related Components

- [ChatInterface](./chat-interface.md) - Uses this sidebar for navigation
- [ChatMessage](../molecules/chat-message.md) - Displays individual messages
