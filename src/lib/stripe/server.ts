import Stripe from "stripe";

const DEFAULT_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const BILLING_TRIAL_DAYS = 7;
export const BILLING_USAGE_CAP_EUR = "2.00";

export type BillingPlan = "monthly" | "yearly";

let stripeClient: Stripe | null = null;

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export function getStripeSecretKey(): string {
  return getEnv("STRIPE_SECRET_KEY");
}

export function getStripeWebhookSecret(): string {
  return getEnv("STRIPE_WEBHOOK_SECRET");
}

export function getStripePriceId(plan: BillingPlan): string {
  if (plan === "monthly") {
    return getEnv("STRIPE_PRICE_MONTHLY_ID");
  }
  return getEnv("STRIPE_PRICE_YEARLY_ID");
}

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(getStripeSecretKey());
  }
  return stripeClient;
}

export function resolveAppUrl(pathname = ""): string {
  return `${DEFAULT_APP_URL}${pathname}`;
}
