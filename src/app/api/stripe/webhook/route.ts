import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { billingEvents } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import { findUserByStripeCustomerId } from "@/lib/billing/subscriptions";
import { getStripeClient, getStripeWebhookSecret } from "@/lib/stripe/server";
import { processStripeEvent, setBillingEventOutcome } from "@/lib/stripe/webhook-processor";

export const runtime = "nodejs";

function asString(value: string | { id: string } | null): string | null {
  if (!value) {
    return null;
  }
  return typeof value === "string" ? value : value.id;
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());
  } catch {
    logger.warn("Stripe webhook signature verification failed", "POST /api/stripe/webhook");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const stripeEventCreatedAt = new Date(event.created * 1000);
  const object = event.data.object as {
    customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null;
    subscription?: string | Stripe.Subscription | null;
  };
  const stripeCustomerId = asString(object.customer ?? null);
  const stripeSubscriptionId = asString(object.subscription ?? null);
  const checkoutMetadataUserId =
    event.type === "checkout.session.completed"
      ? (event.data.object as Stripe.Checkout.Session).metadata?.userId
      : null;
  const mapping = stripeCustomerId ? await findUserByStripeCustomerId(stripeCustomerId) : null;
  const resolvedUserId = checkoutMetadataUserId ?? mapping?.userId ?? null;

  const eventInsert = await db
    .insert(billingEvents)
    .values({
      stripeEventId: event.id,
      eventType: event.type,
      stripeCreatedAt: stripeEventCreatedAt,
      stripeCustomerId,
      stripeSubscriptionId,
      userId: resolvedUserId,
      payload: event,
    })
    .onConflictDoNothing({ target: billingEvents.stripeEventId })
    .returning({ id: billingEvents.id });

  if (eventInsert.length === 0) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    const outcome = await processStripeEvent(event);
    await setBillingEventOutcome(event.id, outcome === "processed" ? "processed" : "ignored");
    return NextResponse.json({ received: true, outcome });
  } catch (error) {
    await setBillingEventOutcome(event.id, "failed");
    logger.error("Stripe webhook processing failed", "POST /api/stripe/webhook", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
