# Fix Hardcoded Defaults in user_settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `"EUR"` and `"de"` defaults in the Drizzle schema for `userSettings` with the env-driven `defaultCurrency` and `defaultLocale` constants, and add a DB migration that removes the hardcoded column defaults so the application layer is the single source of truth.

**Architecture:** Two-step fix: (1) update `schema.ts` to import and use the runtime constants so Drizzle ORM insert paths pick up the env var; (2) write a manual SQL migration (index 0012) that drops the hardcoded `DEFAULT` from both columns in the DB — making any raw SQL insert that omits the column fail fast rather than silently defaulting to EUR/de regardless of environment.

**Tech Stack:** Drizzle ORM, PostgreSQL, Next.js server actions, TypeScript

---

### Task 1: Update schema.ts to use env-driven constants

**Files:**
- Modify: `src/lib/db/schema.ts`

**Context:** Lines 575–576 currently read:
```ts
baseCurrency: text("base_currency").default("EUR").notNull(),
locale: text("locale").default("de").notNull(),
```
The Drizzle `.default()` value is what the ORM sends when a column is omitted from an `.insert()` call. Hardcoding `"EUR"` means the env var `NEXT_PUBLIC_DEFAULT_CURRENCY` is ignored for ORM defaults.

- [ ] **Step 1: Add imports for `defaultCurrency` and `defaultLocale` to schema.ts**

Open `src/lib/db/schema.ts`. At the top of the file (after the existing drizzle-orm imports, before any table definitions), add:

```ts
import { defaultCurrency } from "@/lib/currency";
import { defaultLocale } from "@/i18n/config";
```

- [ ] **Step 2: Replace hardcoded defaults in the userSettings table definition**

Find the `userSettings` table definition (around line 574) and change the two column defaults:

```ts
// Before
baseCurrency: text("base_currency").default("EUR").notNull(),
locale: text("locale").default("de").notNull(),

// After
baseCurrency: text("base_currency").default(defaultCurrency).notNull(),
locale: text("locale").default(defaultLocale).notNull(),
```

- [ ] **Step 3: Run the TypeScript compiler to verify no type errors**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "fix(schema): use env-driven defaultCurrency and defaultLocale in userSettings"
```

---

### Task 2: Write migration to remove hardcoded DB column defaults

**Files:**
- Create: `drizzle/0012_fix_user_settings_defaults.sql`
- Modify: `drizzle/meta/_journal.json`

**Context:** The DB column still carries `DEFAULT 'EUR'` and `DEFAULT 'de'` from migration 0010. Changing `schema.ts` fixes ORM paths but not raw-SQL paths. Removing the DB-level DEFAULT means any INSERT that omits the column will fail with a `NOT NULL` violation, which is the correct behavior — the app must always be explicit.

Existing rows and all application code are unaffected: `settings-actions.ts` always provides both values explicitly via upsert.

- [ ] **Step 1: Create the migration SQL file**

Create `drizzle/0012_fix_user_settings_defaults.sql` with:

```sql
ALTER TABLE "user_settings" ALTER COLUMN "base_currency" DROP DEFAULT;
ALTER TABLE "user_settings" ALTER COLUMN "locale" DROP DEFAULT;
```

- [ ] **Step 2: Register the migration in the Drizzle journal**

Open `drizzle/meta/_journal.json`. Append a new entry to the `"entries"` array (after the entry with `"idx": 11`):

```json
{
  "idx": 12,
  "version": "7",
  "when": 1746518400000,
  "tag": "0012_fix_user_settings_defaults",
  "breakpoints": true
}
```

> Note: the `"when"` value is a Unix timestamp in milliseconds (2026-05-06T08:00:00Z). Use the actual current timestamp if your tooling is strict about it.

- [ ] **Step 3: Generate a snapshot for the migration**

Run drizzle-kit to validate and generate the snapshot automatically:

```bash
npx drizzle-kit generate --name fix_user_settings_defaults
```

Expected output includes a line like:
```
1 table changed
```

If drizzle-kit creates a *new* file instead of recognising `0012_fix_user_settings_defaults.sql`, delete the generated file and the journal entry from Step 2, then use the file drizzle-kit created. The goal is one authoritative migration file at index 12.

- [ ] **Step 4: Apply the migration locally and verify**

```bash
npx drizzle-kit migrate
```

Expected: migration runs without error. Verify in psql or your DB client:

```sql
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_name = 'user_settings'
  AND column_name IN ('base_currency', 'locale');
```

Expected: both `column_default` values are `NULL` (no default).

- [ ] **Step 5: Commit**

```bash
git add drizzle/0012_fix_user_settings_defaults.sql drizzle/meta/_journal.json drizzle/meta/
git commit -m "fix(migration): remove hardcoded EUR/de defaults from user_settings columns"
```

---

### Task 3: Smoke-test the settings flow end-to-end

**Context:** Verify that after the migration, the insert/upsert paths in `settings-actions.ts` still work correctly when no `user_settings` row exists yet (new user scenario) — because `DEFAULT_SETTINGS` now drives the value, not the DB column default.

- [ ] **Step 1: Confirm `DEFAULT_SETTINGS` in settings-actions already uses the constants**

Open `src/actions/settings-actions.ts` and verify:

```ts
const DEFAULT_SETTINGS: UserSettingsData = {
  baseCurrency: defaultCurrency,   // must NOT be "EUR" literal
  locale: defaultLocale,           // must NOT be "de" literal
};
```

If either is a string literal, change it to use the imported constant and re-run `npx tsc --noEmit`.

- [ ] **Step 2: Start the dev server and exercise the settings page**

```bash
npm run dev
```

1. Open the app in the browser.
2. Navigate to Settings.
3. Change the base currency to a non-EUR value (e.g. USD) and save.
4. Reload the page — confirm the selected currency persists.
5. Open DevTools → Application → Cookies and verify the `currency` cookie is updated.

- [ ] **Step 3: Simulate a new-user scenario**

In your DB client, delete the `user_settings` row for your test user:

```sql
DELETE FROM user_settings WHERE user_id = '<your-test-user-id>';
```

Reload the app. Expected: no crash, default currency shown matches `NEXT_PUBLIC_DEFAULT_CURRENCY` (or EUR if the env var is unset).

- [ ] **Step 4: Commit if settings-actions.ts needed changes**

Only commit if Step 1 required a change:

```bash
git add src/actions/settings-actions.ts
git commit -m "fix(settings): use defaultCurrency/defaultLocale constants in DEFAULT_SETTINGS"
```
