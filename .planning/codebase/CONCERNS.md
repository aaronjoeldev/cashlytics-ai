# Codebase Concerns

**Analysis Date:** 2026-03-03

## Tech Debt

**Duplicated server-action modules (parallel APIs with overlapping names):**

- Issue: Two sets of near-duplicate action files exist with overlapping exports (`getAccounts`, `getExpenses`, `getIncomes`, `create*`, `update*`, `delete*`), which creates drift and inconsistent behavior.
- Files: `src/actions/account-actions.ts`, `src/actions/accounts-actions.ts`, `src/actions/expense-actions.ts`, `src/actions/expenses-actions.ts`, `src/actions/income-actions.ts`, `src/actions/incomes-actions.ts`, `src/app/(dashboard)/accounts/[id]/page.tsx`
- Impact: Features call different implementations depending on import path, causing inconsistent ordering, validation behavior, and future bug fixes being applied in only one branch.
- Fix approach: Consolidate each domain to one canonical action module, migrate imports, then delete the duplicate modules.

**Business logic concentrated in very large files:**

- Issue: Domain logic and orchestration are concentrated in large files (400-1100 LOC), making safe edits difficult.
- Files: `src/actions/analytics-actions.ts`, `src/actions/dashboard-actions.ts`, `src/app/(dashboard)/overview/client.tsx`, `src/app/(dashboard)/expenses/client.tsx`, `src/components/organisms/expense-form.tsx`
- Impact: Higher regression risk, slower onboarding, and frequent merge conflicts in shared hotspots.
- Fix approach: Split by domain use case (queries/calculations/formatting/UI sections), keep each module narrowly scoped.

**Stale/dead code paths and comments:**

- Issue: Residual TODOs and stale references remain from earlier phases.
- Files: `auth.ts` (stale Phase 2 TODO), `src/actions/dashboard-actions.ts` (income trend TODO), `src/lib/billing/subscriptions.test.ts` (references `@/lib/billing/subscriptions` which is not present)
- Impact: Misleading maintenance context and weak signal-to-noise in implementation status.
- Fix approach: Remove stale comments, either implement missing billing module or delete the orphan test.

## Known Bugs

**Document upload validates UUID fields as integers:**

- Symptoms: Upload endpoint rejects valid UUID `expenseId`/`dailyExpenseId` values with 400 errors.
- Files: `src/app/api/documents/route.ts`, `src/lib/db/schema.ts`
- Trigger: `POST /api/documents` with real UUID transaction IDs; `isValidIntegerId` only accepts positive integers.
- Workaround: Use server actions in `src/actions/document-actions.ts` instead of the API route for upload.

**Upcoming payment date calculation skips current-month/current-year due dates:**

- Symptoms: Monthly and yearly recurring expenses can appear one cycle late in upcoming payments.
- Files: `src/actions/dashboard-actions.ts`
- Trigger: `getNextPaymentDate` initializes monthly/yearly next dates from `now.getMonth() + 1` and `now.getFullYear() + 1` before checking current cycle eligibility.
- Workaround: No reliable workaround in current implementation.

**AI tool contract advertises filters not actually applied:**

- Symptoms: `minAmount`/`maxAmount` appear supported in AI tool schema for daily expenses, but filtering does not happen.
- Files: `src/lib/ai/tools.ts`, `src/actions/expense-actions.ts`
- Trigger: `getDailyExpenses` tool passes `minAmount`/`maxAmount`, but action filter type does not implement those fields.
- Workaround: Use date/category/account filters only.

## Security Considerations

**IDOR risk on document-by-id route:**

- Risk: Any authenticated user can fetch or delete another user's document if they obtain the document UUID.
- Files: `src/app/api/documents/[id]/route.ts`, `src/lib/db/schema.ts`
- Current mitigation: None in this route; query scopes by `documents.id` only and does not verify `documents.userId` against session.
- Recommendations: Require `auth()` in route and scope all `GET`/`DELETE` queries with `and(eq(documents.id, id), eq(documents.userId, session.user.id))`.

**Password reset does not revoke existing JWT sessions:**

- Risk: Active sessions remain valid after password change, so stolen session cookies remain usable until expiry.
- Files: `auth.config.ts`, `src/actions/auth-actions.ts`, `.planning/STATE.md`
- Current mitigation: Reset tokens are single-use and invalidated, but session revocation is not implemented under JWT strategy.
- Recommendations: Add server-side session versioning or switch to revocable session storage for forced logout on credential reset.

**Rate limiting is process-local and header-trust dependent:**

- Risk: Limits are bypassed across replicas/restarts and may be spoofable via proxy headers in some deployments.
- Files: `src/lib/rate-limiter.ts`, `src/app/api/chat/route.ts`, `src/app/api/documents/route.ts`
- Current mitigation: Basic in-memory counters per key.
- Recommendations: Move to shared store (Redis/Postgres) and canonical client IP extraction behind trusted proxy boundaries.

## Performance Bottlenecks

**Binary documents stored as base64 in primary database rows:**

- Problem: Every document write/read inflates payload size and DB storage by base64 overhead.
- Files: `src/lib/db/schema.ts`, `src/actions/document-actions.ts`, `src/app/api/documents/[id]/route.ts`
- Cause: `documents.data` uses `text` base64 blob storage instead of external object storage.
- Improvement path: Store file metadata in DB and move binary payloads to object storage (S3-compatible, local MinIO, etc.).

