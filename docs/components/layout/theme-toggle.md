# ThemeToggle

**Path**: `src/components/layout/theme-toggle.tsx`
**Type**: Layout
**Status**: ✅ Stable

## Overview

A dropdown menu component for switching between light, dark, and system theme preferences. Uses next-themes for theme management.

## Props

This component does not accept props. It uses the `useTheme` hook from next-themes.

## Usage

```tsx
import { ThemeToggle } from '@/components/layout/theme-toggle';

function Header() {
  return (
    <header>
      <ThemeToggle />
    </header>
  );
}
```

## Features

- Three theme options:
  - Hell (Light)
  - Dunkel (Dark)
  - System (follows OS preference)
- Animated sun/moon icon toggle
- Dropdown menu interface
- Accessible with screen reader label

## Dependencies

- `react`
- `lucide-react` (Moon, Sun)
- `next-themes` (useTheme)
- `@/components/ui/button` (Button)
- `@/components/ui/dropdown-menu` (DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger)

## Theme Options

| Option | Value | Description |
|--------|-------|-------------|
| Hell | `light` | Light theme |
| Dunkel | `dark` | Dark theme |
| System | `system` | Follows system preference |

## Related Components

- [ThemeProvider](../providers/theme-provider.md) - Context provider for themes
- [Header](./header.md) - Contains ThemeToggle
