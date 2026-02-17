# Accounts Page

**Route**: `/accounts`
**File**: `src/app/(dashboard)/accounts/page.tsx`
**Client Component**: `src/app/(dashboard)/accounts/client.tsx`

## Overview
The accounts page displays all user bank accounts and investment portfolios, showing balances, account types, and providing quick access to account details and management functions.

## Features
- **Total Assets Display**: Sum of all account balances
- **Account Cards**: Visual cards for each account showing:
  - Account name and type
  - Current balance (color-coded: green for positive, red for negative)
  - Quick edit/delete actions
- **Inline Balance Editing**: Edit account balance directly from the card
- **Add New Account**: Modal form for creating new accounts
- **Account Type Icons**: Different icons for checking, savings, and ETF accounts

## Components Used
| Component | Purpose |
|-----------|---------|
| `Card`, `CardHeader`, `CardContent` | Account card containers |
| `Button` | Action buttons for edit/delete |
| `AccountForm` | Modal form for creating accounts |
| `Building2`, `PiggyBank`, `TrendingUp` | Account type icons |
| `Trash2`, `Pencil`, `ChevronRight` | Action icons |
| `useToast` | Toast notifications |
| `useSettings` | Currency formatting |

## Server Actions Used
| Action | Purpose |
|--------|---------|
| `getAccounts` | Fetches all user accounts |
| `deleteAccount` | Deletes an account and its transactions |
| `updateAccount` | Updates account balance |

## Account Types
| Type | Label (DE) | Icon | Color |
|------|------------|------|-------|
| `checking` | Girokonto | Building2 | Blue |
| `savings` | Sparkonto | PiggyBank | Emerald |
| `etf` | ETF-Konto | TrendingUp | Purple |

## Data Structures

### Account
```typescript
interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'etf';
  balance: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## User Interactions
- View all accounts with balances
- Click account card to view detailed transactions
- Edit account balance inline
- Delete account (with confirmation)
- Create new account via modal form

## Related Pages
- [Account Detail](./account-detail.md) - Individual account view
- [Dashboard](./dashboard.md) - Total assets overview
- [Transfers](./transfers.md) - Transfer between accounts
