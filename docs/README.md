# Cashlytics Documentation

Welcome to the **Cashlytics** documentation. Cashlytics is a personal finance management application with AI-powered assistance.

## Quick Navigation

| Section | Description |
|---------|-------------|
| [Architecture](./architecture/) | Tech stack, database schema, project structure |
| [API](./api/) | Server actions and API routes |
| [Components](./components/) | React component documentation |
| [Pages](./pages/) | Page routes and features |
| [Guides](./guides/) | Development and deployment guides |

## Documentation Structure

```
docs/
├── README.md                    # This file
├── CHANGELOG.md                 # Version history
│
├── architecture/                # System Architecture
│   ├── README.md               # Project overview & folder structure
│   ├── database-schema.md      # Drizzle schema documentation
│   ├── tech-stack.md           # Framework & dependency details
│   ├── validations.md          # Zod validation schemas
│   ├── ai-integration.md       # AI tools and chat assistant
│   ├── hooks.md                # Custom React hooks
│   └── utils.md                # Utility functions
│
├── api/                        # API & Server Actions
│   ├── README.md               # API architecture overview
│   ├── expenses.md             # Expense CRUD operations
│   ├── incomes.md              # Income management
│   ├── accounts.md             # Account management
│   ├── categories.md           # Category operations
│   ├── transfers.md            # Transfer operations
│   ├── analytics.md            # Analytics data fetching
│   ├── dashboard.md            # Dashboard statistics
│   ├── forecast.md             # Balance forecasting
│   ├── chat-assistant.md       # AI chat API & conversations
│   └── search.md               # Global search functionality
│
├── components/                 # React Components
│   ├── README.md               # Component hierarchy overview
│   ├── atoms/                  # Basic UI elements
│   ├── molecules/              # Composite components
│   ├── organisms/              # Complex components
│   ├── layout/                 # Layout components
│   └── providers/              # Context providers
│
├── pages/                      # Page Documentation
│   ├── README.md               # Navigation overview
│   ├── landing.md              # Landing page
│   ├── dashboard-layout.md     # Shared layout
│   ├── dashboard.md            # Main dashboard
│   ├── overview.md             # Monthly overview
│   ├── accounts.md             # Account listing
│   ├── account-detail.md       # Account detail with forecast
│   ├── categories.md           # Category management
│   ├── expenses.md             # Expense tracking
│   ├── income.md               # Income tracking
│   ├── transfers.md            # Transfer management
│   ├── analytics.md            # Analytics dashboard
│   ├── assistant.md            # AI assistant
│   └── settings.md             # Application settings
│
└── guides/                     # Development Guides
    ├── getting-started.md      # Setup instructions
    └── development.md          # Development workflow
```

## Key Features

| Feature | Description | Documentation |
|---------|-------------|---------------|
| **Account Management** | Multiple account types (checking, savings, ETF) | [Accounts API](./api/accounts.md) |
| **Expense Tracking** | Recurring and one-time expenses | [Expenses API](./api/expenses.md) |
| **Income Management** | Track income sources with recurrence | [Incomes API](./api/incomes.md) |
| **Transfers** | Account-to-account transfers | [Transfers API](./api/transfers.md) |
| **Categories** | Organize expenses by category | [Categories API](./api/categories.md) |
| **Analytics** | Charts and financial insights | [Analytics API](./api/analytics.md) |
| **Forecasting** | Balance projections | [Forecast API](./api/forecast.md) |
| **AI Assistant** | Conversational finance management | [Chat Assistant](./api/chat-assistant.md) |
| **Search** | Global search across entities | [Search API](./api/search.md) |

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16.1.6 |
| Runtime | React 19.2.3 |
| Language | TypeScript 5.x |
| Database | PostgreSQL |
| ORM | Drizzle ORM 0.45.1 |
| Styling | Tailwind CSS 4.x |
| UI Components | Radix UI, shadcn/ui |
| AI SDK | Vercel AI SDK 6.0.85 |
| Validation | Zod 4.3.6 |
| Charts | Recharts 3.7.0 |
| Forms | React Hook Form 7.71.1 |
| i18n | next-intl 4.8.2 |

## Getting Started

1. **Clone the repository**
2. **Install dependencies**: `npm install`
3. **Set up environment variables**: Copy `.env.example` to `.env`
4. **Run database migrations**: `npm run db:push`
5. **Start development server**: `npm run dev`

For detailed setup instructions, see [Getting Started Guide](./guides/getting-started.md).

## Contributing

When contributing to the codebase:

1. Follow the existing component architecture (Atomic Design)
2. Use Server Actions for data mutations
3. Validate all inputs with Zod schemas
4. Update documentation when adding new features
5. Maintain TypeScript strict mode compliance

## Version

| Version | Date | Notes |
|---------|------|-------|
| 0.1.0 | 2026-02-16 | Initial documentation release |

---

**Last Updated**: 2026-02-16  
**Maintainer**: Cashlytics Team
