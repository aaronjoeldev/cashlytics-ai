# Technology Stack

**Analysis Date:** 2026-03-03

## Languages

**Primary:**

- TypeScript 5.x - Application code in `src/**/*.ts` and `src/**/*.tsx`, plus root config in `auth.ts` and `auth.config.ts`.

**Secondary:**

- JavaScript (ESM) - Tooling/config in `eslint.config.mjs`, `postcss.config.mjs`, and service worker code in `public/sw.js`.
- SQL - Schema migrations in `drizzle/*.sql` and demo seed data in `scripts/seed-demo.sql`.
- Shell - Container startup and helper scripts in `entrypoint.sh`, `start-postgres.sh`, and `scripts/demo-reset.sh`.

## Runtime

**Environment:**

- Node.js 20 (container and CI baseline) in `Dockerfile` and `.github/workflows/release.yml`.
- Next.js server runtime with an Edge middleware/proxy path in `src/proxy.ts`.

**Package Manager:**

- npm (invoked by `npm ci`, `npm run ...`) in `.github/workflows/release.yml` and `README.md`.
- Lockfile: present (`package-lock.json`).

## Frameworks

**Core:**

- Next.js 16.1.6 - App Router web framework (`package.json`, `src/app/**`, `next.config.ts`).
- React 19.2.3 - UI runtime (`package.json`, `src/components/**`).
- Tailwind CSS 4 - Styling pipeline (`package.json`, `postcss.config.mjs`, `src/app/globals.css`).

**Testing:**

- No dedicated test framework detected in `package.json` scripts; at least one test file exists at `src/lib/billing/subscriptions.test.ts`.

**Build/Dev:**

- TypeScript compiler (`typescript`) with path aliases in `tsconfig.json`.
- ESLint 9 + `eslint-config-next` + `eslint-config-prettier` in `eslint.config.mjs`.
- Prettier 3 + Tailwind plugin in `package.json`.
- Drizzle Kit for schema generation/migration in `package.json` and `drizzle.config.ts`.
- Husky + lint-staged for pre-commit checks in `package.json` and `.husky/pre-commit`.
- Semantic Release for versioning/changelog automation in `.releaserc.json`.

## Key Dependencies

**Critical:**

- `next`, `react`, `react-dom` - Core web app runtime in `package.json`.
- `drizzle-orm` + `postgres` - Database access layer in `src/lib/db/index.ts`.
- `next-auth` + `@auth/drizzle-adapter` - Auth/session and adapter wiring in `auth.ts`.
- `zod` - Input validation in API/server actions (for example `src/app/api/push/subscribe/route.ts`, `src/actions/auth-actions.ts`).
- `ai` + `@ai-sdk/openai` - LLM streaming/chat in `src/app/api/chat/route.ts`.

**Infrastructure:**

- `nodemailer` + `@react-email/*` - Transactional email transport and templates in `src/lib/email/transporter.ts` and `src/emails/*.tsx`.
- `web-push` - VAPID push notifications in `src/lib/push.ts`.
- `next-intl` - Internationalization plugin and runtime in `next.config.ts` and `src/i18n/request.ts`.
- `date-fns` - Date calculation for recurring-payment reminders in `src/lib/cron/upcoming-payments.ts`.

## Configuration

**Environment:**

- Environment variables are consumed through `process.env` in `src/lib/db/index.ts`, `src/proxy.ts`, `src/lib/email/transporter.ts`, `src/lib/push.ts`, `src/actions/auth-actions.ts`, `src/app/api/cron/upcoming-payments/route.ts`, and `src/i18n/config.ts`.
- `.env` and `.env.local` files are present for environment configuration.
- Drizzle CLI loads env vars via `dotenv/config` in `drizzle.config.ts`.

**Build:**

- Next.js build configuration and standalone output in `next.config.ts`.
- Multi-stage production image build in `Dockerfile`.
- Release/build pipeline in `.github/workflows/release.yml`.

## Platform Requirements

**Development:**

- Node.js + npm workflow (`README.md`, `package.json`).
- PostgreSQL-compatible `DATABASE_URL` required for DB-backed features (`src/lib/db/index.ts`, `drizzle.config.ts`).

**Production:**

- Container-first deployment path (GHCR image + Compose) in `docker-compose.selfhost.yml` and `.github/workflows/release.yml`.
- Persistent PostgreSQL 16 service expected in `docker-compose.selfhost.yml`.

---

_Stack analysis: 2026-03-03_