**Cron payment checks load broad dataset then compute in memory:**

- Problem: Upcoming payment job scans active expenses for all users and filters due items in application code.
- Files: `src/lib/cron/upcoming-payments.ts`
- Cause: Recurrence evaluation occurs post-query (`typedRows.filter(isDueTomorrow)`), with one push attempt per due expense.
- Improvement path: Precompute/snapshot next-due dates or batch by user with indexed due-date criteria.

**Dashboard statistics require many sequential queries:**

- Problem: Dashboard stats execute multiple round trips and in-memory normalization each request.
- Files: `src/actions/dashboard-actions.ts`
- Cause: Separate selects for assets, incomes, one-time incomes, daily expenses, periodic expenses, and trends.
- Improvement path: Consolidate with fewer aggregate queries/materialized summaries.

## Fragile Areas

**Balance mutation logic is non-transactional in income/expense flows:**

- Files: `src/actions/expense-actions.ts`, `src/actions/income-actions.ts`
- Why fragile: Insert/delete and corresponding account balance updates are separate operations outside a DB transaction.
- Safe modification: Convert create/update/delete financial writes to single `db.transaction` blocks with invariant checks.
- Test coverage: No automated tests cover balance integrity under partial failures.

**Recurrence logic duplicated across modules:**

- Files: `src/actions/dashboard-actions.ts`, `src/actions/forecast-actions.ts`, `src/lib/cron/upcoming-payments.ts`
- Why fragile: Similar recurrence calculations are implemented multiple times with different edge-case behavior.
- Safe modification: Centralize recurrence/date math into shared pure utilities and reuse everywhere.
- Test coverage: No focused recurrence edge-case suite exists.

**Mixed direct console debugging in production paths:**

- Files: `src/app/(dashboard)/dashboard/client.tsx`, `src/app/api/documents/[id]/route.ts`, `src/lib/cron/upcoming-payments.ts`, `src/lib/push.ts`
- Why fragile: Runtime logs are inconsistent (`console.*` vs `logger`) and harder to control/route.
- Safe modification: Standardize on `logger` with environment-aware levels.
- Test coverage: Logging behavior is not tested.

## Scaling Limits

**API throttling capacity is single-process only:**

- Current capacity: Limited to one Node.js process memory map per deployment unit.
- Limit: Horizontal scaling or process restart resets limits, allowing burst bypass.
- Scaling path: Shared distributed limiter backend with consistent keys and retry metadata.

**Query scalability constrained by missing explicit indexes on hot filters:**

- Current capacity: Acceptable for small datasets.
- Limit: Multi-tenant growth increases scan cost on frequent `userId` and date-range filters.
- Scaling path: Add composite indexes for common access patterns (for example on `user_id + created_at/date/start_date`) in Drizzle schema+migrations.

**Document storage growth competes with transactional data:**

- Current capacity: Bounded by primary Postgres disk and row bloat tolerance.
- Limit: Larger attachments increase backup size, vacuum pressure, and I/O latency for core financial tables.
- Scaling path: Externalize blobs and keep DB rows metadata-only.

## Dependencies at Risk

**`next-auth` beta channel in production dependency graph:**

- Risk: Breaking behavior changes across beta updates.
- Impact: Auth/session flows can regress without code changes.
- Migration plan: Pin exact beta version, monitor release notes, and plan migration to stable Auth.js release once available.

## Missing Critical Features

**Session revocation model for credential-security events:**

- Problem: No server-side revocation mechanism for existing JWT sessions after password reset.
- Blocks: Immediate account takeover containment after password compromise.

**Integrated automated test pipeline for core domains:**

- Problem: No test script in package scripts and only one isolated test file.
- Blocks: Safe refactors in auth, finance math, balance mutation, and API authorization layers.

## Test Coverage Gaps

**Authentication and password-reset flows:**

- What's not tested: Registration mode gating, forgot-password enumeration protection, token consumption/invalidation, session behavior after reset.
- Files: `src/actions/auth-actions.ts`, `src/lib/auth/reset-token.ts`, `auth.config.ts`
- Risk: Security regressions can ship undetected.
- Priority: High

**Document API authorization and ownership checks:**

- What's not tested: Per-user access constraints for document read/delete endpoints.
- Files: `src/app/api/documents/[id]/route.ts`, `src/app/api/documents/route.ts`
- Risk: Data leakage or cross-user destructive actions.
- Priority: High

**Financial mutation consistency (balances vs transaction rows):**

- What's not tested: Atomicity/invariants for expense/income create/update/delete and account balance reconciliation.
- Files: `src/actions/expense-actions.ts`, `src/actions/income-actions.ts`, `src/actions/transfer-actions.ts`
- Risk: Silent ledger drift during partial failure scenarios.
- Priority: High

**Recurrence and forecast edge-case correctness:**

- What's not tested: Monthly/yearly recurrence boundaries, custom intervals, month-end behavior, and upcoming payment date selection.
- Files: `src/actions/dashboard-actions.ts`, `src/actions/forecast-actions.ts`, `src/lib/cron/upcoming-payments.ts`
- Risk: Incorrect projections and reminder timing.
- Priority: Medium

---

_Concerns audit: 2026-03-03_
