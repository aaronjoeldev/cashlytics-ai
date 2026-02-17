# ThemeProvider

**Path**: `src/components/providers/theme-provider.tsx`
**Type**: Provider
**Status**: ✅ Stable

## Overview

A wrapper component around next-themes' ThemeProvider that enables theme switching throughout the application. Must be placed at the root level of the component tree.

## Props

Accepts all props from `next-themes` ThemeProvider:

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `children` | `React.ReactNode` | Yes | - | Child components |
| `attribute` | `string` | No | - | HTML attribute for theme (e.g., 'class') |
| `defaultTheme` | `string` | No | - | Default theme name |
| `enableSystem` | `boolean` | No | `false` | Enable system preference detection |
| `disableTransitionOnChange` | `boolean` | No | `false` | Disable CSS transitions on theme change |

## Usage

```tsx
import { ThemeProvider } from '@/components/providers/theme-provider';

function App({ children }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
```

## Features

- Wraps next-themes ThemeProvider
- Supports light, dark, and system themes
- Class-based theme attribute (Tailwind CSS compatible)
- System preference detection
- No transition flash on theme change

## Dependencies

- `react`
- `next-themes` (ThemeProvider as NextThemesProvider)

## Configuration in Cashlytics

The main Providers component configures ThemeProvider with:

```tsx
<ThemeProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  disableTransitionOnChange
>
```

## Related Components

- [ThemeToggle](../layout/theme-toggle.md) - UI component for theme switching
- [Providers](./index.md) - Main provider wrapper that includes ThemeProvider
