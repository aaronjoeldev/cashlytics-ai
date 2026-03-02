import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";
import { validateAdminServiceKey } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { billingEvents } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import { processStripeEvent, setBillingEventOutcome } from "@/lib/stripe/webhook-processor";

export const runtime = "nodejs";

const replayRequestSchema = z.object({
  stripeEventId: z.string().min(1),
});

export async function POST(request: Request) {
  const auth = validateAdminServiceKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = replayRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid replay payload",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const [billingEvent] = await db
    .select({
      stripeEventId: billingEvents.stripeEventId,
      eventType: billingEvents.eventType,
      outcome: billingEvents.outcome,
      payload: billingEvents.payload,
    })
    .from(billingEvents)
    .where(eq(billingEvents.stripeEventId, parsed.data.stripeEventId))
    .limit(1);

  if (!billingEvent) {
    return NextResponse.json({ error: "Billing event not found" }, { status: 404 });
  }

  if (!billingEvent.payload || typeof billingEvent.payload !== "object") {
    return NextResponse.json({ error: "Billing event payload is invalid" }, { status: 422 });
  }

  const stripeEvent = billingEvent.payload as unknown as Stripe.Event;
  if (stripeEvent.id !== billingEvent.stripeEventId) {
    return NextResponse.json({ error: "Billing event payload does not match id" }, { status: 422 });
  }

  try {
    const outcome = await processStripeEvent(stripeEvent);
    await setBillingEventOutcome(
      billingEvent.stripeEventId,
      outcome === "processed" ? "processed" : "ignored"
    );

    return NextResponse.json({
      replayed: true,
      stripeEventId: billingEvent.stripeEventId,
      eventType: billingEvent.eventType,
      previousOutcome: billingEvent.outcome,
      outcome,
    });
  } catch (error) {
    await setBillingEventOutcome(billingEvent.stripeEventId, "failed");
    logger.error("Stripe webhook replay failed", "POST /api/admin/stripe/webhooks/replay", error);
    return NextResponse.json({ error: "Webhook replay failed" }, { status: 500 });
  }
}
