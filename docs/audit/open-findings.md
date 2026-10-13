# Open Findings

Result of the full repository audit from 2026-10-13. This file lists what is still open; tick items
off as they are fixed. Line numbers refer to commit `e37f3a9` (release 0.8.0) and may have shifted.

Items ticked `[x]` were fixed after this list was written (branch `fix/security-hardening`); the
release workflow change has not run in CI yet.

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
- [ ] **`generateInsights(userId)` is exported from a `"use server"` file without an auth check**
      (`src/actions/insights-actions.ts`). _(reachability unverified)_
- [x] **Password length was inconsistent** between sign-in, registration and reset.
- [x] **E-mails were case-sensitive.** They are normalised to lower case on sign-in, registration
      and reset, and looked up case-insensitively.
- [ ] **Existing accounts that differ only in e-mail case** are not merged, and there is no unique
      index on `lower(email)`.
- [ ] **User enumeration**: explicit "account already exists" message on registration; response time
      of the forgot-password action reveals whether the address exists.
- [x] **A concurrent duplicate registration raised an unhandled unique violation.**
- [ ] **`SINGLE_USER_MODE` count and insert are not atomic**: two concurrent registrations on a
      fresh instance can both succeed.
- [x] **Cron secret compared with `!==`** in both cron routes (not constant-time).
- [ ] **Prompt injection surface**: `sanitizeForPrompt` in `api/chat/route.ts` keeps newlines, and
      bank text from CSV imports and receipt OCR is placed in the system prompt.

## 2. Calculations and currency

- [ ] **Totals use the hardcoded rate table** in `src/lib/currency.ts`. The live-rate module
      `src/lib/exchange-rates.ts` is only used by the converter tool. Affects four action files,
      five client pages and both forms.
- [ ] **Existing transfers are stored as EUR** regardless of their accounts. New transfers are
      correct; old rows need a one-off backfill if non-EUR accounts exist.
- [x] **`updateTransfer` allows the same account as source and target** when only one side is sent.
- [ ] **Date inputs render empty and submit the current time** in the expense, income and transfer
      forms (`valueAsDate` with a `Date` default). _(unverified)_
- [ ] **Amounts in another currency are shown with the base-currency symbol** without conversion in
      the transfers list, import review, search dialog and scan success screen.
- [ ] **Dashboard category breakdown has no upper date bound** for daily expenses, so future-dated
      entries count as "this month".
- [ ] **Delete actions report success when no row matched** (`deleteExpense`, `deleteDailyExpense`,
      `deleteIncome`, `deleteAccount`, `deleteCategory`).
- [ ] **No server-side validation in the actions.** The zod schemas run only in the client forms; a
      direct call can store a negative amount or interval.

## 3. CSV import

- [x] **Amount parser flips sign or magnitude** (`src/lib/import/csv-import-staging.ts`): `50,00-`,
      `(50,00)` and `12,50 S` become incomes; `1.234`, `1,234` and `1.234.567` become 1.23.
- [x] **"Replace existing" turns a recurring income into a one-off**
      (`import-reconciliation-engine.ts`, `import-commit-engine.ts`): recurring incomes are offered
      as match candidates and the update writes `recurrenceType: "once"`.
- [x] **Concurrent commits import every row twice** (`import-commit-engine.ts`): the session status
      is read with a plain select and updated without a status guard.
- [ ] **Two identical CSV rows match the same existing record**; AI near-matches are not checked
      for direction and can pair an expense row with an income.
- [ ] **Files are always decoded as UTF-8** (`src/actions/import-actions.ts`). Windows-1252 bank
      exports fail on the `Währung` header.
- [x] **Currency is dropped** for imported incomes and when replacing an expense.
- [ ] **AI near-match is one unbounded call** with free-text JSON output. Large files overflow the
      output, the result is treated as "no matches" and reported as success.
- [ ] **A failed reconciliation is displayed as done** (`import/client.tsx`), and the user can
      confirm without conflict detection.
- [ ] **"Remove row" leaves the row on screen**; the snapshot query does not filter excluded rows.
- [ ] **Commit does one insert per row** inside a single transaction (5000 rows, 5000 round trips).
- [ ] Smaller parser gaps: quoted multi-line fields, required `currency` column with no account
      default, descriptions over 255 characters fail the file, `ø` in Danish headers, `text/plain`
      and empty MIME types rejected, `sourceFileHash` stored but never compared.

## 4. AI assistant and insights

- [ ] **Approval card does not show what is changed or deleted**
      (`src/components/molecules/tool-confirmation-card.tsx`): delete cards show no name, update
      cards only the new values, amounts always with `€`. `updateDailyExpense`, `createTransfer`
      and `markInsightRead` have no card layout.
- [ ] **Approval buttons are disabled in the floating mini-chat** (`floating-actions.tsx` passes no
      approve / deny handlers).
- [x] **Conversations stop working after 100 messages** (`api/chat/route.ts` rejects instead of
      truncating).
- [ ] **Messages are saved twice or empty** (`src/hooks/use-conversations.ts`): on tool approval, on
      errors and aborts, and on retry. Switching conversation mid-stream saves the answer into the
      wrong conversation. Tool calls are not persisted.
