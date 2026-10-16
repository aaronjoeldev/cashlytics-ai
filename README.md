<p align="center">
  <img src="https://raw.githubusercontent.com/aaronjoeldev/cashlytics-ai/main/public/logo.svg" alt="Cashlytics" width="220" />
</p>

<h1 align="center">Cashlytics</h1>

<p align="center">
  <a href="https://github.com/aaronjoeldev/cashlytics-ai/releases"><img src="https://img.shields.io/github/v/release/aaronjoeldev/cashlytics-ai?include_prereleases" alt="Release" /></a>
  <a href="https://github.com/aaronjoeldev/cashlytics-ai/pkgs/container/cashlytics-ai"><img src="https://img.shields.io/badge/ghcr.io-aaronjoeldev%2Fcashlytics--ai-blue" alt="Docker" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/aaronjoeldev/cashlytics-ai" alt="License" /></a>
</p>

<p align="center">
  <a href="https://cashlytics.online"><strong>cashlytics.online</strong></a>
  &nbsp;•&nbsp;
  <a href="https://docs.cashlytics.online"><strong>docs.cashlytics.online</strong></a>
</p>

<p align="center">Self-hosted budget planning with an optional AI assistant. Your data stays on your server.</p>

![Dashboard Preview](https://cashlytics.online/_next/image?url=%2Fscreenshots%2Fhero-dashboard.jpg&w=1200&q=75)

## Features

- **Accounts, income, expenses, transfers** with recurring schedules (monthly, quarterly, yearly, custom intervals, …)
- **Reserve plan** for bills that come less often than monthly: a fixed monthly amount per bill, what should be set aside by today, and a reserve pot the app keeps up to date from your planned transfers
- **Salary plan** that splits your monthly income into fixed costs, reserves, an everyday budget, savings and what is left, and lists the transfers to make on payday
- **Dashboard, overview and analytics** with payment calendar and forecasts
- **Multi-currency**: entries keep their own currency, totals are converted with daily exchange rates
- **AI assistant** that answers questions and books entries after your approval _(OpenAI key)_
- **Receipt scanner** that reads merchant, amount, date and category from a photo _(OpenAI key)_
- **CSV import** of bank exports with duplicate detection and review before anything is saved _(OpenAI key)_
- **Multi-user** with password reset by e-mail, or single-user mode for personal installs
- **PWA** with offline access to visited pages and push reminders for upcoming payments
- German and English, light and dark theme

## Quick start (Docker)

```bash
mkdir cashlytics && cd cashlytics
curl -O https://raw.githubusercontent.com/aaronjoeldev/cashlytics-ai/main/docker-compose.selfhost.yml
curl -o .env https://raw.githubusercontent.com/aaronjoeldev/cashlytics-ai/main/.env.example
```

Set at least `POSTGRES_PASSWORD` (also inside `DATABASE_URL`), `AUTH_SECRET` (`openssl rand -base64 32`) and `NEXT_PUBLIC_APP_URL` in `.env`, then:

```bash
docker compose -f docker-compose.selfhost.yml up -d
```

Open <http://localhost:3000> and register. The stack runs the app (migrations run on start), PostgreSQL 16 and a small cron container for payment reminders and the assistant's daily insights.

## Configuration

All variables are documented in [`.env.example`](.env.example). The important ones:

| Variable                                 | Purpose                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| `DATABASE_URL`, `POSTGRES_PASSWORD`      | Database connection (required)                                                |
| `AUTH_SECRET`                            | Session encryption (required)                                                 |
| `NEXT_PUBLIC_APP_URL`, `AUTH_TRUST_HOST` | Public URL; keep `AUTH_TRUST_HOST=true` behind a proxy or on a server         |
| `SINGLE_USER_MODE`                       | `true`: only the first account can register; `false`: open registration       |
| `OPENAI_API_KEY`                         | Enables assistant, receipt scanner and CSV import; without it they are hidden |
| `SMTP_*`, `EMAIL_TRANSPORT`, `APP_URL`   | E-mail for password reset and welcome mails                                   |
| `VAPID_*`                                | Push notifications (`npx web-push generate-vapid-keys`)                       |
| `CRON_SECRET`                            | Required for payment reminders and insights (`openssl rand -hex 32`)          |

Language and base currency are chosen per user in the settings. Exchange rates come from the [Frankfurter API](https://frankfurter.dev) (ECB data) and are cached for a day; without network access the app falls back to built-in rates.

### CSV import

Upload a CSV export from your bank under **CSV-Import**. Column names are recognised in English, German and Danish (for example `Buchungsdatum`, `Betrag`, `Verwendungszweck`); only date and amount are required, and files in Windows-1252 work as well. A template is available on the import page. Rows are staged first: exact duplicates and, with the AI, similar existing entries are shown for review, and nothing is saved until you confirm.

## Development

Requires Node 24, Docker (for PostgreSQL) and Git 2.32 or newer (for the pre-commit hook).

```bash
git clone https://github.com/aaronjoeldev/cashlytics-ai.git
cd cashlytics-ai
npm install
cp .env.example .env
# in .env: DATABASE_URL=postgresql://cashlytics:cashlytics_secret@localhost:5432/cashlytics
./scripts/dev.sh       # PostgreSQL in Docker, migrations, then `npm run dev`
```

`npm run db:migrate` applies migrations; after a schema change in `src/lib/db/schema.ts` create one with `npm run db:generate`. Demo data: `psql "$DATABASE_URL" -f scripts/seed-demo.sql` **deletes all data** and creates the demo user `demo@cashlytics.online` / `admin123456789`.

| Command                               | Purpose                      |
| ------------------------------------- | ---------------------------- |
| `npm run dev`                         | Development server           |
| `npm test`                            | Unit tests (`node:test`)     |
| `npm run typecheck` / `npm run lint`  | TypeScript and ESLint        |
| `npm run build` / `npm start`         | Production build and server  |
| `npm run e2e:up` / `npm run e2e:down` | Start / remove the e2e stack |
| `npm run test:e2e`                    | End-to-end tests             |

### End-to-end tests

`npm run e2e:up` builds the production image from your checkout and starts it with PostgreSQL, [Mailpit](https://mailpit.axllent.org) and a fake OpenAI API (`e2e/fake-openai.mjs`) on ports 3100, 55432, 18025 and 14011. `npm run test:e2e` then **resets the stack's database to the demo data** and drives the app with Chrome (`CHROME_PATH` if it is not found); `npm run test:e2e -- auth forms` runs single suites. After code changes run `npm run e2e:up` again to rebuild. CI runs the unit and end-to-end tests on every pull request.

### Project structure

```
src/
  app/          Next.js routes: (auth) pages, (dashboard) pages, api/ (chat, cron, push, v1, …)
  actions/      Server actions, one file per domain; every export is a public endpoint
  components/   ui/ (shadcn), molecules/, organisms/, layout/
  lib/          Domain logic: recurrence, currency and rates, import pipeline, AI tools,
                insights, auth helpers, validation schemas, database schema
  emails/       React Email templates
messages/       Translations (de, en)
drizzle/        SQL migrations
scripts/        dev.sh, demo seed
e2e/            End-to-end suites, Docker stack, fake OpenAI API
docs/api/       REST API v1 for integrations (Home Assistant)
docs/audit/     Open findings from the code audit
```

Conventions: server actions call `requireAuth()` first and validate input with the schemas in `src/lib/validations/action-input.ts`; calendar days are stored as UTC midnight; account balances are planning values and are not changed by entries.

Commits follow [Conventional Commits](https://www.conventionalcommits.org/); releases and the Docker image are created by semantic-release on `main`.

## License

[MIT](LICENSE)
