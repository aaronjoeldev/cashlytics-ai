# Technology Stack

**Analysis Date:** 2026-02-20

## Languages

**Primary:**
- TypeScript 5.x - All application code (frontend, backend, API routes)
- Target: ES2017 with ESNext module resolution

**Secondary:**
- SQL (PostgreSQL dialect) - Database migrations in `drizzle/`
- Shell (sh) - Docker entrypoint script `entrypoint.sh`

## Runtime

**Environment:**
- Node.js 20.x (Alpine Linux in production)
- Next.js 16.1.6 (App Router)

**Package Manager:**
- npm (with package-lock.json)
- Lockfile: present

## Frameworks

**Core:**
- Next.js 16.1.6 - Full-stack React framework with App Router
- React 19.2.3 - UI library
- Tailwind CSS 4.x - Utility-first styling

**Testing:**
- Not configured - No test framework detected

**Build/Dev:**
- Next.js built-in compiler (Turbopack/webpack)
- Docker multi-stage builds for production

## Key Dependencies

**Critical:**
- `drizzle-orm` 0.45.1 - Type-safe ORM for PostgreSQL
- `postgres` 3.4.8 - PostgreSQL client
- `ai` 6.0.85 - Vercel AI SDK for streaming chat
- `@ai-sdk/openai` 3.0.28 - OpenAI integration
- `zod` 4.3.6 - Schema validation

**UI Components:**
- `radix-ui` 1.4.3 - Headless UI primitives
- `@radix-ui/react-toast` 1.2.15 - Toast notifications
- `@radix-ui/react-progress` 1.1.8 - Progress indicators
- `lucide-react` 0.564.0 - Icon library
- `recharts` 3.7.0 - Charting library
- `sonner` 2.0.7 - Toast notifications
- `class-variance-authority` 0.7.1 - CSS variant utilities
- `shadcn` 3.8.4 - UI component generator

**Form Handling:**
- `react-hook-form` 7.71.1 - Form state management
- `@hookform/resolvers` 5.2.2 - Zod integration for forms

**Internationalization:**
- `next-intl` 4.8.2 - i18n for Next.js App Router
- `next-themes` 0.4.6 - Theme switching (dark/light)

**Utilities:**
- `date-fns` 4.1.0 - Date manipulation
- `clsx` 2.1.1 - Conditional class names
- `tailwind-merge` 3.4.0 - Tailwind class merging

**Infrastructure:**
- `drizzle-kit` 0.31.9 - Database migrations and introspection
- `dotenv` 17.3.1 - Environment variable loading

## Configuration

**Environment:**
- Required: `DATABASE_URL` - PostgreSQL connection string
- Required: `NEXT_PUBLIC_APP_URL` - Public application URL
- Optional: `OPENAI_API_KEY` - AI assistant feature (feature disabled without it)
- Optional: `POSTGRES_PASSWORD` - Docker PostgreSQL password
- Optional: `NEXT_PUBLIC_DEFAULT_LOCALE` - Default language (defaults to 'de')

**Build:**
- `tsconfig.json` - TypeScript configuration (strict mode enabled)
- `next.config.ts` - Next.js config with next-intl plugin, standalone output
- `drizzle.config.ts` - Drizzle Kit configuration
- `components.json` - shadcn/ui configuration (new-york style)
- `eslint.config.mjs` - ESLint flat config with Next.js presets
- `postcss.config.mjs` - PostCSS with Tailwind CSS 4 plugin

## Platform Requirements

**Development:**
- Node.js 20.x
- PostgreSQL 16 (via Docker or local)
- npm for package management

**Production:**
- Docker container runtime
- PostgreSQL 16 database
- Port 3000 exposed
- Standalone Next.js build output

---

*Stack analysis: 2026-02-20*
