# Open Findings

Result of the full repository audit from 2026-10-13. This file lists what is still open; tick items
off as they are fixed. Line numbers refer to commit `e37f3a9` (release 0.8.0) and may have shifted.

Items ticked `[x]` were fixed after this list was written (branches `fix/security-hardening`,
`fix/auth-sessions-and-pwa`, `fix/ops-and-database` and the later rounds).

Already fixed and not listed here: dependency updates and Node 24, the cross-user leak in the
dashboard queries, the unauthenticated `/api/documents/[id]` route, push subscription ownership,
custom-interval reminders, the password reset link host, the unified recurrence math
(`src/lib/recurrence.ts`) and the currency handling for transfers, accounts and edited entries.

**By design, not a finding:** `accounts.balance` is not changed by expenses, incomes or transfers.
It is a planning value; the account views show monthly income versus expenses and required reserves.

Findings marked _(unverified)_ were inferred from reading the code and not reproduced.

## 1. Security

- [x] **Update actions pass client data straight to `.set(data)`.** A direct server-action call can
      set `userId` (moving the row to another user) or reference another user's `accountId` /
      `categoryId`, whose rows are then returned through the unscoped joins. Affected:
      `updateAccount`, `updateExpense`, `updateDailyExpense`, `updateIncome`, `updateTransfer`,
      `updateCategory` in `src/actions/*-actions.ts`. `createDailyExpense` in `expense-actions.ts`
      and `learnMerchantCategory` also take `categoryId` unchecked.
- [x] **Rate limiter is ineffective.** `src/lib/rate-limiter.ts` is keyed on the raw
      `X-Forwarded-For` header (client-controlled), never evicts entries, and all users without the
      header share one bucket. Used in `api/chat`, `api/receipt-scan`, `api/documents`.
- [x] **No throttling on login or password reset.** Login is limited to 10 attempts per 15 minutes
      per e-mail, reset mails to 3 per hour per e-mail.
- [x] **Registration was not throttled.** Limited to 5 per hour per client address, best effort:
      without a reverse proxy the address header is client-controlled.
- [ ] **The login limit can be used to lock a known address out** for 15 minutes. All limits are
      in memory and per process.
- [x] **Password reset did not end existing sessions.** Sessions carry their sign-in time and are
      rejected once the password changed afterwards or the user was deleted (migration `0015`).
      Other replicas can accept an old session for up to 30 seconds.
- [x] **Reset token consumption is not atomic** (`auth-actions.ts`, `resetPasswordAction`). Two
      concurrent submissions of the same token both succeed. Missing `password` / `token` fields
      throw instead of returning a validation error.
- [x] **Service worker cached authenticated pages and API responses** for whoever used the
      browser next. Offline copies are now kept per signed-in user, removed on logout, on the
      auth pages and when another user signs in, and expire after 7 days. API responses are not
      cached.
- [x] **Logs contain bound query parameters.** Drizzle puts parameters into the error message and
      `src/lib/logger.ts` prints it: whole base64 documents, e-mail addresses, push keys.
      `src/lib/email/transporter.ts` also logs the recipient on every send.
- [x] **Document upload does not check ownership of the linked expense**
      (`src/actions/document-actions.ts`).
- [ ] **`POST /api/documents` validates UUIDs as integers**, so it rejects every valid id; the
      route has no caller and can be deleted.
- [x] **`/api/chat` relied on the proxy only** and accepted `system`-role messages of any length.
      It now checks the session, the roles and the request size.
- [x] **Proxy matcher skips paths ending in `.png`, `.svg`, `.ico`, `.webmanifest`** (`src/proxy.ts`),
      so such paths reach route handlers without a session. Confirmed for `/api/documents/x.png`.
- [ ] **Push endpoint is not validated as a push-service URL** (`api/push/subscribe`): blind SSRF
      through the reminder job.
- [x] **`generateInsights(userId)` was exported from a `"use server"` file without an auth check**
      and was registered as a server action. Moved to `src/lib/insights/generate-insights.ts`.
