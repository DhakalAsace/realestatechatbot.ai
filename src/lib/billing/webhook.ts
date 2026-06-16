import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { isBillingPlanKey, planKeyForStripePrice, type BillingPlanKey } from "@/lib/billing/plans";

type AdminClient = Pick<SupabaseClient, "from">;

type WebhookResult = { status: "processed" | "ignored" | "duplicate" | "failed"; workspaceId?: string | null; error?: string };

type SubscriptionPayload = {
  workspaceId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string | null;
  stripeProductId: string | null;
  planKey: BillingPlanKey;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  trialEnd: string | null;
  metadata: Record<string, unknown>;
};

export async function handleStripeWebhookEvent(admin: AdminClient, event: Stripe.Event): Promise<WebhookResult> {
  const inserted = await insertWebhookEvent(admin, event);
  if (inserted === "duplicate") return { status: "duplicate" };
  if (inserted !== "ok") return { status: "failed", error: inserted };

  try {
    const result = await applyStripeEvent(admin, event);
    await updateWebhookEvent(admin, event.id, {
      workspace_id: result.workspaceId ?? null,
      status: result.status === "ignored" ? "ignored" : "processed",
      processed_at: new Date().toISOString(),
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "unknown_webhook_error";
    await updateWebhookEvent(admin, event.id, { status: "failed", error_message: message });
    return { status: "failed", error: message };
  }
}

export function normalizeStripeSubscription(subscription: Stripe.Subscription): SubscriptionPayload | null {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  const metadata = objectMetadata(subscription.metadata);
  const workspaceId = stringValue(metadata.workspace_id);
  const firstItem = subscription.items?.data?.[0];
  const price = firstItem?.price;
  const priceId = price?.id ?? null;
  const productId = typeof price?.product === "string" ? price.product : price?.product?.id ?? null;
  const planKey = resolvePlanKey(metadata.plan_key, priceId);

  if (!customerId || !workspaceId || !planKey) return null;

  return {
    workspaceId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    stripeProductId: productId,
    planKey,
    status: subscription.status,
    currentPeriodStart: secondsToIso((subscription as unknown as { current_period_start?: number }).current_period_start),
    currentPeriodEnd: secondsToIso((subscription as unknown as { current_period_end?: number }).current_period_end),
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    canceledAt: secondsToIso(subscription.canceled_at),
    trialEnd: secondsToIso(subscription.trial_end),
    metadata,
  };
}

async function applyStripeEvent(admin: AdminClient, event: Stripe.Event): Promise<WebhookResult> {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(admin, event.data.object as Stripe.Checkout.Session);
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return handleSubscription(admin, event.data.object as Stripe.Subscription);
    case "invoice.payment_failed":
      return handleInvoicePaymentFailed(admin, event.data.object as Stripe.Invoice);
    default:
      return { status: "ignored" };
  }
}

async function handleCheckoutCompleted(admin: AdminClient, session: Stripe.Checkout.Session): Promise<WebhookResult> {
  const metadata = objectMetadata(session.metadata);
  const workspaceId = stringValue(metadata.workspace_id);
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const customerEmail = session.customer_details?.email ?? session.customer_email ?? null;

  if (!workspaceId || !customerId) return { status: "ignored" };

  await upsertBillingCustomer(admin, { workspaceId, stripeCustomerId: customerId, email: customerEmail, metadata });
  return { status: "processed", workspaceId };
}

async function handleSubscription(admin: AdminClient, subscription: Stripe.Subscription): Promise<WebhookResult> {
  const payload = normalizeStripeSubscription(subscription);
  if (!payload) return { status: "ignored" };

  const resolvedWorkspaceId = await resolveWorkspaceForStripeCustomer(admin, payload.stripeCustomerId, payload.workspaceId);
  if (!resolvedWorkspaceId) return { status: "ignored" };
  payload.workspaceId = resolvedWorkspaceId;

  await upsertBillingCustomer(admin, {
    workspaceId: payload.workspaceId,
    stripeCustomerId: payload.stripeCustomerId,
    email: stringValue(payload.metadata.customer_email),
    metadata: payload.metadata,
  });

  const { data: customer } = await admin
    .from("billing_customers")
    .select("id")
    .eq("workspace_id", payload.workspaceId)
    .eq("stripe_customer_id", payload.stripeCustomerId)
    .maybeSingle();

  const { error } = await admin.from("subscriptions").upsert(
    {
      workspace_id: payload.workspaceId,
      billing_customer_id: (customer as { id?: string } | null)?.id ?? null,
      stripe_customer_id: payload.stripeCustomerId,
      stripe_subscription_id: payload.stripeSubscriptionId,
      stripe_price_id: payload.stripePriceId,
      stripe_product_id: payload.stripeProductId,
      plan_key: payload.planKey,
      status: payload.status,
      current_period_start: payload.currentPeriodStart,
      current_period_end: payload.currentPeriodEnd,
      cancel_at_period_end: payload.cancelAtPeriodEnd,
      canceled_at: payload.canceledAt,
      trial_end: payload.trialEnd,
      metadata: payload.metadata,
    },
    { onConflict: "workspace_id,stripe_subscription_id" },
  );

  if (error) throw new Error(error.message);
  return { status: "processed", workspaceId: payload.workspaceId };
}

async function handleInvoicePaymentFailed(admin: AdminClient, invoice: Stripe.Invoice): Promise<WebhookResult> {
  const subscriptionId = stringValue((invoice as unknown as { subscription?: string | { id?: string } }).subscription);
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!subscriptionId && !customerId) return { status: "ignored" };

  let query = admin.from("subscriptions").update({ status: "past_due", metadata: { invoicePaymentFailedAt: new Date().toISOString(), invoiceId: invoice.id } });
  query = subscriptionId ? query.eq("stripe_subscription_id", subscriptionId) : query.eq("stripe_customer_id", customerId);
  const { data, error } = await query.select("workspace_id").maybeSingle();

  if (error) throw new Error(error.message);
  return { status: data ? "processed" : "ignored", workspaceId: (data as { workspace_id?: string } | null)?.workspace_id ?? null };
}

