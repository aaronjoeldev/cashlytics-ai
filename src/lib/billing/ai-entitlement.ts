import {
  getAiEnforcementSnapshotByUserId,
  updateEntitlementAiEnforcementState,
  type AiEnforcementSnapshot,
} from "@/lib/billing/repository";
import { isBillingRequired } from "@/lib/billing/config";

export const AI_BLOCKED_ERROR_CODE = "AI_ENTITLEMENT_BLOCKED" as const;

const ACTIVE_PAID_STATUSES = new Set(["active", "trialing", "past_due"]);
const FREE_PLAN_CODES = new Set(["free", "trial"]);

export type AiBlockReason = "trial_expired" | "cap_reached";
export type AiUpgradeTarget = "paid_plan";

export type AiBlockedErrorPayload = {
  error: {
    code: typeof AI_BLOCKED_ERROR_CODE;
    reason: AiBlockReason;
    upgradeTarget: AiUpgradeTarget;
    message: string;
    hardCapEur: string;
    currentSpendEur: string;
    trialEndsAt: string | null;
  };
};

export type AiEntitlementDecision =
  | {
      allowed: true;
      spendEur: string;
      hardCapEur: string;
    }
  | {
      allowed: false;
      reason: AiBlockReason;
      spendEur: string;
      hardCapEur: string;
      trialEndsAt: string | null;
    };

function toMicroEur(amount: string): number {
  const trimmed = amount.trim();
  const negative = trimmed.startsWith("-");
  const [intPartRaw, fractionalPartRaw = ""] = trimmed.replace(/^-/, "").split(".");
  const intPart = Number.parseInt(intPartRaw || "0", 10);
  const fractional = Number.parseInt((fractionalPartRaw + "000000").slice(0, 6), 10);
  const value = intPart * 1_000_000 + fractional;
  return negative ? -value : value;
}

function isPaidSubscriptionActive(snapshot: AiEnforcementSnapshot): boolean {
  const normalizedStatus = (snapshot.subscriptionStatus ?? snapshot.status).toLowerCase();
  const isPaidPlan = !FREE_PLAN_CODES.has(snapshot.planCode.toLowerCase());

  return isPaidPlan && ACTIVE_PAID_STATUSES.has(normalizedStatus);
}

function toIsoOrNull(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function buildBlockedPayload(
  decision: Extract<AiEntitlementDecision, { allowed: false }>
): AiBlockedErrorPayload {
  return {
    error: {
      code: AI_BLOCKED_ERROR_CODE,
      reason: decision.reason,
      upgradeTarget: "paid_plan",
      message:
        decision.reason === "cap_reached"
          ? "Dein AI-Testlimit von 2,00 EUR wurde erreicht. Bitte upgrade auf einen bezahlten Plan."
          : "Deine Testphase ist abgelaufen. Bitte upgrade auf einen bezahlten Plan.",
      hardCapEur: decision.hardCapEur,
      currentSpendEur: decision.spendEur,
      trialEndsAt: decision.trialEndsAt,
    },
  };
}

export function evaluateAiEntitlement(
  snapshot: AiEnforcementSnapshot,
  now: Date = new Date(),
  billingRequired: boolean = true
): AiEntitlementDecision {
  const spendEur = snapshot.monthlySpendEur;
  const hardCapEur = snapshot.aiHardCapEur;

  if (!billingRequired) {
    return {
      allowed: true,
      spendEur,
      hardCapEur,
    };
  }

  if (isPaidSubscriptionActive(snapshot)) {
    return {
      allowed: true,
      spendEur,
      hardCapEur,
    };
  }

  const capReached = toMicroEur(spendEur) >= toMicroEur(hardCapEur);
  if (capReached) {
    return {
      allowed: false,
      reason: "cap_reached",
      spendEur,
      hardCapEur,
      trialEndsAt: toIsoOrNull(snapshot.trialEndsAt),
    };
  }

  const trialExpired =
    snapshot.trialEndsAt !== null && now.getTime() >= snapshot.trialEndsAt.getTime();
  if (trialExpired) {
    return {
      allowed: false,
      reason: "trial_expired",
      spendEur,
      hardCapEur,
      trialEndsAt: toIsoOrNull(snapshot.trialEndsAt),
    };
  }

  return {
    allowed: true,
    spendEur,
    hardCapEur,
  };
}

export async function getAiBlockedErrorPayload(
  userId: string
): Promise<AiBlockedErrorPayload | null> {
  if (!isBillingRequired()) {
    return null;
  }

  const snapshot = await getAiEnforcementSnapshotByUserId(userId);
  if (!snapshot) {
    return {
      error: {
        code: AI_BLOCKED_ERROR_CODE,
        reason: "trial_expired",
        upgradeTarget: "paid_plan",
        message:
          "Der AI-Assistent ist aktuell nicht verfugbar. Bitte upgrade auf einen bezahlten Plan.",
        hardCapEur: "2.00",
        currentSpendEur: "0.000000",
        trialEndsAt: null,
      },
    };
  }

  const decision = evaluateAiEntitlement(snapshot);

  await updateEntitlementAiEnforcementState({
    userId,
    aiBlockedReason: decision.allowed ? null : decision.reason,
    aiSpendToDateEur: decision.spendEur,
  });

  if (decision.allowed) {
    return null;
  }

  return buildBlockedPayload(decision);
}