- [x] **Password length was inconsistent** between sign-in, registration and reset.
- [x] **E-mails were case-sensitive.** They are normalised to lower case on sign-in, registration
      and reset, and looked up case-insensitively.
- [x] **Existing accounts that differ only in e-mail case** are not merged, and there is no unique
      index on `lower(email)`. (Migration `0020` lower-cases addresses and adds the unique index
      when no case duplicates exist; duplicates are not merged automatically, login uses the
      oldest account.)
- [ ] **User enumeration**: explicit "account already exists" message on registration; response time
      of the forgot-password action reveals whether the address exists.
- [x] **A concurrent duplicate registration raised an unhandled unique violation.**
- [ ] **`SINGLE_USER_MODE` count and insert are not atomic**: two concurrent registrations on a
      fresh instance can both succeed.
- [x] **Cron secret compared with `!==`** in both cron routes (not constant-time).
- [ ] **Prompt injection surface**: `sanitizeForPrompt` in `api/chat/route.ts` keeps newlines, and
      bank text from CSV imports and receipt OCR is placed in the system prompt.

## 2. Calculations and currency

- [x] **Totals used the hardcoded rate table.** All totals, insights, forms and the converter
      now use the live rates from `src/lib/exchange-rates.ts` (Frankfurter API, DB cache for
      24 hours, kept in memory for an hour, 5-second API timeout). The table in
      `src/lib/currency.ts` is only the fallback when neither API nor cache has rates. The root
      layout passes the server's rates to the client, so both compute with the same numbers.

- [x] **Amounts were rounded in binary**: server validation stored `5.555` as `5.55`
      (`toFixed`); `roundDecimal` now rounds half away from zero like Postgres. _(found in the Docker
      e2e run)_

## 3. CSV import

- [x] **Amount parser flips sign or magnitude** (`src/lib/import/csv-import-staging.ts`): `50,00-`,
      `(50,00)` and `12,50 S` become incomes; `1.234`, `1,234` and `1.234.567` become 1.23.
- [x] **"Replace existing" turns a recurring income into a one-off**
      (`import-reconciliation-engine.ts`, `import-commit-engine.ts`): recurring incomes are offered
      as match candidates and the update writes `recurrenceType: "once"`.
- [x] **Concurrent commits import every row twice** (`import-commit-engine.ts`): the session status
      is read with a plain select and updated without a status guard.
- [x] **Two identical CSV rows match the same existing record**; AI near-matches are not checked
      for direction and can pair an expense row with an income.
- [x] **Files are always decoded as UTF-8** (`src/actions/import-actions.ts`). Windows-1252 bank
      exports fail on the `Währung` header.
- [x] **Currency is dropped** for imported incomes and when replacing an expense.
- [x] **AI near-match is one unbounded call** with free-text JSON output. Large files overflow the
      output, the result is treated as "no matches" and reported as success. (Now batched and
      reported; the answer is still free-text JSON checked with zod, not structured output.)
- [x] **A failed reconciliation is displayed as done** (`import/client.tsx`), and the user can
      confirm without conflict detection.
- [x] **"Remove row" leaves the row on screen**; the snapshot query does not filter excluded rows.
- [x] **Commit does one insert per row** inside a single transaction (5000 rows, 5000 round trips).
- [x] Smaller parser gaps: quoted multi-line fields, required `currency` column with no account
      default, descriptions over 255 characters fail the file, `ø` in Danish headers, `text/plain`
      and empty MIME types rejected, `sourceFileHash` stored but never compared.

## 4. AI assistant and insights

- [x] **Approval card does not show what is changed or deleted**
      (`src/components/molecules/tool-confirmation-card.tsx`): delete cards show no name, update
      cards only the new values, amounts always with `€`. `updateDailyExpense`, `createTransfer`
      and `markInsightRead` have no card layout.
- [x] **Approval buttons are disabled in the floating mini-chat** (`floating-actions.tsx` passes no
      approve / deny handlers).
- [x] **Conversations stop working after 100 messages** (`api/chat/route.ts` rejects instead of
      truncating).
