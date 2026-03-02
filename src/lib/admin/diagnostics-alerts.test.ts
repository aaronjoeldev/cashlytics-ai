import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateAiSpendSpikeAlert,
  evaluateWebhookFailureAlert,
} from "@/lib/admin/diagnostics-alerts";

test("webhook alert turns critical when failed count threshold is breached", () => {
  const result = evaluateWebhookFailureAlert({
    total: 12,
    failed: 5,
  });

  assert.equal(result.status, "critical");
  assert.equal(result.failedThresholdExceeded, true);
  assert.equal(result.failureRateThresholdExceeded, true);
});

test("AI spend spike alert turns critical when absolute and ratio thresholds are breached", () => {
  const result = evaluateAiSpendSpikeAlert({
    currentHourSpendEur: 40,
    baseline24hSpendEur: 120,
  });

  assert.equal(result.status, "critical");
  assert.equal(result.thresholdBreached, true);
  assert.equal(result.ratioToBaseline, 8);
});
