import { db } from "@/lib/db";
import {
  billingCustomers,
  billingSubscriptions,
  entitlements,
  usagePeriods,
} from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export type EntitlementSnapshot = {
  userId: string;
  planCode: string;
  status: string;
  aiEnabled: boolean;
  aiHardCapEur: string;
  aiSpendToDateEur: string;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  aiBlockedReason: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  planInterval: "monthly" | "yearly" | null;
  currentPeriodEnd: Date | null;
};

export type SubscriptionUpsertInput = {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId?: string | null;
  status: string;
  planInterval?: "monthly" | "yearly" | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  trialStartsAt?: Date | null;
  trialEndsAt?: Date | null;
  canceledAt?: Date | null;
  stripeEventCreatedAt?: Date | null;
};

export type AiEnforcementSnapshot = {
  userId: string;
  planCode: string;
  status: string;
  aiEnabled: boolean;
  aiHardCapEur: string;
  trialEndsAt: Date | null;
  aiBlockedReason: string | null;
  subscriptionStatus: string | null;
  monthlySpendEur: string;
};

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export async function getEntitlementSnapshotByUserId(
  userId: string
): Promise<EntitlementSnapshot | null> {
  const [row] = await db
    .select({
      userId: entitlements.userId,
      planCode: entitlements.planCode,
      status: entitlements.status,
      aiEnabled: entitlements.aiEnabled,
      aiHardCapEur: entitlements.aiHardCapEur,
      aiSpendToDateEur: entitlements.aiSpendToDateEur,
      trialStartedAt: entitlements.trialStartedAt,
      trialEndsAt: entitlements.trialEndsAt,
      aiBlockedReason: entitlements.aiBlockedReason,
      stripeSubscriptionId: billingSubscriptions.stripeSubscriptionId,
      subscriptionStatus: billingSubscriptions.status,
      planInterval: billingSubscriptions.planInterval,
      currentPeriodEnd: billingSubscriptions.currentPeriodEnd,
    })
    .from(entitlements)
    .leftJoin(billingSubscriptions, eq(entitlements.billingSubscriptionId, billingSubscriptions.id))
    .where(eq(entitlements.userId, userId))
    .limit(1);

  return row ?? null;
}

export async function getAiEnforcementSnapshotByUserId(
  userId: string,
  now: Date = new Date()
): Promise<AiEnforcementSnapshot | null> {
  const monthStart = startOfUtcMonth(now);

  const [row] = await db
    .select({
      userId: entitlements.userId,
      planCode: entitlements.planCode,
      status: entitlements.status,
      aiEnabled: entitlements.aiEnabled,
      aiHardCapEur: entitlements.aiHardCapEur,
      trialEndsAt: entitlements.trialEndsAt,
      aiBlockedReason: entitlements.aiBlockedReason,
      subscriptionStatus: billingSubscriptions.status,
      monthlySpendEur: usagePeriods.totalCostEur,
    })
    .from(entitlements)
    .leftJoin(billingSubscriptions, eq(entitlements.billingSubscriptionId, billingSubscriptions.id))
    .leftJoin(
      usagePeriods,
      and(
        eq(usagePeriods.userId, entitlements.userId),
        eq(usagePeriods.periodType, "monthly"),
        eq(usagePeriods.periodStart, monthStart)
      )
    )
    .where(eq(entitlements.userId, userId))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    ...row,
    monthlySpendEur: row.monthlySpendEur ?? "0.000000",
  };
}

export async function updateEntitlementAiEnforcementState(input: {
  userId: string;
  aiBlockedReason: string | null;
  aiSpendToDateEur: string;
}): Promise<void> {
  await db
    .update(entitlements)
    .set({
      aiBlockedReason: input.aiBlockedReason,
      aiSpendToDateEur: input.aiSpendToDateEur,
      updatedAt: new Date(),
    })
    .where(eq(entitlements.userId, input.userId));
}

export async function upsertSubscriptionSnapshotFromWebhook(
  input: SubscriptionUpsertInput
): Promise<{ subscriptionId: string; billingCustomerId: string }> {
  return db.transaction(async (tx) => {
    const now = new Date();

    const [customer] = await tx
      .insert(billingCustomers)
      .values({
        userId: input.userId,
        stripeCustomerId: input.stripeCustomerId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: billingCustomers.userId,
        set: {
          stripeCustomerId: input.stripeCustomerId,
          updatedAt: now,
        },
      })
      .returning({ id: billingCustomers.id });

    const [subscription] = await tx
      .insert(billingSubscriptions)
      .values({
        userId: input.userId,
        billingCustomerId: customer.id,
        stripeSubscriptionId: input.stripeSubscriptionId,
        stripePriceId: input.stripePriceId ?? null,
        status: input.status,
        planInterval: input.planInterval ?? null,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
        currentPeriodStart: input.currentPeriodStart ?? null,
        currentPeriodEnd: input.currentPeriodEnd ?? null,
        trialStartsAt: input.trialStartsAt ?? null,
        trialEndsAt: input.trialEndsAt ?? null,
        canceledAt: input.canceledAt ?? null,
        lastStripeEventCreatedAt: input.stripeEventCreatedAt ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: billingSubscriptions.userId,
        set: {
          billingCustomerId: customer.id,
          stripeSubscriptionId: input.stripeSubscriptionId,
          stripePriceId: input.stripePriceId ?? null,
          status: input.status,
          planInterval: input.planInterval ?? null,
          cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
          currentPeriodStart: input.currentPeriodStart ?? null,
          currentPeriodEnd: input.currentPeriodEnd ?? null,
          trialStartsAt: input.trialStartsAt ?? null,
          trialEndsAt: input.trialEndsAt ?? null,
          canceledAt: input.canceledAt ?? null,
          lastStripeEventCreatedAt: input.stripeEventCreatedAt ?? null,
          updatedAt: now,
        },
      })
      .returning({ id: billingSubscriptions.id });

    return { subscriptionId: subscription.id, billingCustomerId: customer.id };
  });
}