- [x] **Messages are saved twice or empty** (`src/hooks/use-conversations.ts`): on tool approval, on
      errors and aborts, and on retry. Switching conversation mid-stream saves the answer into the
      wrong conversation. Tool calls are not persisted. (Data-changing tool calls are now stored as
      a text line per call; the history is still plain text.)
- [x] **`getDailyExpenses` tool advertises `minAmount` / `maxAmount`** that the action ignores.
- [x] **Missing `OPENAI_API_KEY` is not checked in the chat route**; the stream fails with a generic
      error and a retry button that cannot succeed.
- [x] **"Today" in the system prompt is the UTC date**; around midnight entries are booked a day
      early. Amounts are labelled `€` regardless of currency. _The browser now sends its time zone;
      the dashboard totals in the prompt still carry no currency label, and a few tools
      (`checkAffordability`, `getSpendingSummary`) still pick the month by server time._
- [x] **Insights cron is never scheduled** in any compose file, so the feature stays empty.
- [x] **Insight quality**: the dedup key contains a changing percentage (duplicates on every run),
      uncategorised spend is titled "null: …", the average divides by three even with one month of
      history, and the budget warning fires on day one of a month.
- [x] **One failing user aborts the whole insights run.**
- [x] Smaller: merchant-category learning is written but never read.

## 5. Deployment and database

- [x] **Release workflow overwrites `:latest` with unreleased code.**
      `.github/workflows/release.yml` tests for the file `VERSION`, which is tracked and always
      exists, so every push to `main` reports a release. The docker job also checks out `main`
      instead of the triggering commit.
- [x] **`entrypoint.sh` started the app after failed migrations.** It now exits and leaves the retry
      to the container restart policy.
- [x] **`docker-compose.demo.yml` was invalid**: `demo_network` was not declared, the seeder could
      not reach Postgres, the app had no port, registration was open. All services now share the
      default network; an external proxy network is documented as an override.
- [x] **`docker-compose.yml` could not start the app**: the `.:/app` volume hid the standalone
      build and `DATABASE_URL` pointed outside the compose network. `start-services.sh` now starts
      only Postgres.
- [ ] **Migration `0005` deletes all rows without `user_id`**; relevant only when upgrading an
      install from before February 2026.
- [x] **No secondary indexes anywhere.** Migration `0016` adds indexes on `user_id`,
      `(user_id, date)` for daily expenses, the child foreign keys and `lower(email)`.
- [x] **Categories in use could never be deleted.** `expenses.category_id` and
      `daily_expenses.category_id` are now `ON DELETE SET NULL`, as the delete dialog already said.
- [x] **`.env.example` broke reminders when copied as is**: VAPID placeholders and an empty
      `CRON_SECRET` are now commented out with instructions. `NEXT_PUBLIC_DEFAULT_LOCALE` /
      `CURRENCY` were removed from the self-host compose file because they are baked in at build
      time.
- [ ] **Locale and currency defaults cannot be changed with the published image.** They would have
      to be read at runtime instead of from `NEXT_PUBLIC_*` variables.
- [ ] **Server action body limit is the 1 MB default** while uploads promise 5 MB. _(unverified)_
- [ ] Smaller: `user_settings` has no foreign key to `users`, snapshots `0010` / `0011` are
      missing in `drizzle/meta`.
- [x] `package.json` version was never bumped (now set by the release); `scripts/migrate-add-userId.ts`
      created a user with password `changeme` (removed with `SINGLE_USER_EMAIL`, which only it used).

- [x] **Compose healthchecks never passed**: `wget http://localhost:3000` resolves to `::1` in
      Alpine while the server listens on IPv4 only, so the app stayed unhealthy and the cron
      container (and the demo seeder) never started. The checks use `127.0.0.1`. _(found in the
      Docker e2e run)_

## 6. User interface

- [x] **Currency and locale jumped after login**: the provider wrote default cookies on the login
      page and the server computed with them. The server now reads currency and locale from the
      stored user settings (`src/lib/user-preferences.ts`, cookies only as fallback when signed out),
      and the provider takes both from the server instead of loading them after mount.
