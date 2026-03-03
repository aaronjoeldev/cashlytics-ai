# Coding Conventions

**Analysis Date:** 2026-03-03

## Naming Patterns

**Files:**

- Use kebab-case for most modules and components in `src/actions/auth-actions.ts`, `src/lib/auth/require-auth.ts`, `src/components/organisms/login-form.tsx`, and `src/components/ui/button.tsx`.
- Use framework-conventional names for route handlers and app pages in `src/app/api/push/subscribe/route.ts`, `src/app/api/chat/route.ts`, and `src/app/layout.tsx`.
- Keep duplicate domain files aligned by suffix when parallel implementations exist (for example `src/actions/account-actions.ts` and `src/actions/accounts-actions.ts`, plus `src/actions/expense-actions.ts` and `src/actions/expenses-actions.ts`).

**Functions:**

- Use camelCase for functions and handlers (`loginAction`, `requireAuth`, `sanitizeForPrompt`, `handleDailySubmit`) in `src/actions/auth-actions.ts`, `src/lib/auth/require-auth.ts`, `src/app/api/chat/route.ts`, and `src/components/organisms/expense-form.tsx`.
- Use PascalCase only for React components (`LoginForm`, `SubmitButton`, `ExpensesClient`, `Button`) in `src/components/organisms/login-form.tsx`, `src/app/(dashboard)/expenses/client.tsx`, and `src/components/ui/button.tsx`.

**Variables:**

- Use camelCase for local variables and state (`shouldRedirect`, `initialCurrency`, `createdExpenseId`, `isSubmitting`) in `src/actions/auth-actions.ts`, `src/app/layout.tsx`, and `src/components/organisms/expense-form.tsx`.
- Use UPPER_SNAKE_CASE for module constants (`MAX_MESSAGES`, `ALLOWED_FILE_TYPES`, `MAX_FILE_SIZE`) in `src/app/api/chat/route.ts` and `src/components/organisms/expense-form.tsx`.

**Types:**

- Use PascalCase with semantic suffixes for domain and payload types (`ApiResponse`, `AuthActionState`, `ExpenseInput`, `AuthResult`) in `src/types/database.ts`, `src/actions/auth-actions.ts`, `src/lib/validations/transaction.ts`, and `src/lib/auth/require-auth.ts`.
- Co-locate inferred Zod types directly under schema definitions (`RegisterInput`, `ExpenseInput`, `DailyExpenseInput`) in `src/lib/validations/auth.ts` and `src/lib/validations/transaction.ts`.

## Code Style

**Formatting:**

- Use Prettier configured in `.prettierrc` with semicolons, double quotes, `tabWidth: 2`, `printWidth: 100`, and trailing commas (`es5`).
- Keep Tailwind class order auto-sorted through `prettier-plugin-tailwindcss` in `.prettierrc`.
- Run `prettier --write .` or `prettier --check .` from scripts in `package.json`.
- Normalize quote style to double quotes for new files to match `.prettierrc`, while accounting for existing single-quote drift in files like `src/app/api/chat/route.ts`, `src/components/organisms/expense-form.tsx`, and `src/lib/db/index.ts`.

**Linting:**

- Use ESLint flat config from `eslint.config.mjs` with `eslint-config-next/core-web-vitals`, `eslint-config-next/typescript`, and `eslint-config-prettier`.
- Run lint checks through `npm run lint` and autofix with `npm run lint:fix` from `package.json`.
- Keep generated build outputs excluded by default (`.next/**`, `out/**`, `build/**`, `next-env.d.ts`) in `eslint.config.mjs`.
- Enforce pre-commit quality gates with `lint-staged` in `package.json` triggered by `.husky/pre-commit`.

## Import Organization

**Order:**

1. Framework/runtime imports first (`next/*`, `react`, third-party SDKs) in `src/actions/auth-actions.ts`, `src/app/layout.tsx`, and `src/components/organisms/login-form.tsx`.
2. Internal alias imports (`@/...`) second in `src/actions/account-actions.ts`, `src/app/api/push/subscribe/route.ts`, and `src/components/organisms/expense-form.tsx`.
3. Type-only imports inline with domain imports (`import type ...`) as needed in `src/actions/account-actions.ts`, `src/app/layout.tsx`, and `src/app/(dashboard)/expenses/client.tsx`.

**Path Aliases:**

- Use `@/* -> ./src/*` and `@/auth -> ./auth.ts` from `tsconfig.json`.
- Prefer alias imports in app and server modules (`@/lib/db`, `@/components/ui/button`, `@/types/database`) across `src/actions/*`, `src/app/*`, and `src/components/*`.

## Error Handling

**Patterns:**

