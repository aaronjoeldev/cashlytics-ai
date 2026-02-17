# Settings Page

**Route**: `/settings`
**File**: `src/app/(dashboard)/settings/page.tsx`

## Overview
The settings page allows users to configure application preferences, including language and currency settings. It also provides navigation to data management features.

## Features
- **General Settings**:
  - Language selection (German, English)
  - Currency selection (EUR, USD, GBP, DKK)
- **Data Management**:
  - Link to category management
- **Client-Side Rendering**: Uses `'use client'` for interactive settings

## Components Used
| Component | Purpose |
|-----------|---------|
| `Card`, `CardHeader`, `CardContent` | Container components |
| `Label` | Form labels |
| `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` | Dropdown selectors |
| `Button` | Navigation buttons |
| `Tag`, `ChevronRight` | Navigation icons |
| `useTranslations` | Internationalization |
| `useSettings` | Settings context for locale/currency |

## Server Actions Used
| Action | Purpose |
|--------|---------|
| N/A | Settings are stored client-side via context |

## Settings Options

### Languages (Locales)
| Code | Name |
|------|------|
| `de` | Deutsch |
| `en` | English |

### Currencies
| Code | Description |
|------|-------------|
| `EUR` | Euro |
| `USD` | US Dollar |
| `GBP` | British Pound |
| `DKK` | Danish Krone |

## Data Management Links
| Link | Description |
|------|-------------|
| `/settings/categories` | Category management page |

## User Interactions
- Change application language
- Change display currency
- Navigate to category management
- Settings persist via cookies/local storage

## Related Pages
- [Categories](./categories.md) - Category management
- All pages - Affected by language/currency settings

## Settings Context
The `useSettings` hook provides:
- `locale`: Current language setting
- `setLocale`: Function to change language
- `currency`: Current currency setting
- `setCurrency`: Function to change currency
- `formatCurrency`: Function to format amounts with current currency
