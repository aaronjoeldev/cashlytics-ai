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
  <a href="https://cashlytics.online"><strong>🌐 cashlytics.online</strong></a>
  &nbsp;•&nbsp;
  <a href="https://docs.cashlytics.online"><strong>📚 docs.cashlytics.online</strong></a>
</p>

<p align="center"><strong>Self-hosted personal finance &amp; budget planning application with AI-powered assistance.</strong></p>

<p align="center">Cashlytics helps you take control of your finances with a beautiful, intuitive interface. Track your income, expenses, and account balances all in one place — without sending your data to third parties.</p>

![Dashboard Preview](https://cashlytics.online/_next/image?url=%2Fscreenshots%2Fhero-dashboard.jpg&w=1200&q=75)

## ✨ Features

- 📊 **Dashboard** — Get a complete overview of your financial situation at a glance
- 🏦 **Multi-Account Management** — Track checking, savings, and investment accounts
- 💰 **Income Tracking** — Record income sources with recurring patterns (monthly, yearly, one-time)
- 💸 **Expense Tracking** — Categorize and monitor your spending habits
- 🔄 **Account Transfers** — Move money between your accounts with ease
- 📈 **Analytics & Forecasting** — Visualize trends and predict future balances
- 🔐 **User Authentication** — Secure multi-user support with login system
- 🔑 **Password Reset** — Self-service password recovery via email (optional SMTP)
- 🤖 **AI Assistant** — Chat with an AI-powered financial assistant (requires OpenAI API key)
- 🧾 **Receipt Scanner** — Photograph or upload receipts and invoices; AI extracts merchant, amount, date, and category automatically (requires OpenAI API key)
- 📥 **CSV Import + AI Reconciliation** — Import bank CSV files, detect duplicates, review conflicts, and confirm transactionally (requires OpenAI API key)
- 🏷️ **Categories** — Organize transactions with custom categories
- 🌍 **Multi-Language** — Available in English and German
- 🌓 **Dark/Light Theme** — Easy on the eyes, day or night
- 📱 **Progressive Web App (PWA)** — Installable on desktop and mobile with offline support
- 🔔 **Push Notifications** — Browser notifications for upcoming payment reminders
- 🐳 **Self-Hostable** — Run it on your own server with Docker

---

## 🚀 Quick Start

The fastest way to get Cashlytics running:

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### 1. Download docker-compose.yml

```bash
mkdir cashlytics && cd cashlytics
curl -O https://raw.githubusercontent.com/aaronjoeldev/cashlytics-ai/main/docker-compose.selfhost.yml
curl -O https://raw.githubusercontent.com/aaronjoeldev/cashlytics-ai/main/.env.example
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` and set your values:

```bash
# Required: Set a secure password for the database
POSTGRES_PASSWORD=your_secure_password_here

# Required: Auth.js secret (generate with: npx auth secret)
AUTH_SECRET=replace_with_a_long_random_secret

# Recommended for Docker/VPS/reverse proxy deployments
AUTH_TRUST_HOST=true

# Optional: Registration mode
# true = only first user can register, false = open registration
SINGLE_USER_MODE=true

# Optional: Default language/currency
NEXT_PUBLIC_DEFAULT_LOCALE=de
NEXT_PUBLIC_DEFAULT_CURRENCY=EUR

# Optional: Enable AI Assistant (requires OpenAI API key)
OPENAI_API_KEY=sk-your-openai-key

# Optional: Enable push notifications and scheduler for payment reminders
# VAPID_PUBLIC_KEY=
# VAPID_PRIVATE_KEY=
# VAPID_SUBJECT=mailto:you@example.com
# CRON_SECRET=
# NOTIFICATION_SCHEDULE=0 8 * * *
# INSIGHTS_SCHEDULE=0 6 * * *
```

### 3. Start Cashlytics

```bash
docker compose -f docker-compose.selfhost.yml up -d
```

### 4. Access the Application

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📖 Installation Guide

### Option A: Docker Compose (Recommended)

The Docker Compose setup includes everything you need:

- **Cashlytics App** — The main application
- **Cashlytics Cron** — Scheduled upcoming-payment notification checks
- **PostgreSQL 16** — Database for storing your financial data

```yaml
# docker-compose.selfhost.yml
services:
  cashlytics:
    image: ghcr.io/aaronjoeldev/cashlytics-ai:latest
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://cashlytics:${POSTGRES_PASSWORD}@postgres:5432/cashlytics
      - NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:-http://localhost:3000}
      - NEXT_PUBLIC_DEFAULT_LOCALE=${NEXT_PUBLIC_DEFAULT_LOCALE:-de}
      - NEXT_PUBLIC_DEFAULT_CURRENCY=${NEXT_PUBLIC_DEFAULT_CURRENCY:-EUR}
      - AUTH_SECRET=${AUTH_SECRET}
      - AUTH_TRUST_HOST=${AUTH_TRUST_HOST:-true}
      - SINGLE_USER_MODE=${SINGLE_USER_MODE:-true}
      - SINGLE_USER_EMAIL=${SINGLE_USER_EMAIL:-}
      - OPENAI_API_KEY=${OPENAI_API_KEY:-}
      - VAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY:-}
      - VAPID_PRIVATE_KEY=${VAPID_PRIVATE_KEY:-}
      - VAPID_SUBJECT=${VAPID_SUBJECT:-}
      - CRON_SECRET=${CRON_SECRET:-}
      - EMAIL_TRANSPORT=${EMAIL_TRANSPORT:-}
      - SMTP_HOST=${SMTP_HOST:-}
      - SMTP_PORT=${SMTP_PORT:-}
      - SMTP_USER=${SMTP_USER:-}
      - SMTP_PASS=${SMTP_PASS:-}
      - SMTP_FROM=${SMTP_FROM:-}
      - APP_URL=${APP_URL:-}
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  cashlytics-cron:
    image: alpine:3.20
    restart: unless-stopped
    environment:
      CRON_SECRET: ${CRON_SECRET}
      APP_URL: http://cashlytics:3000
      NOTIFICATION_SCHEDULE: ${NOTIFICATION_SCHEDULE:-0 8 * * *}
      # Insights for the AI assistant (default 06:00 UTC daily)
      INSIGHTS_SCHEDULE: ${INSIGHTS_SCHEDULE:-0 6 * * *}
    depends_on:
      cashlytics:
        condition: service_healthy
    command: >
      sh -c "apk add --no-cache curl --quiet &&
             printf '%s\\n' \"$$NOTIFICATION_SCHEDULE curl -s -H 'Authorization: Bearer $$CRON_SECRET' $$APP_URL/api/cron/upcoming-payments >> /var/log/cron.log 2>&1\" \"$$INSIGHTS_SCHEDULE curl -s -H 'Authorization: Bearer $$CRON_SECRET' $$APP_URL/api/cron/insights >> /var/log/cron.log 2>&1\" | crontab - &&
             crond -f -l 2"

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=cashlytics
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=cashlytics
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cashlytics -d cashlytics"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
```

### Option B: Manual Setup

For development or custom deployments:

```bash
# Clone the repository
git clone https://github.com/aaronjoeldev/cashlytics-ai.git
cd cashlytics-ai

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your settings

# Run database migrations
npm run db:push

# Start the development server
npm run dev

# Or build for production
npm run build
npm start
```

---

## ⚙️ Configuration

### Environment Variables

| Variable                       | Required | Default                 | Description                                                            |
| ------------------------------ | -------- | ----------------------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`                 | ✅ Yes   | —                       | PostgreSQL connection string                                           |
| `POSTGRES_PASSWORD`            | ✅ Yes   | —                       | PostgreSQL password used by Compose and `DATABASE_URL`                 |
| `NEXT_PUBLIC_APP_URL`          | ✅ Yes   | `http://localhost:3000` | Public URL of your Cashlytics instance                                 |
| `AUTH_SECRET`                  | ✅ Yes   | —                       | Secret for JWT encryption (generate with `npx auth secret`)            |
| `AUTH_TRUST_HOST`              | ⚠️ Often | `true`                  | Set to `true` for IP/domain, reverse proxy, VPS, Docker ingress        |
| `SINGLE_USER_MODE`             | ❌ No    | `true`                  | Set to `false` to allow open registration                              |
| `SINGLE_USER_EMAIL`            | ❌ No    | —                       | Email used by single-user migration scripts                            |
| `NEXT_PUBLIC_DEFAULT_LOCALE`   | ❌ No    | `de`                    | Default locale (`de` or `en`)                                          |
| `NEXT_PUBLIC_DEFAULT_CURRENCY` | ❌ No    | `EUR`                   | Default currency for new UI/session state                              |
| `OPENAI_API_KEY`               | ❌ No    | —                       | OpenAI API key — enables AI Assistant, Receipt Scanner, and CSV Import |
| `EMAIL_TRANSPORT`              | ❌ No    | `smtp`/auto             | Mail transport (`smtp` or `sendmail`)                                  |
| `SMTP_HOST`                    | ❌ No    | —                       | SMTP server hostname (e.g., `smtp.gmail.com`)                          |
| `SMTP_PORT`                    | ❌ No    | —                       | SMTP port (587 for STARTTLS, 465 for TLS)                              |
| `SMTP_USER`                    | ❌ No    | —                       | SMTP authentication username                                           |
| `SMTP_PASS`                    | ❌ No    | —                       | SMTP authentication password                                           |
| `SMTP_FROM`                    | ❌ No    | `SMTP_USER`             | From address for outgoing emails                                       |
| `APP_URL`                      | ❌ No    | `NEXT_PUBLIC_APP_URL`   | Server-side URL for email links                                        |
| `VAPID_PUBLIC_KEY`             | ❌ No    | —                       | Public VAPID key for browser push subscriptions                        |
| `VAPID_PRIVATE_KEY`            | ❌ No    | —                       | Private VAPID key used to sign push messages                           |
| `VAPID_SUBJECT`                | ❌ No    | —                       | Contact URI for VAPID (`mailto:...` or `https://...`)                  |
| `CRON_SECRET`                  | ❌ No    | —                       | Bearer token for the scheduled reminder and insights endpoints         |
| `NOTIFICATION_SCHEDULE`        | ❌ No    | `0 8 * * *`             | Cron schedule for upcoming-payment checks                              |
| `INSIGHTS_SCHEDULE`            | ❌ No    | `0 6 * * *`             | Cron schedule for the AI assistant's spending insights                 |

### Database Configuration

The `DATABASE_URL` follows this format:

```
postgresql://[user]:[password]@[host]:[port]/[database]
```

Example:

```
postgresql://cashlytics:mypassword@postgres:5432/cashlytics
```

### AI Features (Optional)

Three features share a single API key: **AI Assistant**, **Receipt Scanner**, and **CSV Import with AI Reconciliation**.

1. Get an API key from [OpenAI](https://platform.openai.com/api-keys)
2. Add it to your `.env` file:
   ```
   OPENAI_API_KEY=sk-proj-your-key-here
   ```

> **Note:** Without an OpenAI API key, Cashlytics works fully for manual entry — AI Assistant, Receipt Scanner, and CSV Import are simply hidden.

### Receipt Scanner (Optional)

The receipt scanner lets you photograph or upload a receipt (JPG, PNG, max 5 MB) and have the AI extract all relevant data automatically.

**How it works:**

1. Open the **Receipt Scanner** from the sidebar or the `+` speed-dial button.
2. Upload or drag-and-drop a receipt image.
3. The AI (GPT-4o mini) extracts merchant, amount, date, and suggests a matching category from your existing categories.
4. Review and correct the pre-filled form, then save — the image is automatically attached as a document to the expense.

The scanner page lives at `/scan` and is bookmarkable, making it ideal as a home-screen shortcut on mobile. A confidence indicator warns you when the image quality may affect accuracy.

> **Requires:** `OPENAI_API_KEY`

### CSV Import With AI Reconciliation (Optional)

CSV import is available only when `OPENAI_API_KEY` is configured. If the key is missing, import entry points are hidden and import endpoints reject access.

Implementation references:

- `/.planning/features/csv-import/IMPLEMENTATION-PLAN.md`
- `/.planning/features/csv-import/AI-RECONCILIATION-PROMPT.md`
- `/.planning/features/csv-import/PROJECT-CONTEXT.md`

Canonical CSV header template used by the import pipeline:

```csv
booking_date,amount,currency,description,counterparty,sender_account,receiver_account,balance_after_booking,reference
```

Prompt/output contract highlights:

- Prompt language is English.
- AI response must be strict JSON only.
- Each result includes `import_row_id`, `match_type`, `matched_existing_id`, `similarity_score`, `confidence`, `decision_suggestion`, `reason_short`, and `field_comparison`.

Operational constraints:

- All import reads/writes are user-scoped.
- Import is staged first; rows are reviewed before final confirmation.
- Final import confirmation is transactional.
- Conflict decisions are required before confirmation.

### Email & Password Reset (Optional)

To enable password reset and welcome emails, configure SMTP:

1. Add your SMTP settings to `.env`:

   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   SMTP_FROM=noreply@yourdomain.com
   APP_URL=https://your-domain.com
   ```

2. For Gmail, you'll need an [App Password](https://support.google.com/accounts/answer/185833)

> **Note:** Without SMTP configuration, Cashlytics works normally but users cannot reset passwords via email. Registration still works — users just won't receive welcome emails.

### PWA & Push Notifications (Optional)

Cashlytics is now available as a Progressive Web App (PWA) and supports browser push notifications for upcoming payments.

1. Generate VAPID keys:

   ```bash
   npx web-push generate-vapid-keys
   ```

2. Add these values to `.env`:

   ```bash
   VAPID_PUBLIC_KEY=...
   VAPID_PRIVATE_KEY=...
   VAPID_SUBJECT=mailto:you@example.com
   CRON_SECRET=$(openssl rand -hex 32)
   # Optional: run daily at 08:00 UTC by default
   NOTIFICATION_SCHEDULE=0 8 * * *
   ```

3. Keep the `cashlytics-cron` service enabled in `docker-compose.selfhost.yml`. It also generates
   the spending insights for the AI assistant once a day (`INSIGHTS_SCHEDULE`, default 06:00 UTC).

4. In the app, open Settings and enable notification permissions in your browser.

### Registration Modes

Cashlytics supports two registration modes:

- **Single User Mode** (`SINGLE_USER_MODE=true`) — Only the first user can register. Perfect for personal/self-hosted deployments.
- **Multi User Mode** (`SINGLE_USER_MODE=false`) — Open registration for anyone. Suitable for family or team deployments.

---

## 🛠️ Tech Stack

- **Frontend:** [Next.js 16](https://nextjs.org/), [React 19](https://react.dev/), [Tailwind CSS 4](https://tailwindcss.com/)
- **UI Components:** [shadcn/ui](https://ui.shadcn.com/), [Radix UI](https://www.radix-ui.com/)
- **Database:** [PostgreSQL](https://www.postgresql.org/), [Drizzle ORM](https://orm.drizzle.team/)
- **Authentication:** [Auth.js](https://authjs.dev/), bcrypt password hashing
- **Email:** [Nodemailer](https://nodemailer.com/), [React Email](https://react.email/)
- **AI:** [Vercel AI SDK](https://sdk.vercel.ai/), [OpenAI](https://openai.com/)
- **Internationalization:** [next-intl](https://next-intl-docs.vercel.app/)
- **Containerization:** [Docker](https://www.docker.com/)

---

## 🗺️ Roadmap

### High Priority 🔴

| Feature             | Status      | Description                                     |
| ------------------- | ----------- | ----------------------------------------------- |
| User Authentication | ✅ Complete | Multi-user support with secure login system     |
| Password Reset      | ✅ Complete | Self-service password recovery via email (SMTP) |
| Welcome Emails      | ✅ Complete | Branded welcome email on registration (SMTP)    |
| Budget Alerts       | ✅ Complete | Notifications when expense is coming up         |
| Mobile PWA          | ✅ Complete | Installable app experience on mobile/desktop    |
| Push Notifications  | ✅ Complete | Browser push reminders for upcoming payments    |

### Medium Priority 🟡

| Feature          | Status     | Description                                 |
| ---------------- | ---------- | ------------------------------------------- |
| Export/Import    | 🔲 Planned | CSV & PDF export; data import functionality |
| Bank Integration | 🔲 Planned | FinTS/PSD2 API connection for German banks  |

### Future 🟢

| Feature             | Status     | Description                            |
| ------------------- | ---------- | -------------------------------------- |
| Investment Tracking | 🔲 Planned | Enhanced portfolio management features |
| Currency Conversion | 🔲 Planned | Multi-currency support with live rates |

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Report Bugs** — Open an issue with a detailed description
2. **Suggest Features** — Share your ideas in the discussions
3. **Submit Pull Requests** — Fix bugs or add new features

### Development Setup

```bash
git clone https://github.com/aaronjoeldev/cashlytics-ai.git
cd cashlytics-ai
npm install
npm run dev
```

### Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New features
- `fix:` — Bug fixes
- `docs:` — Documentation changes
- `chore:` — Maintenance tasks

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

```
MIT License

Copyright (c) 2025 aaronjoeldev

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

---

## 🙏 Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) for the beautiful UI components
- [Lucide](https://lucide.dev/) for the icons
- [Vercel](https://vercel.com/) for the AI SDK

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/aaronjoeldev">aaronjoeldev</a>
</p>
