import type { TrialState } from "./trial-status";
import type { AppAccess, AppLockReason } from "./app-access";

export type BillingMeResponse = {
  billingRequired: boolean;
  appAccess: AppAccess;
  lockReason: AppLockReason;
  planCode: string;
  status: string;
  aiEnabled: boolean;
  aiHardCapEur: string;
  aiSpendToDateEur: string;
  subscription: {
    stripeSubscriptionId: string | null;
    status: string | null;
    planInterval: "monthly" | "yearly" | null;
    currentPeriodEnd: string | null;
  };
  trial: {
    status: TrialState;
    startedAt: string | null;
    endsAt: string | null;
    remainingMs: number;
  };
};
