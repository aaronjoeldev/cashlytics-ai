import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAppAccess } from "@/lib/billing/app-access";
import type { EntitlementSnapshot } from "@/lib/billing/repository";

function buildSnapshot(overrides: Partial<EntitlementSnapshot> = {}): EntitlementSnapshot {
  return {
    userId: "user-1",
    planCode: "trial",
    status: "trialing",
    aiEnabled: true,
    aiHardCapEur: "2.00",
    aiSpendToDateEur: "0.000000",
    trialStartedAt: new Date("2026-03-01T00:00:00.000Z"),
    trialEndsAt: new Date("2026-03-08T00:00:00.000Z"),
    aiBlockedReason: null,
    stripeSubscriptionId: null,
    subscriptionStatus: null,
    planInterval: null,
    currentPeriodEnd: null,
    ...overrides,
  };
}

test("locks app to settings-only when trial is expired and user is unpaid", () => {
  const decision = evaluateAppAccess(buildSnapshot(), new Date("2026-03-08T00:00:00.000Z"), true);

  assert.equal(decision.appAccess, "settings_only");
  assert.equal(decision.lockReason, "trial_expired_unpaid");
});

test("keeps full app access for paid active users", () => {
  const decision = evaluateAppAccess(
    buildSnapshot({
      planCode: "pro",
      status: "active",
      subscriptionStatus: "active",
      trialEndsAt: new Date("2026-03-01T00:00:00.000Z"),
    }),
    new Date("2026-03-09T00:00:00.000Z"),
    true
  );

  assert.equal(decision.appAccess, "full");
  assert.equal(decision.lockReason, "none");
});

test("keeps full app access when billing is disabled for self-host mode", () => {
  const decision = evaluateAppAccess(buildSnapshot(), new Date("2026-03-09T00:00:00.000Z"), false);

  assert.equal(decision.appAccess, "full");
  assert.equal(decision.lockReason, "none");
});
