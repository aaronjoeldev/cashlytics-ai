# Assistant Page

**Route**: `/assistant`
**File**: `src/app/(dashboard)/assistant/page.tsx`

## Overview
The assistant page provides an AI-powered chat interface for financial assistance, allowing users to ask questions about their finances, get insights, and receive personalized recommendations.

## Features
- **Chat Interface**: Conversational UI for interacting with the AI assistant
- **Context-Aware**: The assistant has access to the user's financial data
- **Full-Height Layout**: Optimized for extended conversations

## Components Used
| Component | Purpose |
|-----------|---------|
| `ChatInterface` | Main chat component with message handling |

## Server Actions Used
| Action | Purpose |
|--------|---------|
| Actions defined in `conversation-actions.ts` | Handle chat messages and AI responses |

## Layout Structure
```
┌────────────────────────────────────────────┐
│                                            │
│                                            │
│          Chat Interface                    │
│          (Full Height)                     │
│                                            │
│                                            │
│                                            │
└────────────────────────────────────────────┘
```

## Styling
- Rounded container with border
- Semi-transparent background with backdrop blur
- Responsive height calculation: `calc(100vh - 7rem)`

## User Interactions
- Type messages to the AI assistant
- Receive financial advice and insights
- Ask questions about spending patterns
- Get recommendations for budgeting

## Related Pages
- [Dashboard](./dashboard.md) - Financial overview
- [Overview](./overview.md) - Detailed breakdown
- [Analytics](./analytics.md) - Visual insights
