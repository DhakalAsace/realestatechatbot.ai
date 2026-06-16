import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getBillingPlan, usageFeatureEvents, type BillingPlan, type BillingPlanKey, type EntitlementFeature, type UsageEventType } from "@/lib/billing/plans";

type AdminClient = Pick<SupabaseClient, "from" | "rpc">;

export type SubscriptionStatus = "free" | "incomplete" | "incomplete_expired" | "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "paused" | "inactive";

export type SubscriptionLike = {
  plan_key: BillingPlanKey | null;
  status: SubscriptionStatus | string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
};

export type UsageMetrics = Record<EntitlementFeature, number>;

export type BillingSummary = {
  plan: BillingPlan;
  status: SubscriptionStatus;
  subscription: SubscriptionLike | null;
  usage: UsageMetrics;
  periodStart: string;
};

export type EntitlementDecision = {
  allowed: boolean;
  feature: EntitlementFeature;
  planKey: BillingPlanKey;
  used: number;
  limit: number;
  remaining: number;
  reason?: "limit_reached" | "subscription_inactive";
  message?: string;
};

const resourceFeatureTables: Partial<Record<EntitlementFeature, { table: string; filters?: Record<string, string> }>> = {
  active_bots: { table: "bots", filters: { status: "active" } },
  channels: { table: "bot_channels", filters: { status: "active" } },
  team_members: { table: "workspace_members" },
  properties: { table: "properties" },
  knowledge_documents: { table: "knowledge_documents" },
};

export function currentBillingPeriodStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function normalizeSubscriptionStatus(status: string | null | undefined): SubscriptionStatus {
  const value = status ?? "free";
  if (["free", "incomplete", "incomplete_expired", "trialing", "active", "past_due", "canceled", "unpaid", "paused", "inactive"].includes(value)) {
    return value as SubscriptionStatus;
  }
  return "inactive";
}

export function isCostlyActionAllowedForStatus(status: SubscriptionStatus, periodEnd?: string | null, now = new Date()) {
  if (status === "free" || status === "active" || status === "trialing") return true;
  if (status === "canceled" && periodEnd && new Date(periodEnd).getTime() > now.getTime()) return true;
  return false;
}

export function decideEntitlement({
  feature,
  plan,
  status,
  used,
  increment = 1,
  periodEnd,
  now,
}: {
  feature: EntitlementFeature;
  plan: BillingPlan;
  status: SubscriptionStatus;
  used: number;
  increment?: number;
  periodEnd?: string | null;
  now?: Date;
}): EntitlementDecision {
  const limit = plan.limits[feature];
  const remaining = Math.max(0, limit - used);

  if (!isCostlyActionAllowedForStatus(status, periodEnd, now)) {
    return {
      allowed: false,
      feature,
      planKey: plan.key,
      used,
      limit,
      remaining,
      reason: "subscription_inactive",
      message: "This workspace billing status is not active for new usage.",
    };
  }

  if (used + increment > limit) {
    return {
      allowed: false,
      feature,
      planKey: plan.key,
      used,
      limit,
      remaining,
      reason: "limit_reached",
      message: `This workspace has reached the ${feature.replaceAll("_", " ")} limit for the ${plan.name} plan.`,
    };
  }

  return { allowed: true, feature, planKey: plan.key, used, limit, remaining: Math.max(0, limit - used - increment) };
}

export async function getWorkspaceBillingSummary(admin: AdminClient, workspaceId: string, now = new Date()): Promise<BillingSummary> {
  const periodStart = currentBillingPeriodStart(now);
  const { data: subscription } = await admin
    .from("subscriptions")
    .select("plan_key, status, current_period_end, cancel_at_period_end")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const normalizedSubscription = subscription as SubscriptionLike | null;
  const status = normalizeSubscriptionStatus(normalizedSubscription?.status ?? "free");
  const plan = getBillingPlan(normalizedSubscription?.plan_key ?? "free");
  const usage = await loadUsageMetrics(admin, workspaceId, periodStart);

  return { plan, status, subscription: normalizedSubscription, usage, periodStart };
}

export async function checkWorkspaceEntitlement(
  admin: AdminClient,
  workspaceId: string,
  feature: EntitlementFeature,
  options: { increment?: number; now?: Date } = {},
): Promise<EntitlementDecision> {
  const summary = await getWorkspaceBillingSummary(admin, workspaceId, options.now);
  return decideEntitlement({
    feature,
    plan: summary.plan,
    status: summary.status,
    used: summary.usage[feature],
    increment: options.increment ?? 1,
    periodEnd: summary.subscription?.current_period_end,
    now: options.now,
  });
}

export async function recordUsageEvent(
  admin: AdminClient,
  input: {
    workspaceId: string;
    eventType: UsageEventType;
    quantity?: number;
    sourceType?: string;
    sourceId?: string | null;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  },
) {
  const { data, error } = await admin.rpc("reserve_usage_event", {
    p_workspace_id: input.workspaceId,
    p_event_type: input.eventType,
    p_quantity: input.quantity ?? 1,
    p_source_type: input.sourceType ?? null,
    p_source_id: input.sourceId ?? null,
    p_idempotency_key: input.idempotencyKey,
    p_metadata: input.metadata ?? {},
  });

  if (error) return { ok: false as const, error: error.message };

  const result = Array.isArray(data) ? data[0] : data;
  if (!result) return { ok: false as const, error: "usage_reservation_missing" };
  if (!result.allowed) {
    return {
      ok: true as const,
      allowed: false as const,
      reason: String(result.reason ?? "limit_reached"),
      used: Number(result.used ?? 0),
      limit: Number(result.limit_value ?? 0),
    };
  }

  return {
    ok: true as const,
    allowed: true as const,
    idempotent: Boolean(result.idempotent),
    usageEventId: typeof result.usage_event_id === "string" ? result.usage_event_id : null,
    used: Number(result.used ?? 0),
    limit: Number(result.limit_value ?? 0),
  };
}

async function loadUsageMetrics(admin: AdminClient, workspaceId: string, periodStart: string): Promise<UsageMetrics> {
  const base: UsageMetrics = {
    active_bots: 0,
    channels: 0,
    team_members: 0,
    properties: 0,
    knowledge_documents: 0,
    monthly_chat_turns: 0,
    monthly_ai_messages: 0,
    monthly_follow_up_emails: 0,
  };

  const countEntries = await Promise.all(
    Object.entries(resourceFeatureTables).map(async ([feature, config]) => {
      let query = admin
        .from(config.table)
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId);

      for (const [key, value] of Object.entries(config.filters ?? {})) {
        query = query.eq(key, value);
      }

      const { count } = await query;
      return [feature as EntitlementFeature, count ?? 0] as const;
    }),
  );

  for (const [feature, count] of countEntries) base[feature] = count;

  const { data: usageEvents } = await admin
    .from("usage_events")
    .select("event_type, quantity")
    .eq("workspace_id", workspaceId)
    .gte("occurred_at", periodStart);

  for (const event of (usageEvents ?? []) as Array<{ event_type: UsageEventType; quantity: number }>) {
    const feature = featureForUsageEvent(event.event_type);
    if (feature) base[feature] += event.quantity;
  }

  return base;
}

function featureForUsageEvent(eventType: UsageEventType): EntitlementFeature | null {
  for (const [feature, mappedEvent] of Object.entries(usageFeatureEvents)) {
    if (mappedEvent === eventType) return feature as EntitlementFeature;
  }
  return null;
}
