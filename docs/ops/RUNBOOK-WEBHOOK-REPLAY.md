# Webhook Replay Runbook

Use this runbook to replay a previously logged Stripe webhook event through the internal processor.

## Endpoint

- Method: `POST`
- Path: `/api/admin/stripe/webhooks/replay`
- Auth header: `x-admin-service-key: <ADMIN_SERVICE_KEY>`
- Content-Type: `application/json`

## Payload

```json
{
  "stripeEventId": "evt_123"
}
```

## Replay command

```bash
curl -sS -X POST "${APP_URL}/api/admin/stripe/webhooks/replay" \
  -H "x-admin-service-key: ${ADMIN_SERVICE_KEY}" \
  -H "content-type: application/json" \
  -d '{"stripeEventId":"evt_123"}'
```

Expected response shape:

```json
{
  "replayed": true,
  "stripeEventId": "evt_123",
  "eventType": "customer.subscription.updated",
  "previousOutcome": "failed",
  "outcome": "processed"
}
```

If auth is missing or invalid, the endpoint returns `401 Unauthorized`.
