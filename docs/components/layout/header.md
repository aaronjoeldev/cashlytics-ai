# Header

**Path**: `src/components/layout/header.tsx`
**Type**: Layout
**Status**: ✅ Stable

## Overview

The main application header component containing navigation elements, search functionality, notifications, theme toggle, and user avatar. Features keyboard shortcut for global search (⌘K / Ctrl+K).

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `title` | `string` | No | - | Page title to display in header |

## Usage

```tsx
import { Header } from '@/components/layout/header';

function DashboardPage() {
  return (
    <>
      <Header title="Dashboard" />
      <main>
        {/* Page content */}
      </main>
    </>
  );
}
```

## Features

- Sidebar toggle trigger
- Dynamic page title display
- Global search with keyboard shortcut (⌘K / Ctrl+K)
- Mobile-responsive search button
- Notification bell with animated indicator
- Theme toggle dropdown
- User avatar with hover effect
- Amber accent line (dark mode)
- Backdrop blur effect

## Dependencies

- `react` (useState, useEffect)
- `lucide-react` (Bell, Search)
- `next-intl` (useTranslations)
- `@/components/ui/button` (Button)
- `@/components/ui/input` (Input)
- `@/components/ui/sidebar` (SidebarTrigger)
- `@/components/ui/avatar` (Avatar, AvatarFallback)
- `@/components/ui/separator` (Separator)
- `@/components/layout/theme-toggle` (ThemeToggle)
- `@/components/molecules/search-dialog` (SearchDialog)

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` (Mac) | Open search dialog |
| `Ctrl+K` (Windows/Linux) | Open search dialog |

## Related Components

- [AppSidebar](./app-sidebar.md) - Main navigation sidebar
- [ThemeToggle](./theme-toggle.md) - Theme switcher in header
- [SearchDialog](../molecules/search-dialog.md) - Global search dialog
