# AppSidebar

**Path**: `src/components/layout/app-sidebar.tsx`
**Type**: Layout
**Status**: ✅ Stable

## Overview

The main application navigation sidebar with brand header, navigation items, and footer tools. Features active state highlighting with amber accents and responsive mobile support.

## Props

This component does not accept props. It uses Next.js routing for active state detection.

## Usage

```tsx
import { AppSidebar } from '@/components/layout/app-sidebar';

function AppLayout({ children }) {
  return (
    <div className="flex h-screen">
      <AppSidebar />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
```

## Features

- Brand logo with hover animation
- Navigation items with active state highlighting
- Two navigation sections:
  - Main navigation (Dashboard, Overview, Expenses, etc.)
  - Tools section (Settings, Assistant)
- Version badge display
- Mobile-friendly (auto-closes on navigation)
- Amber gradient active state styling
- Custom fonts (Syne for brand, Jakarta for nav)

## Dependencies

- `react` (useEffect)
- `next/link` (Link)
- `next/navigation` (usePathname)
- `next-intl` (useTranslations)
- `lucide-react` (LayoutDashboard, PieChart, Wallet, TrendingUp, Building2, Target, Settings, Bot, ChevronRight, ArrowRightLeft, FolderOpen)
- `@/components/ui/sidebar` (Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar)
- `@/lib/version` (APP_VERSION)
- `@/lib/utils` (cn)

## Navigation Items

### Main Navigation

| Item | Icon | Path |
|------|------|------|
| Dashboard | LayoutDashboard | /dashboard |
| Overview | PieChart | /overview |
| Expenses | Wallet | /expenses |
| Income | TrendingUp | /income |
| Transfers | ArrowRightLeft | /transfers |
| Categories | FolderOpen | /categories |
| Accounts | Building2 | /accounts |
| Analytics | PieChart | /analytics |
| Goals | Target | /goals |

### Tools Section

| Item | Icon | Path |
|------|------|------|
| Settings | Settings | /settings |
| Assistant | Bot | /assistant |

## Related Components

- [Header](./header.md) - Header component
- [ThemeToggle](./theme-toggle.md) - Theme switcher
