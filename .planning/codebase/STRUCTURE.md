# Codebase Structure

**Analysis Date:** 2026-03-03

## Directory Layout

```text
cashlytics/
├── src/                    # Application source (routes, actions, components, lib)
├── drizzle/                # SQL migrations generated/maintained for Drizzle
├── messages/               # i18n message bundles (de/en)
├── public/                 # Static assets and service worker
├── scripts/                # Project scripts (migration helper, demo reset/seed)
├── docs/                   # Human-facing architecture/component/page docs
├── auth.ts                 # Auth.js runtime config with adapter/providers
├── auth.config.ts          # Edge-safe auth config (JWT/session callbacks)
├── next.config.ts          # Next.js config + next-intl plugin wiring
├── drizzle.config.ts       # Drizzle-kit config (schema + output)
└── tsconfig.json           # TS compiler settings and path aliases
```

## Directory Purposes

**`src/app/`:**

- Purpose: App Router routes, layouts, and route handlers.
- Contains: Route groups `(auth)` and `(dashboard)`, API handlers in `src/app/api/`, root wrappers `src/app/layout.tsx` and `src/app/page.tsx`.
- Key files: `src/app/layout.tsx`, `src/app/(dashboard)/layout.tsx`, `src/app/api/chat/route.ts`, `src/app/api/auth/[...nextauth]/route.ts`.

**`src/actions/`:**

- Purpose: Server actions as the main business/service layer.
- Contains: Domain actions per concern (`account-actions.ts`, `expense-actions.ts`, `analytics-actions.ts`, `auth-actions.ts`, `conversation-actions.ts`).
- Key files: `src/actions/account-actions.ts`, `src/actions/dashboard-actions.ts`, `src/actions/analytics-actions.ts`, `src/actions/auth-actions.ts`.

**`src/lib/`:**

- Purpose: Shared infrastructure, domain helpers, and integration utilities.
- Contains: DB setup/schema (`src/lib/db/`), auth helpers (`src/lib/auth/`), AI tooling (`src/lib/ai/tools.ts`), email/push/cron/rate-limiter/logging.
- Key files: `src/lib/db/schema.ts`, `src/lib/db/index.ts`, `src/lib/auth/require-auth.ts`, `src/lib/ai/tools.ts`, `src/lib/logger.ts`.

**`src/components/`:**

- Purpose: Reusable UI and feature-level presentation components.
- Contains: `ui/` primitives, `organisms/` feature composites, `layout/` shell, `providers/` app-level providers, plus `atoms/` and `molecules/`.
- Key files: `src/components/providers/index.tsx`, `src/components/layout/app-sidebar.tsx`, `src/components/organisms/chat-interface.tsx`, `src/components/ui/button.tsx`.

**`src/hooks/`:**

- Purpose: Client-side reusable behavior.
- Contains: Hooks for AI chat orchestration and UI utilities.
- Key files: `src/hooks/use-conversations.ts`, `src/hooks/use-mobile.ts`, `src/hooks/use-toast.ts`.

**`src/i18n/`:**

- Purpose: Locale setup and request-time message loading.
- Contains: Locale constants and request config.
- Key files: `src/i18n/config.ts`, `src/i18n/request.ts`.

**`src/types/`:**

- Purpose: Shared TypeScript types derived from DB schema and API contracts.
- Contains: Drizzle inference types and action response types.
- Key files: `src/types/database.ts`.

**`drizzle/`:**

- Purpose: SQL migration history.
- Contains: Sequential migration files and metadata.
- Key files: `drizzle/0000_rapid_cloak.sql`, `drizzle/0007_old_ikaris.sql`, `drizzle/meta/`.

**`messages/`:**

- Purpose: Translation dictionaries consumed by `next-intl`.
- Contains: One JSON file per locale.
- Key files: `messages/de.json`, `messages/en.json`.

## Key File Locations

**Entry Points:**

- `src/app/layout.tsx`: Root HTML/body, global providers, locale/timezone/currency bootstrap.
- `src/app/page.tsx`: Root route redirect logic.
- `src/proxy.ts`: Request-level route protection and redirect rules.
- `src/app/api/auth/[...nextauth]/route.ts`: Auth.js route handler export.
- `auth.ts`: Auth.js runtime config with Drizzle adapter and credentials provider.

**Configuration:**

- `next.config.ts`: App output mode and `next-intl` plugin wiring.
- `tsconfig.json`: Compiler strictness and path aliases (`@/*`, `@/auth`).
- `drizzle.config.ts`: Drizzle schema path and migration output directory.
- `eslint.config.mjs`: ESLint setup for linting behavior.
- `.prettierrc`: Formatting rules.

**Core Logic:**

- `src/actions/*.ts`: Business operations and DB interaction.
- `src/lib/db/schema.ts`: Canonical domain data model and relations.
- `src/lib/ai/tools.ts`: AI-callable operation catalog mapped to server actions.
- `src/app/api/chat/route.ts`: LLM request pipeline and streaming responses.

**Testing:**

- `src/lib/billing/subscriptions.test.ts`: Current test location and pattern (Node test runner).

## Naming Conventions

**Files:**

- Kebab-case for most source files: `account-actions.ts`, `rate-limiter.ts`, `chat-interface.tsx`.
- Framework-reserved App Router names in route folders: `page.tsx`, `layout.tsx`, `route.ts`.
- Route-specific client split uses `client.tsx` next to page: `src/app/(dashboard)/dashboard/client.tsx`.

**Directories:**

- Lowercase directories with semantic grouping: `src/actions`, `src/lib/auth`, `src/components/organisms`.
- App Router route groups use parentheses: `src/app/(auth)`, `src/app/(dashboard)`.
- Dynamic route segments use bracket syntax: `src/app/(dashboard)/accounts/[id]`, `src/app/api/auth/[...nextauth]`.

## Where to Add New Code

**New Feature:**

- Primary code: Add/extend server action in `src/actions/<domain>-actions.ts`; expose UI route in `src/app/(dashboard)/<feature>/page.tsx`.
- Tests: Add co-located or domain-adjacent test file in the relevant module directory using `*.test.ts` (current precedent: `src/lib/billing/subscriptions.test.ts`).

**New Component/Module:**

- Implementation: Put reusable primitives in `src/components/ui/`; feature components in `src/components/organisms/` (or `molecules/`/`atoms/` when simpler).

**Utilities:**

- Shared helpers: Put infrastructure/domain utilities in `src/lib/<area>/` or `src/lib/<utility>.ts`.
- Shared types: Add to `src/types/database.ts` if schema-derived, otherwise colocate near the module using them.

## Special Directories

**`src/app/api/`:**

- Purpose: Route handlers for HTTP interfaces (chat, auth, documents, push, cron).
- Generated: No.
- Committed: Yes.

**`drizzle/`:**

- Purpose: Migration artifacts for database evolution.
- Generated: Yes (via drizzle-kit), then maintained in repo.
- Committed: Yes.

**`.next/`:**

- Purpose: Next.js build output and type artifacts.
- Generated: Yes.
- Committed: No.

**`models/`:**

- Purpose: Local model assets (`model.onnx`, tokenizer/config files).
- Generated: Not detected as generated by app runtime; treated as static assets.
- Committed: Yes.

**`.planning/`:**

- Purpose: Planning state, phases, and generated codebase mapping docs.
- Generated: Mixed (human + agent-maintained planning artifacts).
- Committed: Yes.

---

_Structure analysis: 2026-03-03_
