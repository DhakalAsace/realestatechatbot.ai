import "server-only";

import Stripe from "stripe";
import { billingPlanKeys, getStripePriceId, type BillingPlanKey } from "@/lib/billing/plans";

let stripeClient: Stripe | null = null;

export function getStripeRuntimeStatus(env: Record<string, string | undefined> = process.env) {
  const hasSecretKey = Boolean(env.STRIPE_SECRET_KEY?.trim());
  const hasPublishableKey = Boolean(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || env.STRIPE_PUBLISHABLE_KEY?.trim());
  const hasWebhookSecret = Boolean(env.STRIPE_WEBHOOK_SECRET?.trim());
  const configuredPriceKeys = billingPlanKeys.filter((key) => key !== "free" && Boolean(getStripePriceId(key, env)));

  return {
    hasSecretKey,
    hasPublishableKey,
    hasWebhookSecret,
    configuredPriceKeys,
    checkoutReady: hasSecretKey && configuredPriceKeys.length > 0,
    webhookReady: hasWebhookSecret,
  };
}

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) throw new Error("missing_stripe_secret_key");

  stripeClient ??= new Stripe(secretKey, { typescript: true });
  return stripeClient;
}

export function constructStripeWebhookEvent(payload: string, signature: string, webhookSecret: string) {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() || "sk_test_webhook_verification_placeholder";
  const client = new Stripe(secretKey, { typescript: true });
  return client.webhooks.constructEvent(payload, signature, webhookSecret);
}

export function requireStripePriceId(planKey: BillingPlanKey) {
  const priceId = getStripePriceId(planKey);
  if (!priceId) throw new Error(`missing_stripe_price:${planKey}`);
  return priceId;
}
