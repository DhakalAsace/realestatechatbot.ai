import { expect, test, type Page } from "@playwright/test";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import Stripe from "stripe";
import ws from "ws";
import { billingPlans } from "@/lib/billing/plans";

loadDotEnv(".env.local");

const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabasePublishableKey = requireAnyEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY");
const supabaseSecretKey = requireEnv("SUPABASE_SECRET_KEY");
const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const password = `Phase8-${runId}!`;
const createdEmails = new Set<string>();
const webSocketTransport = ws as unknown as WebSocketLikeConstructor;

const admin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: webSocketTransport },
});

test.describe.serial("Phase 8 billing entitlements", () => {
  test.afterAll(async () => {
    for (const email of createdEmails) {
      await cleanupUser(email);
    }
  });

  test("shows billing state, enforces RLS, and blocks over-limit public chat", async ({ page }) => {
    const ownerEmail = uniqueEmail("phase8-owner");
    const viewerEmail = uniqueEmail("phase8-viewer");
    const outsiderEmail = uniqueEmail("phase8-outsider");
    const slug = `e2e-phase8-${runId}`;

    await createAccountThroughUi(page, ownerEmail);
    await completeOnboarding(page, {
      agentName: `Phase8 Agent ${runId}`,
      brokerage: `Phase8 Realty ${runId}`,
      email: `agent-${runId}@example.com`,
      phone: "+1 204 555 0198",
      city: "Winnipeg",
      serviceAreas: "Winnipeg, River Heights, St. Vital",
      slug,
    });

    const bot = await findBotBySlug(slug);

    await page.goto("/dashboard/billing");
    await expect(page.getByRole("heading", { name: "Plan, usage, and limits" })).toBeVisible();
    await expect(page.getByText("Stripe Checkout is disabled")).toBeVisible();
    await expect(page.getByText("Free").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Price missing" }).first()).toBeDisabled();
    await expect(page.getByRole("button", { name: "Open customer portal" })).toBeDisabled();

    const missingSignatureWebhook = await page.request.post("/api/stripe/webhook", { data: {} });
    expect(missingSignatureWebhook.status()).toBe(400);
    const badSignatureWebhook = await page.request.post("/api/stripe/webhook", { data: {}, headers: { "stripe-signature": "bad-signature" } });
    expect(badSignatureWebhook.status()).toBe(400);

    const signedPayload = JSON.stringify({
      id: `evt_phase8_signed_${runId}`,
      object: "event",
      api_version: "2026-02-25.clover",
      livemode: false,
      type: "ping",
      data: { object: {} },
    });
    const stripe = new Stripe("sk_test_phase8_placeholder");
    const signature = stripe.webhooks.generateTestHeaderString({ payload: signedPayload, secret: requireWebhookSecret() });
    const signedWebhook = await page.request.post("/api/stripe/webhook", {
      data: Buffer.from(signedPayload),
      headers: { "content-type": "application/json", "stripe-signature": signature },
    });
    expect(signedWebhook.status()).toBe(200);

    const extraChannels = Array.from({ length: billingPlans.free.limits.channels - 1 }, (_, index) => ({
      workspace_id: bot.workspace_id,
      bot_id: bot.id,
      type: "campaign",
      status: "active",
      public_key: `phase8-${runId}-${index}`,
      label: `Phase8 limit channel ${index}`,
      source: "phase8",
      medium: "campaign",
      allowed_origins: [],
      settings: {},
    }));
    const { error: channelSeedError } = await admin.from("bot_channels").insert(extraChannels);
    expect(channelSeedError).toBeNull();

    await page.goto("/dashboard/channels");
    await page.getByPlaceholder("Spring open house QR").fill(`Blocked channel ${runId}`);
    await page.locator('form').filter({ has: page.getByRole("button", { name: "Create channel" }) }).locator('select[name="type"]').selectOption("campaign");
    await page.getByRole("button", { name: "Create channel" }).click();
    await expect(page.getByText("channel limit")).toBeVisible();

    const ownerClient = await signInClient(ownerEmail);
    const { error: ownerUsageInsertError } = await ownerClient.from("usage_events").insert({
      workspace_id: bot.workspace_id,
      event_type: "chat_turn",
      quantity: 1,
      idempotency_key: `browser-forged-${runId}`,
    });
    expect(ownerUsageInsertError).not.toBeNull();

    await createConfirmedUser(viewerEmail);
    const viewerUser = await findAuthUser(viewerEmail);
    expect(viewerUser).not.toBeNull();
    const { error: viewerMembershipError } = await admin.from("workspace_members").insert({
      workspace_id: bot.workspace_id,
      user_id: viewerUser!.id,
      role: "viewer",
      invited_by: null,
    });
    expect(viewerMembershipError).toBeNull();

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInThroughUi(page, viewerEmail);
    await page.goto("/dashboard/billing");
    await expect(page.getByText("Read only")).toBeVisible();
    await expect(page.getByRole("button", { name: "Price missing" }).first()).toBeDisabled();
    await expect(page.getByRole("button", { name: "Open customer portal" })).toBeDisabled();

    const viewerClient = await signInClient(viewerEmail);
    const { error: viewerCustomerInsertError } = await viewerClient.from("billing_customers").insert({
      workspace_id: bot.workspace_id,
      stripe_customer_id: `cus_forged_${runId}`,
    });
    expect(viewerCustomerInsertError).not.toBeNull();

    const { data: anonUsage, error: anonUsageError } = await anonClient().from("usage_events").select("id").eq("workspace_id", bot.workspace_id);
    const { data: anonSubscriptions, error: anonSubscriptionError } = await anonClient().from("subscriptions").select("id").eq("workspace_id", bot.workspace_id);
    expect(anonUsageError).toBeNull();
    expect(anonSubscriptionError).toBeNull();
    expect(anonUsage).toEqual([]);
    expect(anonSubscriptions).toEqual([]);

    await createConfirmedUser(outsiderEmail);
    const outsiderClient = await signInClient(outsiderEmail);
    const { data: outsiderUsage, error: outsiderUsageError } = await outsiderClient.from("usage_events").select("id").eq("workspace_id", bot.workspace_id);
    const { data: outsiderSubscriptions, error: outsiderSubscriptionError } = await outsiderClient.from("subscriptions").select("id").eq("workspace_id", bot.workspace_id);
    expect(outsiderUsageError).toBeNull();
    expect(outsiderSubscriptionError).toBeNull();
    expect(outsiderUsage).toEqual([]);
    expect(outsiderSubscriptions).toEqual([]);

    const { error: seedUsageError } = await admin.from("usage_events").insert({
      workspace_id: bot.workspace_id,
      event_type: "chat_turn",
      quantity: billingPlans.free.limits.monthly_chat_turns,
      source_type: "e2e",
      idempotency_key: `phase8-over-limit-${runId}`,
      metadata: { runId },
    });
    expect(seedUsageError).toBeNull();

    const blockedChat = await page.request.post("/api/chat", { data: { slug, message: "buying" } });
    expect(blockedChat.status()).toBe(402);
    const blockedPayload = await blockedChat.json() as { error?: string };
    expect(blockedPayload.error).toContain("temporarily unavailable");

    const subscriptionId = `sub_phase8_rls_${runId}`;
    const { error: seedSubscriptionError } = await admin.from("subscriptions").insert({
      workspace_id: bot.workspace_id,
      stripe_customer_id: `cus_phase8_rls_${runId}`,
      stripe_subscription_id: subscriptionId,
      plan_key: "starter",
      status: "active",
    });
    expect(seedSubscriptionError).toBeNull();

    const { data: ownerSubscriptionUpdateData, error: ownerSubscriptionUpdateError } = await ownerClient
      .from("subscriptions")
      .update({ status: "canceled" })
      .eq("workspace_id", bot.workspace_id)
      .eq("stripe_subscription_id", subscriptionId)
      .select("id, status");
    expect(ownerSubscriptionUpdateError).toBeNull();
    expect(ownerSubscriptionUpdateData).toEqual([]);

    const { data: unchangedSubscription, error: unchangedSubscriptionError } = await admin
      .from("subscriptions")
      .select("status")
      .eq("workspace_id", bot.workspace_id)
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();
    expect(unchangedSubscriptionError).toBeNull();
    expect(unchangedSubscription?.status).toBe("active");

    await page.goto("/dashboard/billing");
    await expect(page.getByText(`${billingPlans.free.limits.monthly_chat_turns} / ${billingPlans.starter.limits.monthly_chat_turns}`).first()).toBeVisible();
  });
});


function uniqueEmail(prefix: string) {
  return `${prefix}-${runId}@example.com`;
}

async function createAccountThroughUi(page: Page, email: string) {
  createdEmails.add(email);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/dashboard|\/login\?/);

  if (page.url().includes("notice=confirm-email")) {
    const user = await findAuthUser(email);
    expect(user).not.toBeNull();
    await admin.auth.admin.updateUserById(user!.id, { email_confirm: true } as never);
    await signInThroughUi(page, email);
  }

  await expect(page).toHaveURL(/\/dashboard\/onboarding|\/dashboard/);
}

