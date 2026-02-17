# Transfers Page

**Route**: `/transfers`
**File**: `src/app/(dashboard)/transfers/page.tsx`
**Client Component**: `src/app/(dashboard)/transfers/client.tsx`

## Overview
The transfers page manages money movements between accounts, such as savings transfers, investment contributions, or any internal fund transfers.

## Features
- **Summary Card**: Shows total monthly recurring transfers
- **Transfer Sections**:
  - **Recurring Transfers**: Regular scheduled transfers (monthly, quarterly, yearly)
  - **One-time Transfers**: Single scheduled transfers
- **Transfer Details**: Each transfer shows:
  - Source and target accounts
  - Recurrence type
  - Execution schedule (e.g., "every 15th")
  - Amount and start/end dates
- **CRUD Operations**: Create and delete transfers

## Components Used
| Component | Purpose |
|-----------|---------|
| `Card`, `CardHeader`, `CardContent` | Container components |
| `Button` | Action buttons |
| `TransferForm` | Form for creating transfers |
| `ArrowRightLeft`, `Repeat`, `CalendarDays`, `Trash2` | Action and indicator icons |
| `useToast` | Toast notifications |
| `useSettings` | Currency formatting |

## Server Actions Used
| Action | Purpose |
|--------|---------|
| `getAccounts` | Fetches accounts for transfer selection |
| `getTransfers` | Gets all transfer entries |
| `deleteTransfer` | Deletes a transfer |

## Recurrence Types
| Type | Label (DE) |
|------|------------|
| `once` | Einmalig |
| `monthly` | Monatlich |
| `quarterly` | Quartalsweise |
| `yearly` | Jährlich |

## Data Structures

### TransferWithDetails
```typescript
interface TransferWithDetails {
  id: string;
  description: string | null;
  amount: string;
  startDate: Date | string;
  endDate: Date | string | null;
  recurrenceType: 'once' | 'monthly' | 'quarterly' | 'yearly';
  sourceAccountId: string;
  targetAccountId: string;
  sourceAccount: Account | null;
  targetAccount: Account | null;
}
```

## Execution Schedule Logic
- **Monthly**: "jeden {day}."
- **Quarterly**: "{day}. {month} (quartalsweise)"
- **Yearly**: "{day}. {month} (jährlich)"
- **Once**: Formatted date

## User Interactions
- View all transfers between accounts
- Create new transfers (recurring or one-time)
- Delete transfers with confirmation
- See execution schedule for recurring transfers
- Track total monthly recurring transfer amount

## Use Cases
- Automated savings transfers (checking → savings)
- Investment contributions (checking → ETF account)
- Emergency fund building
- Debt repayment transfers

## Related Pages
- [Accounts](./accounts.md) - Source and target accounts
- [Account Detail](./account-detail.md) - Transfer history per account
