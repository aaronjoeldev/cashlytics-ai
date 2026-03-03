import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { billingCustomers, users } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import {
  BILLING_TRIAL_DAYS,
  BILLING_USAGE_CAP_EUR,
  getStripeClient,
  getStripePriceId,
  resolveAppUrl,
  type BillingPlan,
} from "@/lib/stripe/server";
import { isBillingRequired } from "@/lib/billing/config";

const bodySchema = z.object({
  plan: z.enum(["monthly", "yearly"]),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

async function resolveOrCreateCustomer(userId: string, email: string | null) {
  const [existing] = await db
    .select()
    .from(billingCustomers)
    .where(eq(billingCustomers.userId, userId))
    .limit(1);

  if (existing) {
    return existing.stripeCustomerId;
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: {
      userId,
    },
  });

  await db.insert(billingCustomers).values({
    userId,
    stripeCustomerId: customer.id,
  });

  return customer.id;
}

export async function POST(req: Request) {
  if (!isBillingRequired()) {
    return NextResponse.json({ error: "Billing is disabled for this deployment" }, { status: 409 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const customerId = await resolveOrCreateCustomer(userId, user?.email ?? null);
    const plan = parsed.data.plan as BillingPlan;
    const priceId = getStripePriceId(plan);

    const stripe = getStripeClient();
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: parsed.data.successUrl ?? resolveAppUrl("/settings?billing=success"),
      cancel_url: parsed.data.cancelUrl ?? resolveAppUrl("/settings?billing=cancelled"),
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: BILLING_TRIAL_DAYS,
        metadata: {
          userId,
          usageCapEur: BILLING_USAGE_CAP_EUR,
          billingPlan: plan,
        },
      },
      metadata: {
        userId,
        billingPlan: plan,
      },
    });

    return NextResponse.json({ id: checkoutSession.id, url: checkoutSession.url });
  } catch (error) {
    logger.error("Stripe checkout session creation failed", "POST /api/stripe/checkout", error);
    return NextResponse.json({ error: "Unable to start checkout" }, { status: 500 });
  }
}
