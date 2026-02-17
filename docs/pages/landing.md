# Landing Page

**Route**: `/`
**File**: `src/app/page.tsx`

## Overview
The root landing page serves as the entry point to the application. It automatically redirects users to the main dashboard.

## Features
- Automatic redirection to dashboard
- No UI rendering - immediate server-side redirect

## Components Used
| Component | Purpose |
|-----------|---------|
| N/A | Uses Next.js `redirect()` function |

## Server Actions Used
| Action | Purpose |
|--------|---------|
| N/A | No data fetching required |

## User Interactions
- None - users are immediately redirected

## Related Pages
- [Dashboard](./dashboard.md) - Destination after redirect

## Technical Details
```typescript
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/dashboard');
}
```

The page uses Next.js server-side redirect to immediately send users to the authenticated dashboard view.
