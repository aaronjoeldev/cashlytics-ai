# Codebase Concerns

**Analysis Date:** 2026-02-20

## Critical Security Issues

**No Authentication System:**
- Issue: Application has zero authentication or user isolation. All users share the same database records.
- Files: `src/lib/db/schema.ts` (no userId columns), `src/actions/*` (no auth checks), `src/app/api/*` (no auth middleware)
- Impact: Any user can view, modify, or delete any other user's financial data. Complete data exposure.
- Fix approach: Add authentication (Clerk, NextAuth, or custom). Add `userId` column to all tables. Filter all queries by authenticated user.

**API Routes Without Auth:**
- Issue: `/api/documents` and `/api/chat` endpoints have no authentication checks.
- Files: `src/app/api/documents/route.ts`, `src/app/api/chat/route.ts`
- Impact: Anyone can upload documents or interact with the AI assistant without being logged in.
- Fix approach: Add auth middleware to all API routes. Return 401 for unauthenticated requests.

**No Rate Limiting:**
- Issue: API routes have no rate limiting protection.
- Files: `src/app/api/documents/route.ts`, `src/app/api/chat/route.ts`
- Impact: Vulnerable to DoS attacks and API abuse. AI endpoint could be exploited for cost attacks.
- Fix approach: Implement rate limiting (e.g., `next-rate-limit` or Upstash).

## Tech Debt

**Large Monolithic Files:**
- Issue: Multiple files exceed 500-800 lines, mixing concerns and making maintenance difficult.
- Files:
  - `src/actions/analytics-actions.ts` (851 lines) - 13+ different analytics functions
  - `src/app/(dashboard)/overview/client.tsx` (859 lines) - Single component with calendar, subscriptions, categories, forecast
  - `src/components/ui/sidebar.tsx` (726 lines)
  - `src/components/organisms/expense-form.tsx` (706 lines)
- Impact: Difficult to understand, test, and modify. High cognitive load for developers.
- Fix approach: Split into smaller, focused modules. Extract reusable logic to hooks.

**Type Safety Bypasses:**
- Issue: Extensive use of `any` types bypasses TypeScript's safety net.
- Files:
  - `src/components/organisms/account-form.tsx:29` - `onSuccess?: (data: any) => void`
  - `src/components/organisms/transfer-form.tsx:31` - `onSuccess?: (data: any) => void`
  - `src/components/organisms/income-form.tsx:31` - `onSuccess?: (data: any) => void`
  - `src/components/organisms/expense-form.tsx:44` - `onSuccess?: (data: { type: 'periodic' | 'daily'; item: any })`
  - `src/lib/validations/transaction.ts:19,45,66` - `z.any()` for endDate fields
- Impact: Runtime errors, lost IDE autocomplete, reduced code reliability.
- Fix approach: Define proper types for all callbacks. Use `z.date().nullable()` instead of `z.any()`.

**Incomplete Feature:**
- Issue: Historical trend comparison marked as TODO.
- Files: `src/actions/dashboard-actions.ts:136` - `incomeTrend: 0, // TODO: Historische Daten vergleichen`
- Impact: Feature shows placeholder value instead of real data.
- Fix approach: Implement historical comparison by querying previous month's data.

## Error Handling Gaps

**Console-Only Error Logging:**
- Issue: All errors logged to console.error without structured logging or user notification.
- Files: All `src/actions/*.ts` files (40+ instances), `src/app/api/documents/route.ts`, `src/app/api/chat/route.ts`
- Impact: Errors invisible in production. No alerting on failures. Poor debugging experience.
- Fix approach: Implement structured logging service (e.g., Pino, Winston). Add error tracking (Sentry). Use toast notifications for user-facing errors.

**Inconsistent Error Returns:**
- Issue: Server actions return `{ success: false, error: string }` but error handling varies.
- Files: All `src/actions/*.ts`
- Impact: Inconsistent error handling on client side. Some errors silently fail.
- Fix approach: Standardize error response format. Add error codes for programmatic handling.

## Performance Bottlenecks

**Documents Stored as Base64:**
- Issue: File uploads stored as base64-encoded strings directly in PostgreSQL.
- Files: `src/lib/db/schema.ts:85` - `data: text('data').notNull()`, `src/app/api/documents/route.ts:36-46`
- Impact: Database bloat, slow queries, high memory usage. Base64 adds 33% size overhead.
- Fix approach: Use object storage (S3, Vercel Blob, Supabase Storage). Store only references in DB.

