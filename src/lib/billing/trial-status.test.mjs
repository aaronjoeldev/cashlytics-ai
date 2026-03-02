import assert from "node:assert/strict";
import test from "node:test";
import {
  TRIAL_DURATION_MS,
  calculateTrialEndsAt,
  getTrialRemainingMs,
  getTrialState,
} from "./trial-status.ts";

test("trial duration is exactly 7x24 hours", () => {
  const startedAt = new Date("2026-03-01T12:34:56.789Z");
  const endsAt = calculateTrialEndsAt(startedAt);

  assert.equal(endsAt.getTime() - startedAt.getTime(), TRIAL_DURATION_MS);
  assert.equal(endsAt.toISOString(), "2026-03-08T12:34:56.789Z");
});

test("trial is expired at exact end timestamp", () => {
  const trialEndsAt = new Date("2026-03-08T12:34:56.789Z");

  assert.equal(getTrialState(trialEndsAt, trialEndsAt), "expired");
  assert.equal(getTrialRemainingMs(trialEndsAt, trialEndsAt), 0);
});

test("trial remains active before exact expiry", () => {
  const trialEndsAt = new Date("2026-03-08T12:34:56.789Z");
  const justBefore = new Date(trialEndsAt.getTime() - 1);

  assert.equal(getTrialState(trialEndsAt, justBefore), "active");
  assert.equal(getTrialRemainingMs(trialEndsAt, justBefore), 1);
});