- [ ] **`getDailyExpenses` tool advertises `minAmount` / `maxAmount`** that the action ignores.
- [x] **Missing `OPENAI_API_KEY` is not checked in the chat route**; the stream fails with a generic
      error and a retry button that cannot succeed.
- [ ] **"Today" in the system prompt is the UTC date**; around midnight entries are booked a day
      early. Amounts are labelled `€` regardless of currency.
- [ ] **Insights cron is never scheduled** in any compose file, so the feature stays empty.
- [ ] **Insight quality**: the dedup key contains a changing percentage (duplicates on every run),
      uncategorised spend is titled "null: …", the average divides by three even with one month of
      history, and the budget warning fires on day one of a month.
- [ ] **One failing user aborts the whole insights run.**
- [ ] Smaller: `createAccount` tool accepts any string as currency, tool dates are unvalidated
      strings, merchant-category learning is written but never read, receipt dates and amounts
      from the model are not validated.

## 5. Deployment and database

- [x] **Release workflow overwrites `:latest` with unreleased code.**
      `.github/workflows/release.yml` tests for the file `VERSION`, which is tracked and always
      exists, so every push to `main` reports a release. The docker job also checks out `main`
      instead of the triggering commit.
- [ ] **`entrypoint.sh` starts the app after failed migrations.**
- [ ] **`docker-compose.demo.yml` is invalid**: `demo_network` is not declared, the seeder cannot
      reach Postgres, the app has no port or web network, registration is open.
- [ ] **`docker-compose.yml` cannot start the app**: the `.:/app` volume hides the standalone
      build. `start-services.sh` then starts a second server on the same port.
- [ ] **Migration `0005` deletes all rows without `user_id`**; relevant only when upgrading an
      install from before February 2026.
- [ ] **No secondary indexes anywhere.** Every query filters on `user_id`; add indexes on
      `user_id`, `(user_id, date)` for daily expenses and the child foreign keys.
- [ ] **Categories in use can never be deleted** (`ON DELETE no action` on `expenses.category_id`
      and `daily_expenses.category_id`).
- [ ] **`.env.example` breaks reminders when copied as is**: empty `CRON_SECRET` and VAPID
      placeholders. `NEXT_PUBLIC_DEFAULT_LOCALE` / `CURRENCY` are set at runtime in the self-host
      compose file but are baked in at build time.
- [ ] **Server action body limit is the 1 MB default** while uploads promise 5 MB. _(unverified)_
- [ ] Smaller: `user_settings` has no foreign key to `users`, snapshots `0010` / `0011` are
      missing in `drizzle/meta`, `package.json` version is never bumped, `scripts/migrate-add-userId.ts`
      creates a user with password `changeme` when `INITIAL_PASSWORD` is unset.

## 6. User interface

- [ ] **Currency and locale jump after login** (`src/lib/settings-context.tsx`): the provider
      overwrites the cookies with defaults on the login page, the server then computes with the
      wrong currency and amounts appear with the wrong symbol until the next navigation.
- [ ] **Failed server actions are swallowed** in the expense, income and transfer forms, the
      document list and the scan page; most form validation errors are never rendered.
- [ ] **Category select in the floating expense dialog is always empty** (`expense-form.tsx` copies
      the initial prop into state).
- [ ] **Calendar does not restore the current month** when navigating back (`overview/client.tsx`).
- [ ] **Push toggle** throws a raw error when no VAPID key is configured.
- [ ] **Translations**: `common.error` is missing, English plurals are built from German suffixes
      ("5 categorn"), `semiannual` has no label in the overview, chat components and auth forms are
      not translated, 72 keys are unused.
- [ ] **Hydration mismatches** from `Intl.DateTimeFormat()` without a locale in five list pages.
- [ ] **Eleven effects trigger `react-hooks/set-state-in-effect`**, currently downgraded to a warning
      in `eslint.config.mjs`.
- [ ] Smaller: "custom" recurrence has no interval input, the notification dot in the header has
      no handler, the forgot-password form redirects without showing its confirmation, manifest
      icons are maskable-only.

## 7. Cleanup

- [ ] **Dead code**: `accounts-actions.ts`, `expenses-actions.ts`, `incomes-actions.ts` now hold
      one function each (used by `accounts/[id]/page.tsx`) and can be merged into the singular
      files; `account-detail-actions.ts`,
      `exchange-rates-actions.ts`, `src/lib/validators/`, `validations/{expense,income,daily-expense}.ts`,
      `lib/auth/user-id.ts`, `lib/email/index.ts`, `organisms/category-list.tsx`,
      `atoms/category-select.tsx`. `daily-expenses-actions.ts` is a second live path for creating
      and updating daily expenses with different behaviour.
- [ ] **Tracked by accident**: `.tmp/` (agent session files) and
      `.planning/milestones/v1.0-phases`, a byte-identical copy of `.planning/phases/01…05`.
- [ ] **Outdated notes**: `.planning/codebase/CONCERNS.md` and `TESTING.md`.
- [ ] **Test coverage**: nothing covers auth, the server actions, the chat route or the import edge
      cases above. CI runs no tests.
- [ ] **Local tooling**: the pre-commit hook needs Git 2.32 or newer.
