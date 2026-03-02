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
- 🏷️ **Categories** — Organize transactions with custom categories
- 🌍 **Multi-Language** — Available in English and German
- 🌓 **Dark/Light Theme** — Easy on the eyes, day or night
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

# Required: Update DATABASE_URL with the same password
DATABASE_URL=postgresql://cashlytics:your_secure_password_here@postgres:5432/cashlytics

# Required: generate a strong auth secret
AUTH_SECRET=generate_with_npx_auth_secret

# Required for self-host behind Docker, reverse proxy, or custom domain
AUTH_TRUST_HOST=true

# Recommended for self-hosted personal deployment
SINGLE_USER_MODE=true

# Optional: Enable AI Assistant (requires OpenAI API key)
OPENAI_API_KEY=sk-your-openai-key

# Required for self-host mock payment flow (no Stripe required)
BILLING_REQUIRED=false
```

If you run Cashlytics as a classic self-hosted instance, these flags should always be set:

- `BILLING_REQUIRED=false` disables Stripe paywall enforcement and uses the self-host mock payment path.
- `SINGLE_USER_MODE=true` keeps registration limited to the first user (typical personal deployment).
- `AUTH_TRUST_HOST=true` is required when not using plain localhost.

Stripe keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY_ID`, `STRIPE_PRICE_YEARLY_ID`) are only needed when you explicitly set `BILLING_REQUIRED=true`.

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
- **PostgreSQL 16** — Database for storing your financial data

```yaml
# docker-compose.selfhost.yml
services:
  cashlytics:
    image: ghcr.io/aaronjoeldev/cashlytics-ai:latest
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://cashlytics:your_password@postgres:5432/cashlytics
      - NEXT_PUBLIC_APP_URL=http://localhost:3000
      - OPENAI_API_KEY=${OPENAI_API_KEY:-}
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=cashlytics
      - POSTGRES_PASSWORD=your_password
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

| Variable              | Required | Default                 | Description                                                 |
| --------------------- | -------- | ----------------------- | ----------------------------------------------------------- |
| `DATABASE_URL`        | ✅ Yes   | —                       | PostgreSQL connection string                                |
| `NEXT_PUBLIC_APP_URL` | ✅ Yes   | `http://localhost:3000` | Public URL of your Cashlytics instance                      |
| `AUTH_SECRET`         | ✅ Yes   | —                       | Secret for JWT encryption (generate with `npx auth secret`) |
| `AUTH_TRUST_HOST`     | ❌ No    | `false`                 | Set to `true` for Docker/VPS/custom-domain self-host setups |
| `SINGLE_USER_MODE`    | ❌ No    | `true`                  | Set to `false` to allow open registration                   |
| `SINGLE_USER_EMAIL`   | ❌ No    | —                       | Email for single-user mode data migration                   |
| `OPENAI_API_KEY`      | ❌ No    | —                       | OpenAI API key for AI Assistant feature                     |
| `BILLING_REQUIRED`    | ❌ No    | `true`                  | Set to `false` for self-host mode with mocked payment flow  |
| `SMTP_HOST`           | ❌ No    | —                       | SMTP server hostname (e.g., `smtp.gmail.com`)               |
| `SMTP_PORT`           | ❌ No    | —                       | SMTP port (587 for STARTTLS, 465 for TLS)                   |
| `SMTP_USER`           | ❌ No    | —                       | SMTP authentication username                                |
| `SMTP_PASS`           | ❌ No    | —                       | SMTP authentication password                                |
| `SMTP_FROM`           | ❌ No    | `SMTP_USER`             | From address for outgoing emails                            |
| `APP_URL`             | ❌ No    | `NEXT_PUBLIC_APP_URL`   | Server-side URL for email links                             |

### Database Configuration

The `DATABASE_URL` follows this format:

```
postgresql://[user]:[password]@[host]:[port]/[database]
```

Example:

```
postgresql://cashlytics:mypassword@postgres:5432/cashlytics
```

### AI Assistant (Optional)

To enable the AI-powered financial assistant:

1. Get an API key from [OpenAI](https://platform.openai.com/api-keys)
2. Add it to your `.env` file:
   ```
   OPENAI_API_KEY=sk-proj-your-key-here
   ```

> **Note:** Without an OpenAI API key, Cashlytics will still work, but the AI Assistant feature will be disabled.

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
| Budget Alerts       | 🔲 Planned  | Notifications when exceeding budget limits      |

### Medium Priority 🟡

| Feature          | Status     | Description                                 |
| ---------------- | ---------- | ------------------------------------------- |
| Export/Import    | 🔲 Planned | CSV & PDF export; data import functionality |
| Bank Integration | 🔲 Planned | FinTS/PSD2 API connection for German banks  |

### Future 🟢

| Feature             | Status     | Description                            |
| ------------------- | ---------- | -------------------------------------- |
| Mobile PWA          | 🔲 Planned | Progressive Web App for mobile devices |
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
