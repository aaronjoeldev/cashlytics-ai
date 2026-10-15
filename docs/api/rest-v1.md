# REST API v1

A read-only JSON API for integrations such as Home Assistant. It lives under `/api/v1` and is
versioned in the path; `apiVersion` in `/health` and `/me` changes on breaking changes.

## Authentication

Create a personal API token under **Settings → API tokens & integrations**. The token
(`csk_` followed by 64 hex characters) is shown once; only its SHA-256 hash is stored. Send it as a
bearer token:

```
Authorization: Bearer csk_…
```

- Tokens belong to one user and only read that user's data. Their scope is `read`.
- Revoking a token in the settings takes effect on the next request.
- Tokens can expire after 30, 90 or 365 days, or never.
- Every token may make 120 requests per minute. Beyond that the API answers `429` with a
  `Retry-After` header (seconds).

The routes are exempt from the session check in `src/proxy.ts`; each handler authenticates the
token itself (`withApiToken` in `src/lib/api/v1.ts`).

## Conventions

- Amounts are numbers with two decimals in the user's **base currency** (`currency` in each
  response), unless a field says otherwise (`balance` and `originalAmount` use the entry's own
  currency).
- Calendar days are `YYYY-MM-DD`; timestamps are ISO 8601 in UTC.
- Responses are sent with `Cache-Control: no-store`.
- Errors have one shape:

  ```json
  { "error": { "code": "unauthorized", "message": "Missing, invalid or expired API token" } }
  ```

  | Status | `code`            | When                                    |
  | ------ | ----------------- | --------------------------------------- |
  | 400    | `invalid_request` | A query parameter is missing or invalid |
  | 401    | `unauthorized`    | Missing, unknown or expired token       |
  | 404    | `not_found`       | The token's user no longer exists       |
  | 429    | `rate_limited`    | More than 120 requests per minute       |
  | 500    | `internal_error`  | Unexpected server error                 |

## Endpoints

### `GET /api/v1/health`

Public, no token. Used to check that an URL points to Cashlytics.

```json
{ "status": "ok", "version": "0.8.13", "apiVersion": 1 }
```

### `GET /api/v1/me`

The token owner. `userId` is stable and suitable as an integration's unique id.

```json
{
  "userId": "00000000-0000-0000-0000-000000000001",
  "name": "Demo User",
  "email": "demo@cashlytics.online",
  "baseCurrency": "EUR",
  "locale": "de",
  "version": "0.8.13",
  "apiVersion": 1
}
```

### `GET /api/v1/summary`

Everything an integration polls in one request.

| Parameter        | Default | Range | Meaning                                   |
| ---------------- | ------- | ----- | ----------------------------------------- |
| `upcomingDays`   | 7       | 1–90  | Window for `upcoming`                     |
| `forecastMonths` | 3       | 1–24  | Months in `forecast`, starting this month |

```json
{
  "generatedAt": "2026-10-15T13:21:32.717Z",
  "currency": "EUR",
  "totalAssets": 24496.05,
  "hasMultiCurrency": false,
  "month": {
    "year": 2026,
    "month": 10,
    "cashflow": {
      "income": 4150,
      "expenses": 1663.28,
      "surplus": 2486.72,
      "incomeChangePct": 0,
      "expensesChangePct": -29.6
    },
    "reserve": {
      "income": 4151.56,
      "expenses": 1663.28,
      "surplus": 2488.28,
      "incomeChangePct": 0,
      "expensesChangePct": -29.6
    }
  },
  "recurring": {
    "fixedCostsMonthly": 1162.44,
    "fixedCostsCount": 10,
    "subscriptionsMonthly": 34.97,
    "subscriptionsCount": 3
  },
  "upcoming": {
    "days": 7,
    "count": 10,
    "total": 1162.44,
    "next": {
      "id": "…",
      "type": "expense",
      "name": "Miete",
      "date": "2026-10-18",
      "amount": 850,
      "category": { "name": "Wohnen", "icon": "🏠", "color": "#3b82f6" },
      "isSubscription": false
    },
    "payments": ["…same shape as next…"]
  },
  "forecast": {
    "months": 3,
    "projectedIncome": 12450,
    "projectedExpenses": 4989.84,
    "projectedBalance": 7460.16,
    "monthly": [
      { "year": 2026, "month": 10, "income": 4150, "expenses": 1663.28, "balance": 2486.72 }
    ]
  },
  "insights": {
    "unread": 2,
    "bySeverity": { "warning": 2 },
    "byType": { "spending_anomaly": 1, "budget_warning": 1 }
  }
}
```

