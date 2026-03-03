# Testing Patterns

**Analysis Date:** 2026-03-03

## Test Framework

**Runner:**

- Node.js built-in test runner (`node:test`) is used in `src/lib/billing/subscriptions.test.ts`.
- Config: Not detected (`jest.config.*`, `vitest.config.*`, `playwright.config.*`, and `cypress.config.*` are absent in repo root).

**Assertion Library:**

- Node.js strict assertions (`node:assert/strict`) in `src/lib/billing/subscriptions.test.ts`.

**Run Commands:**

```bash
npm run test                         # Not available (no "test" script in `package.json`)
node --test "src/lib/billing/subscriptions.test.ts"  # Current direct run fails due alias/module resolution
npm run lint                         # Current quality gate used instead of automated tests
```

## Test File Organization

**Location:**

- Co-located tests are used (test file sits beside production module path) as shown by `src/lib/billing/subscriptions.test.ts`.

**Naming:**

- Use `*.test.ts` naming (`src/lib/billing/subscriptions.test.ts`).
- `*.spec.*` pattern is not present in `src/`.

**Structure:**

```
src/
└── lib/
    └── billing/
        └── subscriptions.test.ts
```

## Test Structure

**Suite Organization:**

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import { mapSubscriptionStatusToEntitlementStatus } from "@/lib/billing/subscriptions";

test("maps trialing subscriptions to trial entitlement status", () => {
  assert.equal(mapSubscriptionStatusToEntitlementStatus("trialing"), "trial");
});
```

**Patterns:**

- Use flat `test("...")` cases rather than nested `describe` blocks in `src/lib/billing/subscriptions.test.ts`.
- Setup pattern: None detected (`beforeEach`/`beforeAll` are not used in `src/lib/billing/subscriptions.test.ts`).
- Teardown pattern: None detected (`afterEach`/`afterAll` are not used in `src/lib/billing/subscriptions.test.ts`).
- Assertion pattern: deterministic one-liner `assert.equal(...)` checks in `src/lib/billing/subscriptions.test.ts`.

## Mocking

**Framework:** Not detected (no `jest.mock`, `vi.mock`, `sinon`, or `mock` usage in `*.test.*` files under `src/`).

**Patterns:**

```typescript
// No mocking pattern exists yet in `src/lib/billing/subscriptions.test.ts`.
// Current tests are pure input/output checks without dependency isolation.
```

**What to Mock:**

- No repository-standard rule is codified; future tests should mock external boundaries used heavily in runtime code (`@/lib/db` in `src/actions/account-actions.ts`, `@/auth` in `src/lib/auth/require-auth.ts`, and SDK calls in `src/app/api/chat/route.ts`).

**What NOT to Mock:**

- Keep deterministic pure logic real (for example utilities in `src/lib/safe-parse.ts` and recurrence mappers when present near `src/lib/billing/subscriptions.test.ts`).

## Fixtures and Factories

**Test Data:**

```typescript
// Inline literals are used directly in each test case.
assert.equal(mapSubscriptionStatusToEntitlementStatus("active"), "active");
assert.equal(mapSubscriptionStatusToEntitlementStatus("paused"), "none");
```

**Location:**

- Dedicated fixtures/factories directories are not present under `src/`.

## Coverage

**Requirements:** None enforced (no coverage tooling, thresholds, or CI checks detected in `package.json` and `.github/workflows/release.yml`).

**View Coverage:**

```bash
# Not available: no coverage command configured in `package.json`.
```

## Test Types

**Unit Tests:**

- Minimal unit coverage exists for status mapping in `src/lib/billing/subscriptions.test.ts`.

**Integration Tests:**

- Not detected (no DB-backed action tests for files like `src/actions/account-actions.ts` or API tests for `src/app/api/*/route.ts`).

**E2E Tests:**

- Not used (no Playwright/Cypress configuration files in repository root).

## Common Patterns

**Async Testing:**

```typescript
// Pattern not present in current test file.
// Runtime code is async-heavy (`src/actions/*`, `src/app/api/*/route.ts`),
// but async test examples are currently absent.
```

**Error Testing:**

```typescript
test("falls back to none for unknown statuses", () => {
  assert.equal(mapSubscriptionStatusToEntitlementStatus("paused"), "none");
});
```

---

_Testing analysis: 2026-03-03_
