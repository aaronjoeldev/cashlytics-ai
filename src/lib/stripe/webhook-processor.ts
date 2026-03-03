import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { billingEvents, billingSubscriptions } from "@/lib/db/schema";
import {
  ensureBillingCustomer,
  findUserByStripeCustomerId,
  mapSubscription,
  toDate,
  upsertBillingSubscription,
} from "@/lib/billing/subscriptions";
import { getStripeClient } from "@/lib/stripe/server";

export type WebhookProcessOutcome = "processed" | "ignored" | "out_of_order";
export type BillingEventOutcome = "processed" | "ignored" | "failed";

function asString(value: string | { id: string } | null): string | null {
  if (!value) {
    return null;
  }
  return typeof value === "string" ? value : value.id;
}

export async function setBillingEventOutcome(stripeEventId: string, outcome: BillingEventOutcome) {
  await db
    .update(billingEvents)
    .set({ outcome, processedAt: new Date() })
    .where(eq(billingEvents.stripeEventId, stripeEventId));
}

async function handleCheckoutCompleted(
  event: Stripe.Event,
  stripeEventCreatedAt: Date
): Promise<WebhookProcessOutcome> {
  const session = event.data.object as Stripe.Checkout.Session;

  if (session.mode !== "subscription") {
    return "ignored";
  }

  const stripeCustomerId = asString(session.customer);
  const stripeSubscriptionId = asString(session.subscription);
  if (!stripeCustomerId || !stripeSubscriptionId) {
    return "ignored";
  }

  const fallbackMapping = await findUserByStripeCustomerId(stripeCustomerId);
  const userId = session.metadata?.userId ?? fallbackMapping?.userId;
  if (!userId) {
    return "ignored";
  }

  const customer = await ensureBillingCustomer(userId, stripeCustomerId);
  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

  const result = await upsertBillingSubscription({
    userId,
    billingCustomerId: customer.id,
    snapshot: mapSubscription(subscription),
    stripeEventCreatedAt,
  });

  return result.applied ? "processed" : "out_of_order";
}

async function handleSubscriptionEvent(
  event: Stripe.Event,
  stripeEventCreatedAt: Date
): Promise<WebhookProcessOutcome> {
  const subscription = event.data.object as Stripe.Subscription;
  const stripeCustomerId = asString(subscription.customer);
  if (!stripeCustomerId) {
    return "ignored";
  }

  const mapping = await findUserByStripeCustomerId(stripeCustomerId);
  if (!mapping) {
    return "ignored";
  }

  const result = await upsertBillingSubscription({
    userId: mapping.userId,
    billingCustomerId: mapping.billingCustomerId,
    snapshot: mapSubscription(subscription),
    stripeEventCreatedAt,
  });

  return result.applied ? "processed" : "out_of_order";
}

async function handleInvoicePaymentFailed(
  event: Stripe.Event,
  stripeEventCreatedAt: Date
): Promise<WebhookProcessOutcome> {
  const invoice = event.data.object as Stripe.Invoice;
  const stripeCustomerId = asString(invoice.customer);
  if (!stripeCustomerId) {
    return "ignored";
  }

  const mapping = await findUserByStripeCustomerId(stripeCustomerId);
  if (!mapping) {
    return "ignored";
  }

  const invoiceSubscription = invoice.parent?.subscription_details?.subscription;
  const stripeSubscriptionId =
    typeof invoiceSubscription === "string" ? invoiceSubscription : invoiceSubscription?.id;

  if (stripeSubscriptionId) {
    const stripe = getStripeClient();
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const result = await upsertBillingSubscription({
      userId: mapping.userId,
      billingCustomerId: mapping.billingCustomerId,
      snapshot: mapSubscription(subscription),
      stripeEventCreatedAt,
    });
    return result.applied ? "processed" : "out_of_order";
  }

  const [existing] = await db
    .select()
    .from(billingSubscriptions)
    .where(eq(billingSubscriptions.userId, mapping.userId))
    .limit(1);

  if (
    existing?.lastStripeEventCreatedAt &&
    existing.lastStripeEventCreatedAt > stripeEventCreatedAt
  ) {
    return "out_of_order";
  }

  await db
    .update(billingSubscriptions)
    .set({
      status: "past_due",
      lastStripeEventCreatedAt: stripeEventCreatedAt,
      updatedAt: new Date(),
      currentPeriodStart: toDate(invoice.period_start),
      currentPeriodEnd: toDate(invoice.period_end),
    })
    .where(eq(billingSubscriptions.userId, mapping.userId));

  return "processed";
}

export async function processStripeEvent(event: Stripe.Event): Promise<WebhookProcessOutcome> {
  const stripeEventCreatedAt = new Date(event.created * 1000);

  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(event, stripeEventCreatedAt);
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return handleSubscriptionEvent(event, stripeEventCreatedAt);
    case "invoice.payment_failed":
      return handleInvoicePaymentFailed(event, stripeEventCreatedAt);
    default:
      return "ignored";
  }
}
