# Codebase Structure

**Analysis Date:** 2026-02-20

## Directory Layout

```
cashlytics/
├── src/                    # Application source code
│   ├── app/                # Next.js App Router
│   ├── components/         # React components (atomic design)
│   ├── actions/            # Server actions
│   ├── lib/                # Utilities and core logic
│   ├── hooks/              # Custom React hooks
│   ├── types/              # TypeScript type definitions
│   └── i18n/               # Internationalization config
├── public/                 # Static assets
├── messages/               # Translation JSON files
├── drizzle/                # Database migrations
├── scripts/                # Build and deployment scripts
├── docs/                   # Documentation
├── models/                 # (Empty - legacy/placeholder)
├── articles/               # (Empty - legacy/placeholder)
├── .claude/                # Claude AI assistant config
└── .planning/              # Planning documents
```

## Directory Purposes

**src/app:**
- Purpose: Next.js App Router pages, layouts, and API routes
- Contains: Route handlers, page components, layouts
- Key files: `layout.tsx` (root), `page.tsx` (redirect), `(dashboard)/` (route group)

**src/components:**
- Purpose: Reusable UI components following atomic design
- Contains: Organized component hierarchy
- Key files: `providers/index.tsx`, `layout/app-sidebar.tsx`, `organisms/chat-interface.tsx`

**src/actions:**
- Purpose: Server actions for data mutations
- Contains: One file per domain entity
- Key files: `accounts-actions.ts`, `expense-actions.ts`, `conversation-actions.ts`

**src/lib:**
- Purpose: Core utilities, database, and shared logic
- Contains: DB schema, AI tools, validators, helpers
- Key files: `db/schema.ts`, `ai/tools.ts`, `settings-context.tsx`

**src/hooks:**
- Purpose: Custom React hooks
- Contains: Reusable stateful logic
- Key files: `use-conversations.ts`, `use-toast.ts`, `use-mobile.ts`

**src/types:**
- Purpose: TypeScript type definitions
- Contains: Database model types, API response types
- Key files: `database.ts`

**src/i18n:**
- Purpose: Internationalization configuration
- Contains: Locale config, request handler
- Key files: `config.ts`, `request.ts`

## Key File Locations

### Entry Points:
- `src/app/layout.tsx`: Root layout with providers
- `src/app/page.tsx`: Landing page (redirects to dashboard)
- `src/app/(dashboard)/layout.tsx`: Dashboard shell with sidebar
- `src/app/api/chat/route.ts`: AI chat API endpoint

### Configuration:
- `package.json`: Dependencies and scripts
- `tsconfig.json`: TypeScript config with `@/*` path alias
- `drizzle.config.ts`: Database migration config
- `next.config.ts`: Next.js configuration
- `eslint.config.mjs`: ESLint rules

### Database:
- `src/lib/db/schema.ts`: Drizzle ORM schema definitions
- `src/lib/db/index.ts`: Database client initialization
- `drizzle/meta/`: Generated migration files

### Core Logic:
- `src/lib/ai/tools.ts`: AI tool definitions for assistant
- `src/lib/settings-context.tsx`: Global settings (locale, currency)
- `src/lib/utils.ts`: Utility functions (cn, etc.)
- `src/lib/currency.ts`: Currency formatting utilities

### Translations:
- `messages/de.json`: German translations
- `messages/en.json`: English translations
- `src/i18n/config.ts`: Locale configuration

### Testing:
- Not currently present in the codebase

## Naming Conventions

### Files:
- **Pages:** `page.tsx` (route segment), `client.tsx` (client component)
- **Layouts:** `layout.tsx`
- **API Routes:** `route.ts`
- **Components:** `kebab-case.tsx` (e.g., `expense-form.tsx`)
- **Actions:** `*-actions.ts` (e.g., `expense-actions.ts`)
- **Types:** `kebab-case.ts` (e.g., `database.ts`)
- **Hooks:** `use-*.ts` (e.g., `use-conversations.ts`)

### Directories:
- **Route groups:** `(name)` with parentheses (e.g., `(dashboard)`)
- **Dynamic routes:** `[param]` with brackets (e.g., `[id]`)
- **Components:** Plural nouns (e.g., `organisms/`, `molecules/`)

### Code:
- **Components:** PascalCase (e.g., `ExpenseForm`, `ChatInterface`)
- **Functions:** camelCase (e.g., `getAccounts`, `createExpense`)
- **Types:** PascalCase (e.g., `Account`, `ExpenseWithDetails`)
- **Constants:** camelCase or SCREAMING_SNAKE_CASE
- **Files with directive:** `'use client'` or `'use server'` at top