**Sequential Database Calls in Loops:**
- Issue: `getForecast()` calls `getMonthlyOverview()` sequentially for each month.
- Files: `src/actions/analytics-actions.ts:144-163`
- Impact: N database round-trips for N-month forecast. 3-month forecast = 3x slower than needed.
- Fix approach: Batch queries or use a single aggregated query.

**No Database Connection Pooling:**
- Issue: Single postgres connection used without explicit pooling configuration.
- Files: `src/lib/db/index.ts:11`
- Impact: May bottleneck under concurrent requests. Connection exhaustion risk.
- Fix approach: Configure connection pooling (PgBouncer or postgres.js pool settings).

## Fragile Areas

**parseFloat Without NaN Handling:**
- Issue: 50+ uses of `parseFloat()` without NaN validation. Malformed data causes NaN propagation.
- Files: `src/actions/analytics-actions.ts` (30+ instances), `src/components/molecules/*.tsx`
- Impact: NaN values corrupt calculations, display as "NaN" in UI, break aggregations.
- Fix approach: Wrap parseFloat in utility function with fallback. Validate at form submission.

**Date Handling Without Timezone Safety:**
- Issue: Date comparisons and creations without explicit timezone handling.
- Files: `src/actions/analytics-actions.ts`, `src/app/(dashboard)/overview/client.tsx`
- Impact: Calendar and date filtering may be off by one day in certain timezones.
- Fix approach: Use date-fns with explicit timezone or store all dates as UTC midnight.

**Calendar Payment Calculation Complexity:**
- Issue: `getPaymentDatesInMonth()` handles 7 recurrence types with complex logic.
- Files: `src/actions/analytics-actions.ts:605-684`
- Impact: High cyclomatic complexity. Edge cases likely missed (leap years, month boundaries).
- Fix approach: Extract to dedicated recurrence service with comprehensive unit tests.

## AI Integration Risks

**AI Tool Data Exposure:**
- Issue: AI tools return financial data (amounts, account names, categories) to LLM context.
- Files: `src/lib/ai/tools.ts`, `src/app/api/chat/route.ts`
- Impact: Sensitive financial data sent to OpenAI. May be logged or stored externally.
- Current mitigation: Documents explicitly excluded from AI context (line 106-108, 197-200)
- Recommendations: Add data masking option. Audit what's sent to LLM. Consider local models.

**AI Step Limit Hardcoded:**
- Issue: Max 10 AI steps per request hardcoded without configuration.
- Files: `src/app/api/chat/route.ts:156` - `stopWhen: stepCountIs(10)`
- Impact: Complex multi-step operations may fail silently.
- Fix approach: Make configurable. Add user feedback when limit reached.

## Test Coverage Gaps

**Zero Test Files in Source:**
- Issue: No test files found in `src/` directory. Only tests exist in `node_modules/`.
- Files: None exist
- Impact: No regression protection. Refactoring is risky. Bug fixes may introduce new bugs.
- Risk: Critical - financial calculations untested
- Priority: High
- Fix approach: Add Vitest/Jest. Start with unit tests for `normalizeToMonthly()`, `getPaymentDatesInMonth()`, and calculation-heavy functions.

## Missing Critical Features

**No Data Export:**
- Issue: Users cannot export their financial data.
- Impact: Data lock-in. GDPR compliance risk.
- Fix approach: Add CSV/PDF export functionality.

**No Data Backup:**
- Issue: No backup/restore functionality.
- Impact: Data loss risk if database corrupted.
- Fix approach: Add scheduled backups. User-initiated backup download.

**No Multi-Currency Support:**
- Issue: Currency field exists but only EUR used throughout. No conversion.
- Files: `src/lib/db/schema.ts:16`, all display components
- Impact: Cannot track accounts in different currencies.
- Fix approach: Add currency conversion service. Display converted totals.

## Dependency Concerns

**React 19 in Production:**
- Issue: Using React 19.2.3 which is very recent. Some ecosystem libraries may have compatibility issues.
- Files: `package.json:31-32`
- Impact: Potential edge case bugs, fewer Stack Overflow solutions.
- Current mitigation: None
- Recommendations: Monitor React 19 issues. Pin exact versions.

**Zod v4 with Breaking Changes:**
- Issue: Using Zod 4.3.6 which has different API from Zod 3.
- Files: `package.json:37`
- Impact: Examples and docs may reference old API.
- Fix approach: Ensure team aware of Zod 4 differences. Document patterns used.

---

*Concerns audit: 2026-02-20*