- `month.cashflow` counts what is actually due this month; `month.reserve` spreads non-monthly items
  over the months (the two views of the dashboard). `surplus` is income minus expenses.
- `*ChangePct` is the change against the previous month in percent.
- `recurring` sums the smoothed monthly amount of recurring expenses active this month.
- `upcoming` lists the next due date of each recurring expense and planned daily expenses. Incomes
  are not included.
- `forecast` uses the reserve view, like the analytics page.

### `GET /api/v1/accounts`

| Parameter        | Default | Range | Meaning                               |
| ---------------- | ------- | ----- | ------------------------------------- |
| `forecastMonths` | 3       | 1–24  | Months projected, starting next month |

```json
{
  "currency": "EUR",
  "accounts": [
    {
      "id": "…",
      "name": "Notgroschen",
      "type": "savings",
      "currency": "EUR",
      "balance": 12500,
      "balanceInBaseCurrency": 12500,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "forecast": {
        "months": 2,
        "isCumulative": true,
        "projectedBalance": 13100,
        "monthly": [
          {
            "year": 2026,
            "month": 11,
            "income": 0,
            "expenses": 0,
            "transfersIn": 300,
            "transfersOut": 0,
            "net": 300,
            "balance": 12800
          }
        ]
      }
    }
  ]
}
```

- `balance` is the balance the user maintains in Cashlytics, in the account's currency. Cashlytics
  does not change it when entries are added.
- The forecast uses the cashflow view in the base currency. Savings and ETF accounts carry their
  balance forward (`isCumulative: true`, `balance` per month, `projectedBalance` at the end).
  Checking accounts only have a net per month; `balance` and `projectedBalance` are `null`.

### `GET /api/v1/payments`

Every due date of expenses, daily expenses and incomes in a range, e.g. for a calendar.

| Parameter | Required | Meaning                                      |
| --------- | -------- | -------------------------------------------- |
| `start`   | yes      | First day, `YYYY-MM-DD`                      |
| `end`     | yes      | Last day (inclusive), at most 366 days later |

```json
{
  "currency": "EUR",
  "start": "2026-10-01",
  "end": "2026-11-30",
  "payments": [
    {
      "id": "…",
      "type": "expense",
      "name": "Netflix",
      "date": "2026-10-15",
      "amount": 13.99,
      "originalAmount": 13.99,
      "originalCurrency": "EUR",
      "accountId": "…",
      "category": { "name": "Abos", "icon": "📺", "color": "#ef4444" },
      "isSubscription": true
    }
  ]
}
```

`type` is `expense` (recurring), `daily_expense` (single entry) or `income`. A recurring item
appears once per due date.

### `GET /api/v1/insights`

Unread, unexpired insights (at most 50). Titles and messages are stored in German; use `type`,
`severity` and `metadata` for anything language independent.

```json
{
  "insights": [
    {
      "id": "…",
      "type": "spending_anomaly",
      "severity": "warning",
      "title": "…",
      "message": "…",
      "metadata": { "categoryId": "…" },
      "createdAt": "2026-10-15T06:00:00.000Z",
      "expiresAt": "2026-11-01T00:00:00.000Z"
    }
  ]
}
```

`type` is one of `spending_anomaly`, `budget_warning`, `saving_opportunity`,
`subscription_alert`, `trend_info`; `severity` is `info`, `warning` or `critical`.

## Implementation

| Piece                       | File                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------ |
| Token generation and lookup | `src/lib/auth/api-token.ts`                                                          |
| Token table                 | `api_tokens` in `src/lib/db/schema.ts`                                               |
| Token management (settings) | `src/actions/api-token-actions.ts`, `src/components/settings/api-token-settings.tsx` |
| Auth, rate limit, errors    | `src/lib/api/v1.ts`                                                                  |
| Query validation            | `src/lib/validations/api.ts`                                                         |
| Calculations                | `src/lib/services/*` (shared with the server actions)                                |
| Routes                      | `src/app/api/v1/*/route.ts`                                                          |
