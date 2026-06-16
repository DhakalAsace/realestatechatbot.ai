export const billingPlanKeys = ["free", "starter", "pro"] as const;
export type BillingPlanKey = (typeof billingPlanKeys)[number];

export const usageEventTypes = [
  "chat_turn",
  "ai_message",
  "follow_up_email",
  "bot_created",
  "channel_created",
  "team_member_added",
  "property_created",
  "knowledge_document_created",
] as const;

export type UsageEventType = (typeof usageEventTypes)[number];

export type EntitlementFeature =
  | "active_bots"
  | "channels"
  | "team_members"
  | "properties"
  | "knowledge_documents"
  | "monthly_chat_turns"
  | "monthly_ai_messages"
  | "monthly_follow_up_emails";

export type BillingLimits = Record<EntitlementFeature, number>;

export type BillingPlan = {
  key: BillingPlanKey;
  name: string;
  description: string;
  monthlyPriceLabel: string;
  limits: BillingLimits;
  priceEnvVar?: string;
};

export const billingPlans: Record<BillingPlanKey, BillingPlan> = {
  free: {
    key: "free",
    name: "Free",
    description: "Safe trial limits for early product review.",
    monthlyPriceLabel: "$0/mo",
    limits: {
      active_bots: 2,
      channels: 12,
      team_members: 5,
      properties: 25,
      knowledge_documents: 25,
      monthly_chat_turns: 500,
      monthly_ai_messages: 100,
      monthly_follow_up_emails: 100,
    },
  },
  starter: {
    key: "starter",
    name: "Starter",
    description: "One agent or small team running live lead capture.",
    monthlyPriceLabel: "TBD/mo",
    priceEnvVar: "STRIPE_STARTER_PRICE_ID",
    limits: {
      active_bots: 5,
      channels: 50,
      team_members: 10,
      properties: 100,
      knowledge_documents: 100,
      monthly_chat_turns: 3000,
      monthly_ai_messages: 1000,
      monthly_follow_up_emails: 1000,
    },
  },
  pro: {
    key: "pro",
    name: "Pro",
    description: "Brokerage-ready limits for multiple bots, channels, and teammates.",
    monthlyPriceLabel: "TBD/mo",
    priceEnvVar: "STRIPE_PRO_PRICE_ID",
    limits: {
      active_bots: 25,
      channels: 250,
      team_members: 50,
      properties: 1000,
      knowledge_documents: 1000,
      monthly_chat_turns: 20000,
      monthly_ai_messages: 10000,
      monthly_follow_up_emails: 10000,
    },
  },
};

export const featureLabels: Record<EntitlementFeature, string> = {
  active_bots: "active bots",
  channels: "channels",
  team_members: "team members",
  properties: "properties",
  knowledge_documents: "knowledge documents",
  monthly_chat_turns: "monthly chat turns",
  monthly_ai_messages: "monthly AI messages",
  monthly_follow_up_emails: "monthly follow-up emails",
};

export const usageFeatureEvents: Partial<Record<EntitlementFeature, UsageEventType>> = {
  monthly_chat_turns: "chat_turn",
  monthly_ai_messages: "ai_message",
  monthly_follow_up_emails: "follow_up_email",
};

export function isBillingPlanKey(value: unknown): value is BillingPlanKey {
  return typeof value === "string" && (billingPlanKeys as readonly string[]).includes(value);
}

export function getBillingPlan(planKey: BillingPlanKey | null | undefined): BillingPlan {
  return billingPlans[planKey && isBillingPlanKey(planKey) ? planKey : "free"];
}

export function getStripePriceId(planKey: BillingPlanKey, env: Record<string, string | undefined> = process.env) {
  const priceEnvVar = billingPlans[planKey].priceEnvVar;
  return priceEnvVar ? env[priceEnvVar]?.trim() || null : null;
}

export function planKeyForStripePrice(priceId: string | null | undefined, env: Record<string, string | undefined> = process.env): BillingPlanKey | null {
  if (!priceId) return null;

  for (const key of billingPlanKeys) {
    if (getStripePriceId(key, env) === priceId) return key;
  }

  return null;
}

export function configuredPaidPlanKeys(env: Record<string, string | undefined> = process.env) {
  return billingPlanKeys.filter((key) => key !== "free" && Boolean(getStripePriceId(key, env)));
}
