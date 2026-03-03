# Architecture

**Analysis Date:** 2026-03-03

## Pattern Overview

**Overall:** Next.js App Router monolith with server actions as the primary backend boundary.

**Key Characteristics:**

- Route-first architecture in `src/app/` with route groups for auth and dashboard flows.
- Domain logic centralized in server actions under `src/actions/`, called by server pages, client components, and AI tool handlers.
- Shared infrastructure and cross-cutting utilities (DB, auth, logging, validation, AI tools, email, push, cron) in `src/lib/`.

## Layers

**Routing and Rendering Layer:**

- Purpose: Define routes, layouts, and API handlers.
- Location: `src/app/` and `src/proxy.ts`.
- Contains: App Router pages/layouts (`page.tsx`, `layout.tsx`, `client.tsx`) and Route Handlers (`route.ts`).
- Depends on: `src/actions/`, `src/components/`, `src/lib/`, `@/auth`.
- Used by: Browser requests and scheduled/API clients.

**UI Composition Layer:**

- Purpose: Render reusable UI primitives and feature UI modules.
- Location: `src/components/`.
- Contains: Atomic UI (`src/components/ui/`), feature organisms (`src/components/organisms/`), layout shell (`src/components/layout/`), app providers (`src/components/providers/index.tsx`).
- Depends on: `src/hooks/`, `src/lib/`, `src/actions/` (via hooks/forms), `next-intl`.
- Used by: Route pages in `src/app/`.

**Application Service Layer (Server Actions):**

- Purpose: Execute business operations and data access with auth checks.
- Location: `src/actions/*.ts`.
- Contains: CRUD and analytics operations like `src/actions/account-actions.ts`, `src/actions/auth-actions.ts`, `src/actions/analytics-actions.ts`, `src/actions/dashboard-actions.ts`, `src/actions/conversation-actions.ts`.
- Depends on: `src/lib/db/index.ts`, `src/lib/db/schema.ts`, `src/lib/auth/require-auth.ts`, `src/lib/logger.ts`, validators.
- Used by: Server pages, client actions/forms, API routes, and AI tools.

**Domain/Infrastructure Layer:**

- Purpose: Provide shared technical capabilities and domain helpers.
- Location: `src/lib/`, root auth files `auth.ts`, `auth.config.ts`.
- Contains: Auth helpers (`src/lib/auth/*`), DB (`src/lib/db/*`), AI tool wiring (`src/lib/ai/tools.ts`), rate limiting (`src/lib/rate-limiter.ts`), email (`src/lib/email/*`), push and cron (`src/lib/push.ts`, `src/lib/cron/upcoming-payments.ts`), i18n config (`src/i18n/*`).
- Depends on: External SDKs and environment config.
- Used by: Actions, API routes, layouts/providers, and proxy.

**Persistence Layer:**

- Purpose: Store users, financial entities, chat data, documents, and push subscriptions.
- Location: `src/lib/db/schema.ts`, connection in `src/lib/db/index.ts`, migrations in `drizzle/*.sql`.
- Contains: Drizzle tables and relations for auth, accounts, categories, expenses, incomes, transfers, documents, conversations/messages, push subscriptions.
- Depends on: PostgreSQL via `postgres` client.
- Used by: All server actions and selected API routes.

## Data Flow

**Page-driven dashboard flow:**

1. Incoming request resolves in App Router page (example: `src/app/(dashboard)/dashboard/page.tsx`).
2. Page calls one or more server actions (`getDashboardStats`, `getCategoryBreakdown`, `getRecentTransactions`, `getUpcomingPayments` in `src/actions/dashboard-actions.ts`).
3. Each action enforces auth (`src/lib/auth/require-auth.ts`) before querying Drizzle (`src/lib/db/index.ts` + `src/lib/db/schema.ts`).
4. Page passes serialized data to client component (`src/app/(dashboard)/dashboard/client.tsx`) for interaction/rendering.

**Form/server-action mutation flow:**

1. Client form component binds to a server action via `useActionState` (example: `src/components/organisms/login-form.tsx` -> `loginAction` in `src/actions/auth-actions.ts`).
2. Server action validates payload (`src/lib/validations/auth.ts` and inline checks), executes business logic and DB writes.
3. Action returns typed state or redirects, and may trigger cache invalidation via `revalidatePath` (examples in `src/actions/account-actions.ts`, `src/actions/conversation-actions.ts`).

**AI assistant flow:**

1. UI chat hook (`src/hooks/use-conversations.ts`) uses `useChat` and sends messages to `POST /api/chat` (`src/app/api/chat/route.ts`).
2. Route applies in-memory rate limiting (`src/lib/rate-limiter.ts`), validates message payload, builds contextual prompt via action calls.
3. `streamText` executes with tool registry from `src/lib/ai/tools.ts`; tools call existing server actions.
4. Conversation state persists through `src/actions/conversation-actions.ts` and is reloaded in UI.

**Background notification flow:**