async function upsertBillingCustomer(admin: AdminClient, input: { workspaceId: string; stripeCustomerId: string; email: string | null; metadata: Record<string, unknown> }) {
  const resolvedWorkspaceId = await resolveWorkspaceForStripeCustomer(admin, input.stripeCustomerId, input.workspaceId);
  if (!resolvedWorkspaceId || resolvedWorkspaceId !== input.workspaceId) throw new Error("stripe_customer_workspace_mismatch");

  const { error } = await admin.from("billing_customers").upsert(
    {
      workspace_id: input.workspaceId,
      stripe_customer_id: input.stripeCustomerId,
      email: input.email,
      metadata: input.metadata,
    },
    { onConflict: "workspace_id" },
  );

  if (error) throw new Error(error.message);
}

async function resolveWorkspaceForStripeCustomer(admin: AdminClient, stripeCustomerId: string, metadataWorkspaceId: string | null) {
  const { data: byCustomer } = await admin
    .from("billing_customers")
    .select("workspace_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();
  const existingCustomerWorkspaceId = (byCustomer as { workspace_id?: string } | null)?.workspace_id ?? null;
  if (existingCustomerWorkspaceId) return existingCustomerWorkspaceId === metadataWorkspaceId ? existingCustomerWorkspaceId : null;

  if (!metadataWorkspaceId) return null;

  const { data: byWorkspace } = await admin
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("workspace_id", metadataWorkspaceId)
    .maybeSingle();
  const existingWorkspaceCustomerId = (byWorkspace as { stripe_customer_id?: string } | null)?.stripe_customer_id ?? null;
  if (existingWorkspaceCustomerId && existingWorkspaceCustomerId !== stripeCustomerId) return null;

  return metadataWorkspaceId;
}

async function insertWebhookEvent(admin: AdminClient, event: Stripe.Event) {
  const { data: existing } = await admin.from("stripe_webhook_events").select("stripe_event_id, status, created_at").eq("stripe_event_id", event.id).maybeSingle();
  if (existing) {
    const row = existing as { status?: string; created_at?: string };
    if (row.status === "processed" || row.status === "ignored") return "duplicate" as const;
    if (row.status === "processing" && row.created_at && Date.now() - new Date(row.created_at).getTime() < 5 * 60_000) return "duplicate" as const;

    const { error } = await admin
      .from("stripe_webhook_events")
      .update({ status: "processing", error_message: null, payload: event as unknown as Record<string, unknown>, updated_at: new Date().toISOString() })
      .eq("stripe_event_id", event.id);
    return error ? error.message : "ok" as const;
  }

  const { error } = await admin.from("stripe_webhook_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    api_version: event.api_version ?? null,
    livemode: event.livemode,
    status: "processing",
    payload: event as unknown as Record<string, unknown>,
  });

  if (error) {
    if (error.code === "23505") return "duplicate" as const;
    return error.message;
  }

  return "ok" as const;
}

async function updateWebhookEvent(admin: AdminClient, eventId: string, updates: Record<string, unknown>) {
  const { error } = await admin.from("stripe_webhook_events").update(updates).eq("stripe_event_id", eventId);
  if (error) throw new Error(error.message);
}

function resolvePlanKey(planKey: unknown, priceId: string | null): BillingPlanKey | null {
  if (isBillingPlanKey(planKey)) return planKey;
  return planKeyForStripePrice(priceId);
}

function objectMetadata(metadata: Stripe.Metadata | null | undefined): Record<string, unknown> {
  return metadata ? { ...metadata } : {};
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") return value.id;
  return null;
}

function secondsToIso(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value * 1000).toISOString() : null;
}
