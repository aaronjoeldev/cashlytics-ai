# External Integrations

**Analysis Date:** 2026-02-20

## APIs & External Services

**AI/LLM:**
- OpenAI API - AI-powered financial assistant
  - SDK: `@ai-sdk/openai` + `ai` (Vercel AI SDK)
  - Model: `gpt-4o`
  - Auth: `OPENAI_API_KEY` environment variable
  - Feature: Optional - assistant disabled without key
  - Location: `src/app/api/chat/route.ts`

## Data Storage

**Databases:**
- PostgreSQL 16
  - Connection: `DATABASE_URL` environment variable
  - Format: `postgresql://[user]:[password]@[host]:[port]/[database]`
  - Client: `postgres` (node-postgres) with Drizzle ORM
  - Schema: `src/lib/db/schema.ts`
  - Migrations: `drizzle/` directory (3 migrations present)
  - Tables: `accounts`, `categories`, `expenses`, `incomes`, `daily_expenses`, `transfers`, `documents`, `conversations`, `messages`

**File Storage:**
- Database-embedded - Documents stored as base64 text in `documents` table
  - Field: `documents.data` (text, base64-encoded)
  - No external file storage service

**Caching:**
- None detected - No Redis, Memcached, or similar

## Authentication & Identity

**Auth Provider:**
- None - Single-user self-hosted application
  - No authentication layer
  - Designed for personal/local deployment
  - No user accounts or sessions

## Monitoring & Observability

**Error Tracking:**
- Console logging only - `console.error()` in server actions and API routes

**Logs:**
- Development: AI step logging in chat API when `NODE_ENV=development`
- Production: Standard console output to Docker logs

**Analytics:**
- None - No analytics service integrated

## CI/CD & Deployment

**Hosting:**
- Docker containers
- GitHub Container Registry (`ghcr.io`)
- Self-hosted deployment model

**CI Pipeline:**
- GitHub Actions (`.github/workflows/release.yml`)
- Triggers: Push to `main` branch
- Steps:
  1. Semantic Release versioning
  2. Version file update (`src/lib/version.ts`)
  3. Docker image build and push to GHCR

**Release Automation:**
- Semantic Release (`.releaserc.json`)
- Conventional commits preset
- Auto-generated CHANGELOG.md
- GitHub releases created automatically
- Docker tags: `v{version}`, `latest`, `{sha}`

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - PostgreSQL connection string
- `NEXT_PUBLIC_APP_URL` - Public URL for the application

**Optional env vars:**
- `OPENAI_API_KEY` - Enable AI assistant (sk-proj-...)
- `POSTGRES_PASSWORD` - Docker PostgreSQL password
- `NEXT_PUBLIC_DEFAULT_LOCALE` - Default language ('de' or 'en')

**Secrets location:**
- `.env` file (local development)
- `.env.local` file (local overrides)
- Docker environment variables (production)
- GitHub Secrets (CI/CD - `GITHUB_TOKEN`)

## Webhooks & Callbacks

**Incoming:**
- None - No webhook endpoints

**Outgoing:**
- None - No external API callbacks

## Document Storage

**Implementation:**
- Documents attached to expenses (recurring and daily)
- Stored as base64-encoded text in database
- MIME type and filename preserved
- Cascade delete with parent expense

**Schema:**
```typescript
documents: {
  id: uuid
  expenseId: uuid?       // Links to expenses
  dailyExpenseId: uuid?  // Links to daily_expenses
  fileName: text
  mimeType: text
  size: integer
  data: text             // Base64-encoded file content
  createdAt: timestamp
}
```

## Localization

**Translation Files:**
- `messages/de.json` - German (primary)
- `messages/en.json` - English

**Framework:**
- next-intl with cookie-based locale detection
- Server-side locale resolution via `getRequestConfig()`
- Default: German ('de')

---

*Integration audit: 2026-02-20*
