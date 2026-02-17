# Custom Hooks

## Overview

Cashlytics provides several custom React hooks for common functionality.

---

## useConversations

**Location**: `src/hooks/use-conversations.ts`

Manages AI chat conversations, including loading, creating, and switching between conversations.

### Return Type

```typescript
interface UseConversationsReturn {
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoadingConversations: boolean;
  loadConversations: () => Promise<ApiResponse<Conversation[]>>;
  selectConversation: (id: string) => Promise<void>;
  startNewChat: () => Promise<void>;
  deleteConversationWithSwitch: (id: string) => Promise<void>;
  messages: Message[];
  sendMessage: (message: string) => void;
  status: 'idle' | 'loading' | 'error';
  error: Error | null;
  setMessages: (messages: Message[]) => void;
}
```

### Usage

```typescript
import { useConversations } from '@/hooks/use-conversations';

function ChatComponent() {
  const {
    conversations,
    activeConversationId,
    messages,
    sendMessage,
    status,
    selectConversation,
    startNewChat,
    deleteConversationWithSwitch,
  } = useConversations();

  return (
    <div>
      <ConversationList
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={selectConversation}
        onDelete={deleteConversationWithSwitch}
      />
      <MessageList messages={messages} />
      <ChatInput onSend={sendMessage} isLoading={status === 'loading'} />
      <NewChatButton onClick={startNewChat} />
    </div>
  );
}
```

### Features

- **Auto-initialization**: Loads conversations on mount
- **Auto-create**: Creates new chat if no conversations exist
- **Auto-switch**: Switches to first conversation when active is deleted
- **Message persistence**: Saves messages to database via `onFinish` callback
- **Title generation**: Auto-updates conversation title from first message

### Internal Flow

1. On mount, calls `loadConversations()`
2. If conversations exist, selects the first one
3. If no conversations, creates a new one
4. Messages are synced with Vercel AI SDK's `useChat`
5. On message completion, saves to database

---

## useToast

**Location**: `src/hooks/use-toast.ts`

Toast notification system for displaying transient messages.

### Return Type

```typescript
interface UseToastReturn {
  toasts: ToasterToast[];
  toast: (props: Toast) => { id: string; dismiss: () => void; update: (props: ToasterToast) => void };
  dismiss: (toastId?: string) => void;
}

interface ToasterToast extends ToastProps {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
}
```

### Usage

```typescript
import { useToast } from '@/hooks/use-toast';

function MyComponent() {
  const { toast } = useToast();

  const handleSuccess = () => {
    toast({
      title: 'Success',
      description: 'Operation completed successfully',
    });
  };

  const handleError = () => {
    toast({
      title: 'Error',
      description: 'Something went wrong',
      variant: 'destructive',
    });
  };

  return <button onClick={handleSuccess}>Do something</button>;
}
```

### Features

- **Limit**: Only 1 toast visible at a time (configurable via `TOAST_LIMIT`)
- **Auto-dismiss**: Toasts are queued for removal
- **Update support**: Can update existing toast content
- **Manual dismiss**: Can programmatically dismiss toasts

### Direct toast() Function

Can also be called directly without the hook:

```typescript
import { toast } from '@/hooks/use-toast';

toast({ title: 'Quick notification' });
```

---

## useIsMobile

**Location**: `src/hooks/use-mobile.ts`

Detects if the viewport is mobile-sized.

### Return Type

```typescript
(): boolean  // Returns true if viewport < 768px
```

### Usage

```typescript
import { useIsMobile } from '@/hooks/use-mobile';

function ResponsiveComponent() {
  const isMobile = useIsMobile();

  return (
    <div>
      {isMobile ? <MobileNav /> : <DesktopNav />}
    </div>
  );
}
```

### Features

- **Breakpoint**: 768px (tablet/mobile boundary)
- **Responsive**: Updates on window resize
- **SSR-safe**: Returns `undefined` initially, then `boolean` after hydration

### Implementation

```typescript
const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener('change', onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return !!isMobile;
}
```

---

## useSettings

**Location**: `src/lib/settings-context.tsx`

Context-based hook for managing user preferences.

### Return Type

```typescript
interface SettingsContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  formatCurrency: (amount: number) => string;
}
```

### Usage

```typescript
import { useSettings } from '@/lib/settings-context';

function PriceDisplay({ amount }: { amount: number }) {
  const { formatCurrency, currency } = useSettings();

  return <span>{formatCurrency(amount)}</span>;
}

function SettingsForm() {
  const { locale, setLocale, currency, setCurrency } = useSettings();

  return (
    <form>
      <Select value={locale} onChange={setLocale}>
        <option value="de">Deutsch</option>
        <option value="en">English</option>
      </Select>
      <Select value={currency} onChange={setCurrency}>
        <option value="EUR">EUR</option>
        <option value="USD">USD</option>
        {/* ... */}
      </Select>
    </form>
  );
}
```

### Features

- **Cookie persistence**: Settings saved to cookies
- **Currency formatting**: Locale-aware currency display
- **Page reload on locale change**: Ensures i18n is updated

### Provider Setup

```typescript
import { SettingsProvider } from '@/lib/settings-context';

function App({ children }) {
  return (
    <SettingsProvider initialLocale="de" initialCurrency="EUR">
      {children}
    </SettingsProvider>
  );
}
```

---

## Hook Summary Table

| Hook | Purpose | Returns |
|------|---------|---------|
| `useConversations` | AI chat management | Conversation state + actions |
| `useToast` | Toast notifications | Toast queue + show/dismiss |
| `useIsMobile` | Mobile detection | Boolean |
| `useSettings` | User preferences | Locale, currency, formatter |
