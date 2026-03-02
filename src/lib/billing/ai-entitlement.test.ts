import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAiEntitlement } from "@/lib/billing/ai-entitlement";
import type { AiEnforcementSnapshot } from "@/lib/billing/repository";

function buildSnapshot(overrides: Partial<AiEnforcementSnapshot> = {}): AiEnforcementSnapshot {
  return {
    userId: "user-1",
    planCode: "trial",
    status: "trialing",
    aiEnabled: true,
    aiHardCapEur: "2.00",
    trialEndsAt: new Date("2026-03-09T00:00:00.000Z"),
    aiBlockedReason: null,
    subscriptionStatus: null,
    monthlySpendEur: "0.000000",
    ...overrides,
  };
}

test("blocks trial at hard cap boundary", () => {
  const decision = evaluateAiEntitlement(
    buildSnapshot({
      monthlySpendEur: "2.000000",
    }),
    new Date("2026-03-02T10:00:00.000Z")
  );

  assert.equal(decision.allowed, false);
  if (!decision.allowed) {
    assert.equal(decision.reason, "cap_reached");
  }
});

test("blocks trial when trial end timestamp is reached", () => {
  const decision = evaluateAiEntitlement(buildSnapshot(), new Date("2026-03-09T00:00:00.000Z"));

  assert.equal(decision.allowed, false);
  if (!decision.allowed) {
    assert.equal(decision.reason, "trial_expired");
  }
});

test("keeps paid active users unblocked despite expired trial and cap", () => {
  const decision = evaluateAiEntitlement(
    buildSnapshot({
      planCode: "pro",
      status: "active",
      subscriptionStatus: "active",
      trialEndsAt: new Date("2026-02-20T00:00:00.000Z"),
      monthlySpendEur: "9.500000",
    }),
    new Date("2026-03-02T10:00:00.000Z")
  );

  assert.equal(decision.allowed, true);
});

test("keeps AI available when billing is disabled", () => {
  const decision = evaluateAiEntitlement(
    buildSnapshot({
      trialEndsAt: new Date("2026-02-20T00:00:00.000Z"),
      monthlySpendEur: "9.500000",
    }),
    new Date("2026-03-02T10:00:00.000Z"),
    false
  );

  assert.equal(decision.allowed, true);
});
