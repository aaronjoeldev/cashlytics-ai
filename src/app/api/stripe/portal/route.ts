import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { billingCustomers } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import { getStripeClient, resolveAppUrl } from "@/lib/stripe/server";
import { isBillingRequired } from "@/lib/billing/config";

const bodySchema = z.object({
  returnUrl: z.string().url().optional(),
});

export async function POST(req: Request) {
  if (!isBillingRequired()) {
    return NextResponse.json({ error: "Billing is disabled for this deployment" }, { status: 409 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const [customer] = await db
      .select({ stripeCustomerId: billingCustomers.stripeCustomerId })
      .from(billingCustomers)
      .where(eq(billingCustomers.userId, session.user.id))
      .limit(1);

    if (!customer?.stripeCustomerId) {
      return NextResponse.json({ error: "No billing customer found" }, { status: 404 });
    }

    const stripe = getStripeClient();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customer.stripeCustomerId,
      return_url: parsed.data.returnUrl ?? resolveAppUrl("/settings"),
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    logger.error("Stripe portal session creation failed", "POST /api/stripe/portal", error);
    return NextResponse.json({ error: "Unable to open billing portal" }, { status: 500 });
  }
}
