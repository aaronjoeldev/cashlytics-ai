# Cashlytics Page Documentation

This directory contains comprehensive documentation for all pages and routes in the Cashlytics application.

## Application Overview

Cashlytics is a personal finance management application built with Next.js 14, featuring:
- Dashboard with financial KPIs and statistics
- Expense and income tracking (both periodic and one-time)
- Account management with balance forecasting
- Category-based expense organization
- Analytics with visual charts
- AI-powered financial assistant

## Navigation Structure

```
├── / (Root → redirects to /dashboard)
└── /dashboard          → Main dashboard with KPIs
    ├── /overview       → Monthly financial overview
    ├── /accounts       → Account management
    │   └── /[id]       → Account detail & forecast
    ├── /categories     → Category management
    ├── /expenses       → Expense management
    ├── /income         → Income management
    ├── /transfers      → Transfer management
    ├── /analytics      → Analytics with charts
    ├── /assistant      → AI financial assistant
    └── /settings       → Application settings
        └── /categories → Category settings (alternate)
```

## Documentation Files

| File | Description |
|------|-------------|
| [landing.md](./landing.md) | Root landing page documentation |
| [dashboard-layout.md](./dashboard-layout.md) | Dashboard layout structure |
| [dashboard.md](./dashboard.md) | Main dashboard page |
| [overview.md](./overview.md) | Monthly financial overview |
| [accounts.md](./accounts.md) | Account listing page |
| [account-detail.md](./account-detail.md) | Individual account detail page |
| [categories.md](./categories.md) | Category management |
| [expenses.md](./expenses.md) | Expense management |
| [income.md](./income.md) | Income management |
| [transfers.md](./transfers.md) | Transfer management |
| [analytics.md](./analytics.md) | Analytics dashboard |
| [assistant.md](./assistant.md) | AI assistant page |
| [settings.md](./settings.md) | Settings page |

## Architecture

### Server Components
All page files (`page.tsx`) are server components that:
- Fetch initial data via server actions
- Pass data to client components for interactivity

### Client Components
Interactive components (`client.tsx`) handle:
- User interactions and form submissions
- State management
- Real-time updates

### Server Actions
Located in `/src/actions/`, these handle all database operations.

## Key Features

- **Multi-currency support**: EUR, USD, GBP, DKK
- **Dark/Light theme**: Full theme support with system preference detection
- **Responsive design**: Mobile-first approach
- **Recurring transactions**: Support for daily, weekly, monthly, quarterly, yearly, and custom intervals
- **Financial forecasting**: Project account balances over time
