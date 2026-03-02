import type { EntitlementSnapshot } from "@/lib/billing/repository";
import { isBillingRequired } from "@/lib/billing/config";

const ACTIVE_PAID_STATUSES = new Set(["active", "trialing", "past_due"]);
const FREE_PLAN_CODES = new Set(["free", "trial"]);

export type AppAccess = "full" | "settings_only";
export type AppLockReason = "trial_expired_unpaid" | "none";

export type AppAccessDecision = {
  appAccess: AppAccess;
  lockReason: AppLockReason;
};

function isPaidSubscriptionActive(snapshot: EntitlementSnapshot): boolean {
  const normalizedStatus = (snapshot.subscriptionStatus ?? snapshot.status).toLowerCase();
  const isPaidPlan = !FREE_PLAN_CODES.has(snapshot.planCode.toLowerCase());
  return isPaidPlan && ACTIVE_PAID_STATUSES.has(normalizedStatus);
}

export function evaluateAppAccess(
  snapshot: EntitlementSnapshot,
  now: Date = new Date(),
  billingRequired: boolean = isBillingRequired()
): AppAccessDecision {
  if (!billingRequired) {
    return {
      appAccess: "full",
      lockReason: "none",
    };
  }

  if (isPaidSubscriptionActive(snapshot)) {
    return {
      appAccess: "full",
      lockReason: "none",
    };
  }

  const trialExpired =
    snapshot.trialEndsAt !== null && now.getTime() >= snapshot.trialEndsAt.getTime();

  if (trialExpired) {
    return {
      appAccess: "settings_only",
      lockReason: "trial_expired_unpaid",
    };
  }

  return {
    appAccess: "full",
    lockReason: "none",
  };
}