- Wrap server actions in `try/catch` and return typed failure objects instead of throwing raw errors in `src/actions/account-actions.ts` and similar files under `src/actions/`.
- Use discriminated action results (`{ success: true, data } | { success: false, error }`) from `src/types/database.ts` for action-level error transport.
- Gate auth at the top of server actions with `requireAuth()` from `src/lib/auth/require-auth.ts`; return `Unauthorized` early before DB access (pattern in `src/actions/account-actions.ts`).
- Validate untrusted input using Zod `safeParse` before business logic in `src/actions/auth-actions.ts` and `src/app/api/push/subscribe/route.ts`.
- In API routes, return explicit HTTP JSON responses with status codes (`400`, `401`, `429`, `500`) in `src/app/api/chat/route.ts` and `src/app/api/push/subscribe/route.ts`.

## Logging

**Framework:** Custom logger wrapper with console backend in `src/lib/logger.ts`.

**Patterns:**

- Use `logger.error(message, context, error)` for failed operations in server code (`src/actions/account-actions.ts`, `src/actions/auth-actions.ts`, `src/app/api/push/subscribe/route.ts`, `src/app/api/chat/route.ts`).
- Keep context strings stable and action-oriented (`"getAccounts"`, `"POST /api/chat"`) as seen in `src/actions/account-actions.ts` and `src/app/api/chat/route.ts`.
- Allow dev-only verbose console traces only behind `process.env.NODE_ENV === 'development'` in `src/app/api/chat/route.ts` and `src/lib/logger.ts`.
- Prefer centralized `logger` over direct `console.*`; direct console calls still exist in `src/lib/push.ts`, `src/app/api/documents/[id]/route.ts`, and `src/app/(dashboard)/dashboard/client.tsx`.

## Comments

**When to Comment:**

- Add short comments for non-obvious security and product constraints, as in `src/actions/auth-actions.ts` (enumeration-safe password reset behavior) and `src/app/api/chat/route.ts` (prompt and rate-limit constraints).
- Keep UI comments lightweight and structural when splitting dense JSX sections, as in `src/components/organisms/login-form.tsx` and `src/app/(dashboard)/expenses/client.tsx`.

**JSDoc/TSDoc:**

- Use JSDoc for reusable utility/auth helpers and security-sensitive logic in `src/lib/auth/require-auth.ts`, `src/lib/safe-parse.ts`, `src/lib/auth/reset-token.ts`, and `src/lib/auth/registration-mode.ts`.
- Use sparse JSDoc in feature-heavy components; comments are mainly inline in `src/components/organisms/expense-form.tsx` and `src/app/api/chat/route.ts`.

## Function Design

**Size:**

- Keep utility functions compact (`cn`, `safeParseFloat`, `requireAuth`) in `src/lib/utils.ts`, `src/lib/safe-parse.ts`, and `src/lib/auth/require-auth.ts`.
- Accept large orchestrator functions in feature-rich modules (`registerAction`, `POST`, `ExpensesClient`) in `src/actions/auth-actions.ts`, `src/app/api/chat/route.ts`, and `src/app/(dashboard)/expenses/client.tsx`.

**Parameters:**

- Prefer typed object parameters for rich payloads (`createAccount(data)`, `handleSuccess({ type, item })`) in `src/actions/account-actions.ts` and `src/app/(dashboard)/expenses/client.tsx`.
- Use `FormData` for server actions invoked by form posts in `src/actions/auth-actions.ts`.
- Use explicit primitive params for identifiers and narrow operations (`deleteAccount(id)`, `getConversationById(id)`) in `src/actions/account-actions.ts` and `src/actions/conversation-actions.ts`.

**Return Values:**

- Return typed unions for action stability and predictable UI handling (`ApiResponse<T>`, `AuthActionState`) in `src/types/database.ts` and `src/actions/auth-actions.ts`.
- Use `Promise<void>` only for fire-and-forget operations (`logoutAction`) in `src/actions/auth-actions.ts`.

## Module Design

**Exports:**

- Prefer named exports for functions, constants, and types across server and UI modules (`src/actions/account-actions.ts`, `src/lib/validations/transaction.ts`, `src/components/ui/button.tsx`).
- Use default exports only where framework conventions require them (`src/app/layout.tsx`, route files under `src/app/api/**/route.ts` use named HTTP handlers).

**Barrel Files:**

- Use targeted barrels for cohesive domains such as emails (`src/emails/index.tsx`) and providers (`src/components/providers/index.tsx`).
- Avoid broad root barrels; import directly from source modules (`@/actions/*`, `@/lib/*`, `@/components/*`) as shown throughout `src/app/` and `src/components/`.

---

_Convention analysis: 2026-03-03_
