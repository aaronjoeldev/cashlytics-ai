import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { entitlements } from "@/lib/db/schema";
import {
  calculateTrialEndsAt,
  getTrialRemainingMs,
  getTrialState,
  type TrialState,
} from "./trial-status";

export type TrialStatusSnapshot = {
  state: TrialState;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  remainingMs: number;
};

export async function initializeTrialForUser(userId: string, trialStartedAt: Date = new Date()) {
  const trialEndsAt = calculateTrialEndsAt(trialStartedAt);
  const now = new Date();

  await db
    .insert(entitlements)
    .values({
      userId,
      planCode: "trial",
      status: "trialing",
      aiEnabled: true,
      trialStartedAt,
      trialEndsAt,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: entitlements.userId });

  return { trialStartedAt, trialEndsAt };
}

export async function getTrialStatus(
  userId: string,
  now: Date = new Date()
): Promise<TrialStatusSnapshot> {
  const [entitlement] = await db
    .select({ trialStartedAt: entitlements.trialStartedAt, trialEndsAt: entitlements.trialEndsAt })
    .from(entitlements)
    .where(eq(entitlements.userId, userId))
    .limit(1);

  const trialStartedAt = entitlement?.trialStartedAt ?? null;
  const trialEndsAt = entitlement?.trialEndsAt ?? null;

  return {
    state: getTrialState(trialEndsAt, now),
    trialStartedAt,
    trialEndsAt,
    remainingMs: getTrialRemainingMs(trialEndsAt, now),
  };
}
