import { and, eq, isNull, lte, or } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { billingCustomers, billingPlanIntervalEnum, billingSubscriptions } from "@/lib/db/schema";

type BillingPlanInterval = (typeof billingPlanIntervalEnum.enumValues)[number];

type SubscriptionSnapshot = {
  stripeSubscriptionId: string;
  stripePriceId: string | null;
  status: string;
  planInterval: BillingPlanInterval | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  trialStartsAt: Date | null;
  trialEndsAt: Date | null;
  canceledAt: Date | null;
};

export function toDate(unixSeconds?: number | null): Date | null {
  if (!unixSeconds) {
    return null;
  }
  return new Date(unixSeconds * 1000);
}

export function mapSubscription(subscription: Stripe.Subscription): SubscriptionSnapshot {
  const firstItem = subscription.items.data[0];
  const recurringInterval = firstItem?.price.recurring?.interval;

  return {
    stripeSubscriptionId: subscription.id,
    stripePriceId: firstItem?.price.id ?? null,
    status: subscription.status,
    planInterval:
      recurringInterval === "month" ? "monthly" : recurringInterval === "year" ? "yearly" : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodStart: toDate(firstItem?.current_period_start),
    currentPeriodEnd: toDate(firstItem?.current_period_end),
    trialStartsAt: toDate(subscription.trial_start),
    trialEndsAt: toDate(subscription.trial_end),
    canceledAt: toDate(subscription.canceled_at),
  };
}

export async function ensureBillingCustomer(userId: string, stripeCustomerId: string) {
  const [existing] = await db
    .select()
    .from(billingCustomers)
    .where(
      and(
        eq(billingCustomers.userId, userId),
        eq(billingCustomers.stripeCustomerId, stripeCustomerId)
      )
    )
    .limit(1);

  if (existing) {
    return existing;
  }

  const now = new Date();
  const [created] = await db
    .insert(billingCustomers)
    .values({ userId, stripeCustomerId, updatedAt: now })
    .onConflictDoUpdate({
      target: billingCustomers.userId,
      set: { stripeCustomerId, updatedAt: now },
    })
    .returning();

  return created;
}

export async function upsertBillingSubscription(params: {
  userId: string;
  billingCustomerId: string;
  snapshot: SubscriptionSnapshot;
  stripeEventCreatedAt: Date;
}) {
  const { userId, billingCustomerId, snapshot, stripeEventCreatedAt } = params;
  const [existing] = await db
    .select()
    .from(billingSubscriptions)
    .where(eq(billingSubscriptions.userId, userId))
    .limit(1);

  if (
    existing?.lastStripeEventCreatedAt &&
    existing.lastStripeEventCreatedAt > stripeEventCreatedAt
  ) {
    return { applied: false as const, reason: "out_of_order" as const };
  }

  const now = new Date();
  await db
    .insert(billingSubscriptions)
    .values({
      userId,
      billingCustomerId,
      stripeSubscriptionId: snapshot.stripeSubscriptionId,
      stripePriceId: snapshot.stripePriceId,
      status: snapshot.status,
      planInterval: snapshot.planInterval,
      cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
      currentPeriodStart: snapshot.currentPeriodStart,
      currentPeriodEnd: snapshot.currentPeriodEnd,
      trialStartsAt: snapshot.trialStartsAt,
      trialEndsAt: snapshot.trialEndsAt,
      canceledAt: snapshot.canceledAt,
      lastStripeEventCreatedAt: stripeEventCreatedAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: billingSubscriptions.userId,
      set: {
        billingCustomerId,
        stripeSubscriptionId: snapshot.stripeSubscriptionId,
        stripePriceId: snapshot.stripePriceId,
        status: snapshot.status,
        planInterval: snapshot.planInterval,
        cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
        currentPeriodStart: snapshot.currentPeriodStart,
        currentPeriodEnd: snapshot.currentPeriodEnd,
        trialStartsAt: snapshot.trialStartsAt,
        trialEndsAt: snapshot.trialEndsAt,
        canceledAt: snapshot.canceledAt,
        lastStripeEventCreatedAt: stripeEventCreatedAt,
        updatedAt: now,
      },
      setWhere: or(
        isNull(billingSubscriptions.lastStripeEventCreatedAt),
        lte(billingSubscriptions.lastStripeEventCreatedAt, stripeEventCreatedAt)
      ),
    });

  return { applied: true as const };
}

export async function findUserByStripeCustomerId(stripeCustomerId: string) {
  const [row] = await db
    .select({ userId: billingCustomers.userId, billingCustomerId: billingCustomers.id })
    .from(billingCustomers)
    .where(eq(billingCustomers.stripeCustomerId, stripeCustomerId))
    .limit(1);

  return row ?? null;
}
