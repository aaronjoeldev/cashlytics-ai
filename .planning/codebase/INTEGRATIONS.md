# External Integrations

**Analysis Date:** 2026-03-03

## APIs & External Services

**AI/LLM:**

- OpenAI - AI assistant responses for `/api/chat`.
  - SDK/Client: `@ai-sdk/openai` with `ai` in `src/app/api/chat/route.ts`.
  - Auth: `OPENAI_API_KEY` (documented in `README.md`, wired in `docker-compose.selfhost.yml`).

**Email Delivery:**

- SMTP server or local sendmail - welcome and password-reset emails.
  - SDK/Client: `nodemailer` in `src/lib/email/transporter.ts`.
  - Auth: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, optional `SMTP_FROM`; optional transport switch `EMAIL_TRANSPORT` in `src/lib/email/transporter.ts`.

**Web Push Network:**

- Browser Push Services (via VAPID) - scheduled payment reminder notifications.
  - SDK/Client: `web-push` in `src/lib/push.ts`.
  - Auth: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` in `src/lib/push.ts` and `src/app/api/push/vapid-public-key/route.ts`.

**Auth Session Protocol:**

- Auth.js HTTP endpoints - authentication/session callback handling.
  - SDK/Client: `next-auth` in `auth.ts` and `src/app/api/auth/[...nextauth]/route.ts`.
  - Auth: `AUTH_SECRET` in `src/proxy.ts`.

## Data Storage

**Databases:**

- PostgreSQL (self-hosted container by default).
  - Connection: `DATABASE_URL` in `src/lib/db/index.ts` and `drizzle.config.ts`.
  - Client: `drizzle-orm` + `postgres` in `src/lib/db/index.ts`; schema in `src/lib/db/schema.ts`.

**File Storage:**

- Stored in PostgreSQL as base64 document payloads (`documents.data`) rather than object storage.
  - Implementation: `src/app/api/documents/route.ts`, `src/app/api/documents/[id]/route.ts`, `src/lib/db/schema.ts`.

**Caching:**

- No external cache detected.
- In-memory process cache/rate limit only (`Map`) in `src/lib/rate-limiter.ts`.
- Browser/service-worker cache for static and API responses in `public/sw.js`.

## Authentication & Identity

**Auth Provider:**

- Custom credentials auth using Auth.js with Drizzle adapter (no OAuth provider configured).
  - Implementation: credentials provider in `auth.ts`, adapter tables in `src/lib/db/schema.ts`, JWT session strategy in `auth.config.ts`.

## Monitoring & Observability

**Error Tracking:**

- None detected for external SaaS trackers (no Sentry/Datadog/New Relic SDK usage in `src/**`).

**Logs:**

- Structured console logging through a local logger utility in `src/lib/logger.ts`.
- API routes and actions use `logger.error/info/warn` (examples: `src/app/api/chat/route.ts`, `src/app/api/documents/route.ts`, `src/actions/auth-actions.ts`).

## CI/CD & Deployment

**Hosting:**

- GitHub Container Registry image publication (`ghcr.io/...`) in `.github/workflows/release.yml`.
- Self-host deployment via Docker Compose in `docker-compose.selfhost.yml`.

**CI Pipeline:**

- GitHub Actions for release orchestration, Docker build/push, and semantic-release in `.github/workflows/release.yml`.

## Environment Configuration

**Required env vars:**

- `DATABASE_URL` (DB connection) in `src/lib/db/index.ts`.
- `AUTH_SECRET` (JWT/session token secret) in `src/proxy.ts`.
- `NEXT_PUBLIC_APP_URL` (public URL for links/runtime config) documented in `README.md` and set in `docker-compose.selfhost.yml`.

**Feature-gated env vars:**

- AI: `OPENAI_API_KEY` (`src/app/api/chat/route.ts`, `docker-compose.selfhost.yml`).
- Email: `EMAIL_TRANSPORT`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `APP_URL` (`src/lib/email/transporter.ts`, `src/actions/auth-actions.ts`).
- Push/Cron: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` (`src/lib/push.ts`, `src/app/api/cron/upcoming-payments/route.ts`).
- Registration/locale/currency: `SINGLE_USER_MODE`, `SINGLE_USER_EMAIL`, `NEXT_PUBLIC_DEFAULT_LOCALE`, `NEXT_PUBLIC_DEFAULT_CURRENCY` (`src/lib/auth/registration-mode.ts`, `src/lib/auth/user-id.ts`, `src/i18n/config.ts`, `src/lib/currency.ts`).

**Secrets location:**

- `.env` and `.env.local` files are present for local/deployment secret injection.
- GitHub Actions secrets are used in CI (`secrets.GITHUB_TOKEN`) in `.github/workflows/release.yml`.

## Webhooks & Callbacks

**Incoming:**

- Auth callback handler endpoint: `/api/auth/[...nextauth]` in `src/app/api/auth/[...nextauth]/route.ts`.
- Scheduled internal callback endpoint protected by bearer token: `/api/cron/upcoming-payments` in `src/app/api/cron/upcoming-payments/route.ts`.
- Push subscription registration endpoints: `/api/push/subscribe` and `/api/push/vapid-public-key` in `src/app/api/push/subscribe/route.ts` and `src/app/api/push/vapid-public-key/route.ts`.

**Outgoing:**

- Outbound SMTP email through configured mail server from `src/lib/email/transporter.ts`.
- Outbound web-push notification sends via `webpush.sendNotification` in `src/lib/push.ts`.
- No third-party webhook POST targets detected in application code under `src/**`.

---

_Integration audit: 2026-03-03_
