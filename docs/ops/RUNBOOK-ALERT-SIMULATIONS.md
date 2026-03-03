# Alert Simulation Runbook

Use this runbook to simulate critical alert scenarios for operations drills.

## Scenarios covered

- Webhook failure threshold breach (`failed >= 5` in 10-minute window)
- AI spend spike threshold breach (hourly spend >= 25 EUR and >= 2x baseline)

## Execute

```bash
npm run simulate:ops-alerts
```

The command prints JSON with both scenarios and exits non-zero if either scenario does not evaluate as `critical`.

## Test coverage

```bash
npm run test:ops-alerts
```

The test suite verifies both threshold scenarios map to critical alert status.
