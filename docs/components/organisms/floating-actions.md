# FloatingActions

**Path**: `src/components/organisms/floating-actions.tsx`
**Type**: Organism
**Status**: ✅ Stable

## Overview

A floating action button (FAB) system with expandable speed dial menu for quick actions (expense, income, transfer, account creation) and an integrated quick chat panel for AI assistant access.

## Props

This component does not accept props. It manages its own state internally.

## Usage

```tsx
import { FloatingActions } from '@/components/organisms/floating-actions';

function AppLayout({ children }) {
  return (
    <>
      {children}
      <FloatingActions />
    </>
  );
}
```

## Features

### Speed Dial Menu
- Expandable FAB with rotation animation
- Four quick action buttons:
  - Expense (TrendingDown icon, amber)
  - Income (TrendingUp icon, emerald)
  - Transfer (ArrowRightLeft icon, violet)
  - Account (CreditCard icon, blue)
- Staggered animation on open
- Action labels displayed alongside buttons

### Quick Chat Panel
- Slide-in chat interface from bottom-right
- AI assistant with conversation history
- Quick prompt suggestions
- Link to full assistant page
- Uses AI SDK's useChat hook

### Smart Behavior
- Chat FAB hidden on /assistant page
- Data preloading when menu opens
- Form success callbacks for data refresh
- Accessible labels on all interactive elements

## Dependencies

- `react` (useState, useRef, useEffect)
- `@ai-sdk/react` (useChat)
- `next/navigation` (usePathname)
- `next/link` (Link)
- `lucide-react` (Plus, X, MessageSquare, CreditCard, ArrowRightLeft, TrendingUp, TrendingDown, ExternalLink, Send, Loader2, Bot)
- `@/components/ui/button` (Button)
- `@/components/ui/input` (Input)
- `@/lib/utils` (cn)
- `@/actions/account-actions` (getAccounts)
- `@/actions/category-actions` (getCategories)
- `@/components/molecules/chat-message` (ChatMessage, ChatMessageLoading)
- `@/components/organisms/expense-form` (ExpenseForm)
- `@/components/organisms/income-form` (IncomeForm)
- `@/components/organisms/account-form` (AccountForm)
- `@/components/organisms/transfer-form` (TransferForm)
- `@/types/database` (Account, Category)

## Related Components

- [ExpenseForm](./expense-form.md) - Opened via expense action
- [IncomeForm](./income-form.md) - Opened via income action
- [TransferForm](./transfer-form.md) - Opened via transfer action
- [AccountForm](./account-form.md) - Opened via account action
- [ChatMessage](../molecules/chat-message.md) - Displays messages in quick chat