async function signInThroughUi(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);
}

async function completeOnboarding(page: Page, data: OnboardingData) {
  await expect(page.getByRole("heading", { name: "Set up the sample agent bot" })).toBeVisible();
  await page.getByLabel("Agent name").fill(data.agentName);
  await page.getByLabel("Brokerage").fill(data.brokerage);
  await page.getByLabel("Email").fill(data.email);
  await page.getByLabel("Phone").fill(data.phone);
  await page.getByLabel("City").fill(data.city);
  await page.getByLabel("Hosted slug").fill(data.slug);
  await page.getByLabel("Service areas").fill(data.serviceAreas);
  await page.getByRole("button", { name: "Create workspace and bot" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

function anonClient() {
  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: webSocketTransport },
  });
}

async function createConfirmedUser(email: string) {
  createdEmails.add(email);
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true } as never);
  expect(error).toBeNull();
}

async function signInClient(email: string) {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  expect(error).toBeNull();
  return client;
}

async function findAuthUser(email: string) {
  const { data, error } = await admin.auth.admin.listUsers();
  expect(error).toBeNull();
  return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function findBotBySlug(slug: string) {
  const { data, error } = await admin.from("bots").select("id, workspace_id, slug").eq("slug", slug).maybeSingle();
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  return data as { id: string; workspace_id: string; slug: string };
}

async function cleanupUser(email: string) {
  const user = await findAuthUser(email);
  if (user) await admin.auth.admin.deleteUser(user.id);
}

function loadDotEnv(file: string) {
  const envPath = path.join(process.cwd(), file);
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function requireWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET || "whsec_e2e_test";
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function requireAnyEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(`Missing one of ${names.join(", ")}`);
}

type OnboardingData = {
  agentName: string;
  brokerage: string;
  email: string;
  phone: string;
  city: string;
  serviceAreas: string;
  slug: string;
};