- [x] **Failed server actions were swallowed** in the expense, income and transfer forms. Server
      errors and the first client validation error are shown as a toast.
- [x] **Failed actions were still swallowed** in the document list and on the scan page. Loading,
      preview, download and delete errors are shown; the documents page tells a failed load apart
      from an empty list; the scan page reports a receipt that could not be attached.
- [x] **A category could not be removed when editing an expense**: the form sent `undefined`. There
      is now a "Without category" option and the form sends `null`.
- [x] **Category select in the floating expense dialog was always empty** (`expense-form.tsx`
      copied the initial prop into state).
- [x] **Calendar did not restore the current month** when navigating back: it kept the days of the
      last viewed month. Navigation now loads directly and drops slower, outdated answers.
- [x] **Push toggle** threw a raw error when no VAPID key is configured. It now says push is not set
      up on this server and stays disabled.
- [x] **Translations**: `common.error` added, plurals use ICU (`{count, plural, ...}`), `semiannual`
      has a label in the overview, chat components, the approval card and the auth pages (including
      server error messages) are translated, 68 unused keys removed. A test keeps `de` and `en` in sync.
- [x] **Hydration mismatches** from `Intl.DateTimeFormat()` without a locale in five list pages.
      Calendar days are formatted with the app locale in UTC (`src/lib/format-date.ts`), timestamps
      with the next-intl formatter.
- [x] **Effects triggered `react-hooks/set-state-in-effect`** (ten after the calendar change). All
      are migrated and the rule is back to its default (error).
- [x] Smaller: "custom" recurrence has an interval input; the header bell lists unread insights and
      shows its dot only when there are some; the forgot-password form shows its confirmation
      instead of redirecting; manifest icons are listed for `any` and `maskable`.

- [x] **Dashboard dates followed the runtime time zone**: header date and "In X Tagen" caused a
      hydration mismatch when server (UTC) and browser were on different days; recent transaction
      dates were German-only and shifted a day west of UTC. _(found in the Docker e2e run)_
- [ ] **Found in the Docker e2e run, not fixed yet.** Month labels on the analytics page
      (server-rendered) and in the account detail month picker are hard-coded `de-DE`. Icon-only
      edit/delete buttons in the lists have no `aria-label` or `title`. `deleteCategory` returns
      the English "Category not found", the other actions German. Every prefetch of a sidebar link
      is stored in the user's offline cache under a new `?_rsc=` key; these entries are never used
      offline and only expire after 7 days. The account filters at the top of a page open their
      list aligned on the selected account, so with several accounts "Alle Konten" is pushed above
      the viewport and has to be scrolled to.

## 7. Cleanup

- [x] **Dead code** removed: the duplicate `accounts-`/`expenses-`/`incomes-actions.ts`,
      `account-detail-actions.ts`, `exchange-rates-actions.ts`, six unused server actions, unused
      components, helpers and exports, `date-fns`, `public/Logo.ai` and `logo-dark.svg`.
- [x] **Tracked by accident / outdated**: `.tmp/`, `.planning/` (including the duplicate
      milestone copy and the outdated notes) and the per-file docs under `docs/` (api, components,
      pages, architecture), which described code that no longer exists. The README covers setup
      and structure.
- [x] **Noisy build log**: the dashboard segment is marked dynamic, so `next build` no longer
      prerenders pages that need a session (16 `[ERROR] ... Dynamic server usage` lines), and the
      missing `DATABASE_URL` is not reported by every build worker of the Docker build.
- [x] **Test coverage**: `e2e/` runs the production image with PostgreSQL, Mailpit and a fake
      OpenAI API and checks auth, user isolation of the server actions, forms, currencies and
      rates, insights, the CSV import, the chat route, the receipt scanner, the UI and the offline
      copies. CI (`.github/workflows/ci.yml`) runs typecheck, lint, unit and e2e tests on every
      pull request. Not covered: real push delivery and real OpenAI responses.
- [x] **Local tooling**: the pre-commit hook (lint-staged) needs Git 2.32 or newer; the README
      lists it under the development requirements.
