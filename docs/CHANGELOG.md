# Changelog

All notable changes to Cashlytics will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive documentation structure
- API documentation for all server actions
- Component documentation (atoms, molecules, organisms)
- Page documentation for all routes
- Architecture documentation with database schema

## [0.1.0] - 2026-02-16

### Added

#### Core Features
- **Account Management**: Create, read, update, and delete financial accounts
  - Support for multiple account types: checking, savings, ETF portfolios
  - Account detail view with transaction history
  - Balance tracking and forecasting

- **Expense Tracking**: Full expense management system
  - Recurring expenses (daily, weekly, monthly, yearly)
  - One-time expenses
  - Category-based organization
  - Daily expense logging

- **Income Management**: Track all income sources
  - Recurring income with flexible schedules
  - Income categorization
  - Date range support for temporary income

- **Transfers**: Inter-account transfer functionality
  - Scheduled transfers
  - Transfer history
  - Account balance updates

- **Categories**: Expense and income categorization
  - Custom category creation
  - Icon selection with emoji picker
  - Category-based analytics

#### Analytics & Insights
- **Dashboard**: KPI overview with key financial metrics
- **Monthly Overview**: Detailed monthly breakdown
- **Analytics Charts**: Visual financial analytics
  - Category breakdown charts
  - Trend analysis
  - Income vs. expense comparison

- **Forecasting**: Account balance projections
  - Future balance predictions
  - Based on recurring transactions

#### AI Assistant
- **Chat Interface**: Conversational finance management
  - Natural language queries
  - 18 AI tools for financial operations
  - Conversation history
  - Context-aware responses

- **AI Tools**:
  - Account operations (create, update, delete, list)
  - Expense operations (create, update, delete, list)
  - Income operations (create, update, delete, list)
  - Transfer operations (create, delete, list)
  - Category operations (create, update, delete, list)
  - Analytics queries
  - Search functionality

#### User Interface
- **Dark/Light Mode**: Theme toggle with system preference detection
- **Responsive Design**: Mobile-friendly interface
- **Internationalization**: German and English support
- **Accessibility**: WCAG compliant components

#### Technical Implementation
- **Database**: PostgreSQL with Drizzle ORM
  - 8 tables: accounts, expenses, incomes, transfers, categories, daily_expenses, conversations, messages
  - Full-text search support
  - Optimized indexes

- **API**: Server Actions for data mutations
  - Type-safe with Zod validation
  - Optimistic updates
  - Error handling

- **UI Components**: shadcn/ui + Radix UI
  - Atomic design pattern
  - Reusable component library
  - Tailwind CSS styling

### Infrastructure
- **Framework**: Next.js 16.1.6 with App Router
- **Database**: PostgreSQL + Drizzle ORM
- **AI Integration**: Vercel AI SDK with OpenAI
- **Styling**: Tailwind CSS 4.x
- **Forms**: React Hook Form + Zod resolvers
- **Charts**: Recharts integration
- **i18n**: next-intl for translations

### Developer Experience
- **TypeScript**: Strict mode enabled
- **ESLint**: Next.js recommended rules
- **Semantic Release**: Automated versioning
- **Documentation**: Comprehensive code documentation

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 0.1.0 | 2026-02-16 | Initial release with core features |

---

**Format**: [Keep a Changelog](https://keepachangelog.com/)  
**Last Updated**: 2026-02-16