1. External scheduler calls `GET /api/cron/upcoming-payments` (`src/app/api/cron/upcoming-payments/route.ts`) with bearer `CRON_SECRET`.
2. Handler delegates to `checkUpcomingPayments` (`src/lib/cron/upcoming-payments.ts`).
3. Cron service queries recurring expenses, computes due items, and sends web push via `sendPushNotification` (`src/lib/push.ts`).
4. Service worker in `public/sw.js` receives push events and opens/focuses relevant app route.

**State Management:**

- Server state is authoritative in PostgreSQL via Drizzle (`src/lib/db/*`, `src/actions/*`).
- Route-level data loading is server-first (`src/app/(dashboard)/*/page.tsx` calling actions).
- Client UI state uses React hooks/context (`src/hooks/*`, `src/lib/settings-context.tsx`).
- Session state is managed by Auth.js (`auth.ts`, `auth.config.ts`, `src/app/api/auth/[...nextauth]/route.ts`) and checked in actions/routes.

## Key Abstractions

**Auth Gate Abstraction:**

- Purpose: Uniformly enforce authenticated user context before domain operations.
- Examples: `src/lib/auth/require-auth.ts`, usage across `src/actions/account-actions.ts`, `src/actions/analytics-actions.ts`, `src/actions/conversation-actions.ts`.
- Pattern: Early-return union type `{ userId } | { error: "Unauthorized" }` at top of each action.

**Typed API Result Abstraction:**

- Purpose: Keep action responses predictable for server pages, client components, and AI tools.
- Examples: `ApiResponse<T>` in `src/types/database.ts`; returned in most action files.
- Pattern: Discriminated union `{ success: true, data } | { success: false, error }`.

**Schema-first Data Model Abstraction:**

- Purpose: Keep table definitions and relation graph centralized.
- Examples: `src/lib/db/schema.ts` and derived types in `src/types/database.ts`.
- Pattern: Drizzle table definitions + `relations(...)` + `InferSelectModel/InferInsertModel` types.

**Tool-Backed AI Command Abstraction:**

- Purpose: Reuse existing business operations from conversational interface.
- Examples: Tool registry `src/lib/ai/tools.ts`, chat route `src/app/api/chat/route.ts`.
- Pattern: Zod-validated tool inputs mapped to existing server action calls with `needsApproval` for writes.

## Entry Points

**Web App Root:**

- Location: `src/app/layout.tsx` and `src/app/page.tsx`.
- Triggers: Any browser request to app root.
- Responsibilities: Global providers, locale/messages/timezone bootstrapping, currency bootstrap from cookies, root redirect to `/dashboard`.

**Authentication Runtime:**

- Location: `auth.ts`, `auth.config.ts`, `src/app/api/auth/[...nextauth]/route.ts`.
- Triggers: Auth API requests and session lookups.
- Responsibilities: Auth.js handler setup, credential provider authorization, JWT/session callbacks, Drizzle adapter binding.

**Route Protection Middleware:**

- Location: `src/proxy.ts`.
- Triggers: Matched requests via exported `config.matcher`.
- Responsibilities: Check JWT token, allowlist public/auth/cron routes, redirect unauthenticated users to `/login`, redirect authenticated users away from auth pages.

**HTTP API Endpoints:**

- Location: `src/app/api/chat/route.ts`, `src/app/api/documents/route.ts`, `src/app/api/documents/[id]/route.ts`, `src/app/api/push/subscribe/route.ts`, `src/app/api/push/vapid-public-key/route.ts`, `src/app/api/cron/upcoming-payments/route.ts`.
- Triggers: Programmatic HTTP requests (browser, AI SDK client, scheduler, push setup).
- Responsibilities: Validate/authenticate requests, apply rate limits where configured, perform targeted DB/AI/push operations.

**PWA Runtime:**

- Location: `src/components/pwa/service-worker-registrar.tsx` and `public/sw.js`.
- Triggers: Client hydration and browser service-worker lifecycle events.
- Responsibilities: Register SW, handle caching/offline fallback, process push notifications, route notification clicks.

## Error Handling

**Strategy:** Return safe, user-facing failures from actions/routes and log internal details centrally.

**Patterns:**

- Try/catch around server actions and route handlers with structured logger calls (`src/lib/logger.ts`) and stable failure strings (examples across `src/actions/*.ts`, `src/app/api/*/route.ts`).
- Validation-first guards with 4xx responses in APIs (examples in `src/app/api/chat/route.ts`, `src/app/api/push/subscribe/route.ts`, `src/app/api/documents/route.ts`).
- Authorization short-circuiting before expensive work (`src/lib/auth/require-auth.ts`, direct `auth()` checks in API routes).

## Cross-Cutting Concerns

**Logging:** Console-backed logger abstraction in `src/lib/logger.ts`; actions/routes log operation context and errors.
**Validation:** Zod schemas in `src/lib/validations/*`, tool schemas in `src/lib/ai/tools.ts`, plus route-level guards in `src/app/api/*/route.ts`.
**Authentication:** Auth.js with Drizzle adapter (`auth.ts`) and JWT session strategy (`auth.config.ts`); consumed via `auth()` and `requireAuth()`.

---

_Architecture analysis: 2026-03-03_
