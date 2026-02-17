# Dashboard Layout

**Route**: `/(dashboard)/*`
**File**: `src/app/(dashboard)/layout.tsx`

## Overview
The dashboard layout provides the shared structure for all authenticated pages, including the sidebar navigation, header, and floating action buttons.

## Features
- Responsive sidebar navigation with mobile support
- Global header with search, notifications, and theme toggle
- Ambient background effects (dark mode blobs, light mode grid)
- Toast notification system
- Floating action buttons

## Components Used
| Component | Purpose |
|-----------|---------|
| `SidebarProvider` | Context provider for sidebar state |
| `AppSidebar` | Main navigation sidebar |
| `SidebarInset` | Content container for sidebar layout |
| `Header` | Top navigation bar with search and controls |
| `FloatingActions` | Quick action buttons |
| `Toaster` | Toast notification container |

## Layout Structure
```
┌────────────────────────────────────────────┐
│  Header (search, notifications, theme)     │
├──────────┬─────────────────────────────────┤
│          │                                 │
│ Sidebar  │     Main Content Area           │
│ (nav)    │     (children)                  │
│          │                                 │
│          │                                 │
└──────────┴─────────────────────────────────┘
```

## Background Effects
### Light Mode
- Warm parchment background (#f9f7f4)
- Subtle grid overlay pattern

### Dark Mode
- Deep black background (#08080a)
- Animated ambient blob effects:
  - Primary amber glow (top-left)
  - Secondary glow (middle-right)
  - Tertiary warm glow (bottom-center)

## Related Pages
- [Dashboard](./dashboard.md)
- [All dashboard child pages](./README.md)