## Where to Add New Code

### New Feature (e.g., "Budgets"):
1. **Database schema:** Add table to `src/lib/db/schema.ts`
2. **Types:** Add types to `src/types/database.ts`
3. **Server actions:** Create `src/actions/budget-actions.ts`
4. **Validations:** Create `src/lib/validations/budget.ts`
5. **AI tool (if needed):** Add to `src/lib/ai/tools.ts`
6. **Page:** Create `src/app/(dashboard)/budgets/page.tsx` and `client.tsx`
7. **Components:** Add organisms/molecules in `src/components/`
8. **Translations:** Add keys to `messages/de.json` and `messages/en.json`
9. **Sidebar:** Add navigation item in `src/components/layout/app-sidebar.tsx`

### New Component/Module:
- **Atoms:** `src/components/atoms/` - Basic UI primitives
- **Molecules:** `src/components/molecules/` - Composed patterns
- **Organisms:** `src/components/organisms/` - Full features
- **Layout:** `src/components/layout/` - App structure
- **UI primitives:** `src/components/ui/` - shadcn/ui components

### New API Endpoint:
- Create `src/app/api/[endpoint]/route.ts`
- Export async `GET`, `POST`, `PUT`, or `DELETE` functions

### New AI Tool:
1. Define tool in `src/lib/ai/tools.ts`
2. Import corresponding server action
3. Add to exported `tools` object
4. Update system prompt in `src/app/api/chat/route.ts` if needed

### New Translation Keys:
1. Add key to `messages/de.json` (German - primary)
2. Add key to `messages/en.json` (English translation)
3. Use in component via `useTranslations('namespace')`

### Utilities:
- Shared helpers: `src/lib/utils.ts`
- Validators: `src/lib/validators/` or `src/lib/validations/`
- Domain-specific utilities: `src/lib/[domain].ts`

## Special Directories

**drizzle/:**
- Purpose: Database migration files
- Generated: Yes (by drizzle-kit)
- Committed: Yes

**public/:**
- Purpose: Static assets served directly
- Contains: Images, favicon, manifest

**messages/:**
- Purpose: Translation JSON files
- Generated: No (manually maintained)
- Committed: Yes

**.claude/:**
- Purpose: Claude AI assistant configuration
- Contains: Skills, agents, instructions
- Committed: Yes

**.planning/:**
- Purpose: Planning and analysis documents
- Contains: Codebase maps, phase plans
- Committed: Varies (typically yes for docs)

**.next/:**
- Purpose: Next.js build output
- Generated: Yes (by next build)
- Committed: No (in .gitignore)

**node_modules/:**
- Purpose: Package dependencies
- Generated: Yes (by npm install)
- Committed: No (in .gitignore)

## Route Structure

```
/                           → Redirects to /dashboard
/dashboard                  → Main dashboard (stats, recent transactions)
/overview                   → Financial overview
/accounts                   → Account list
/accounts/[id]              → Account detail
/expenses                   → Expense management
/income                     → Income management
/transfers                  → Transfer management
/categories                 → Category management
/analytics                  → Analytics and charts
/settings                   → App settings
/settings/categories        → Category settings
/assistant                  → AI chat assistant
/documents                  → Document management
/api/chat                   → AI chat streaming endpoint
/api/documents              → Document CRUD
/api/documents/[id]         → Single document operations
```

## Component Hierarchy

```
src/components/
├── providers/          # Context providers
│   ├── index.tsx           # Root Providers wrapper
│   └── theme-provider.tsx  # Theme context
├── layout/             # App structure
│   ├── app-sidebar.tsx     # Navigation sidebar
│   ├── header.tsx          # Top header
│   └── theme-toggle.tsx    # Dark/light switch
├── ui/                 # shadcn/ui primitives
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   └── ... (many more)
├── atoms/              # Basic components
│   └── category-select.tsx
├── molecules/          # Composed patterns
│   ├── chat-message.tsx
│   ├── chat-input.tsx
│   ├── file-upload.tsx
│   ├── document-list.tsx
│   └── ... (more)
├── organisms/          # Full features
│   ├── chat-interface.tsx
│   ├── expense-form.tsx
│   ├── income-form.tsx
│   ├── account-form.tsx
│   └── ... (more)
└── templates/          # Page layouts (if any)
```
