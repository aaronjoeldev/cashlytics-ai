# Cashlytics Architecture

## Project Overview

Cashlytics is a personal finance management application built with Next.js. It provides comprehensive tools for tracking accounts, expenses, incomes, and transfers, along with an AI-powered financial assistant.

### Key Features

- **Account Management**: Multiple account types (checking, savings, ETF portfolios)
- **Expense Tracking**: Recurring and one-time expenses with categorization
- **Income Management**: Track various income sources with recurrence patterns
- **Transfer Handling**: Account-to-account transfers with scheduling
- **Analytics Dashboard**: Monthly overviews, forecasts, and category breakdowns
- **AI Assistant**: Conversational interface for managing finances
- **Multi-currency Support**: EUR, USD, GBP, CHF, DKK with conversion
- **Internationalization**: German and English language support

## Tech Stack

| Category | Technology | Version |
|----------|------------|---------|
| Framework | Next.js | 16.1.6 |
| Runtime | React | 19.2.3 |
| Language | TypeScript | 5.x |
| Database | PostgreSQL | - |
| ORM | Drizzle ORM | 0.45.1 |
| Styling | Tailwind CSS | 4.x |
| UI Components | Radix UI, shadcn/ui | - |
| AI SDK | Vercel AI SDK | 6.0.85 |
| Validation | Zod | 4.3.6 |
| Charts | Recharts | 3.7.0 |
| Forms | React Hook Form | 7.71.1 |
| i18n | next-intl | 4.8.2 |

## Folder Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (dashboard)/              # Dashboard route group
│   │   ├── overview/             # Overview page
│   │   ├── analytics/            # Analytics page
│   │   ├── accounts/             # Account management
│   │   │   └── [id]/             # Account detail pages
│   │   ├── expenses/             # Expense management
│   │   ├── income/               # Income management
│   │   ├── transfers/            # Transfer management
│   │   ├── categories/           # Category management
│   │   ├── assistant/            # AI assistant chat
│   │   ├── settings/             # Application settings
│   │   │   └── categories/       # Category settings
│   │   └── dashboard/            # Main dashboard
│   └── api/                      # API routes
│       └── chat/                 # Chat API endpoint
├── components/                   # React components
│   ├── atoms/                    # Basic UI elements
│   ├── molecules/                # Composite components
│   ├── organisms/                # Complex components
│   ├── templates/                # Page templates
│   ├── layout/                   # Layout components
│   ├── ui/                       # shadcn/ui components
│   └── providers/                # Context providers
├── lib/                          # Core libraries
│   ├── db/                       # Database configuration
│   │   ├── schema.ts             # Drizzle schema definitions
│   │   └── index.ts              # Database connection
│   ├── ai/                       # AI integration
│   │   └── tools.ts              # AI tool definitions
│   ├── validations/              # Form validation schemas
│   ├── validators/               # API input validators
│   ├── utils/                    # Utility functions
│   ├── currency.ts               # Currency utilities
│   ├── version.ts                # App version
│   └── settings-context.tsx      # Settings context
├── hooks/                        # Custom React hooks
│   ├── use-conversations.ts      # Chat management hook
│   ├── use-toast.ts              # Toast notifications
│   └── use-mobile.ts             # Mobile detection
├── actions/                      # Server actions
├── types/                        # TypeScript types
│   └── database.ts               # Database type definitions
└── i18n/                         # Internationalization
    └── config.ts                 # i18n configuration
```

## Architecture Patterns

### Component Architecture (Atomic Design)

- **Atoms**: Basic UI elements (buttons, inputs, icons)
- **Molecules**: Combinations of atoms (form fields, cards)
- **Organisms**: Complex components (forms, lists, charts)
- **Templates**: Page layouts
- **Pages**: Route components

### Data Flow

1. **Server Actions**: Handle data mutations
2. **Drizzle ORM**: Database interactions
3. **Zod Schemas**: Input validation
4. **React Hook Form**: Form state management
5. **TypeScript Types**: Type safety throughout

### State Management

- **Server State**: Managed via server actions and database
- **Client State**: React Context (settings, toast notifications)
- **Form State**: React Hook Form with Zod resolvers
- **Chat State**: Vercel AI SDK's `useChat` hook

## Configuration Files

| File | Purpose |
|------|---------|
| `next.config.ts` | Next.js configuration with next-intl plugin |
| `tsconfig.json` | TypeScript configuration |
| `drizzle.config.ts` | Drizzle ORM configuration |
| `components.json` | shadcn/ui configuration |
| `.env.example` | Environment variables template |
