import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { BillingMeResponse } from "@/lib/billing/contracts";
import { evaluateAppAccess } from "@/lib/billing/app-access";
import { isBillingRequired } from "@/lib/billing/config";
import { getEntitlementSnapshotByUserId } from "@/lib/billing/repository";
import { getTrialState, getTrialRemainingMs } from "@/lib/billing/trial-status";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await getEntitlementSnapshotByUserId(session.user.id);

  if (!snapshot) {
    return NextResponse.json({ error: "No billing record found" }, { status: 404 });
  }

  const trialState = getTrialState(snapshot.trialEndsAt);
  const remainingMs = getTrialRemainingMs(snapshot.trialEndsAt);
  const billingRequired = isBillingRequired();
  const appAccessDecision = evaluateAppAccess(snapshot, new Date(), billingRequired);

  return NextResponse.json<BillingMeResponse>({
    billingRequired,
    appAccess: appAccessDecision.appAccess,
    lockReason: appAccessDecision.lockReason,
    planCode: snapshot.planCode,
    status: snapshot.status,
    aiEnabled: snapshot.aiEnabled,
    aiHardCapEur: snapshot.aiHardCapEur,
    aiSpendToDateEur: snapshot.aiSpendToDateEur,
    subscription: {
      stripeSubscriptionId: snapshot.stripeSubscriptionId,
      status: snapshot.subscriptionStatus,
      planInterval: snapshot.planInterval,
      currentPeriodEnd: snapshot.currentPeriodEnd?.toISOString() ?? null,
    },
    trial: {
      status: trialState,
      startedAt: snapshot.trialStartedAt?.toISOString() ?? null,
      endsAt: snapshot.trialEndsAt?.toISOString() ?? null,
      remainingMs,
    },
  });
}
