import { expect, test, type Browser, type Page } from "@playwright/test";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import { createClient, type User } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ws from "ws";

loadDotEnv(".env.local");

const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabasePublishableKey = requireAnyEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY");
const supabaseSecretKey = requireEnv("SUPABASE_SECRET_KEY");
const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const password = `Phase7-${runId}!`;
const createdEmails = new Set<string>();
const webSocketTransport = ws as unknown as WebSocketLikeConstructor;

const admin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: webSocketTransport },
});

test.describe.serial("Phase 7 email follow-ups", () => {
  test.afterAll(async () => {
    for (const email of createdEmails) {
      await cleanupUser(email);
    }
  });

  test("records explicit consent, runs the secured scheduler, logs skipped test delivery, and unsubscribes by token", async ({ browser, page }) => {
    const ownerEmail = uniqueEmail("phase7-owner");
    const outsiderEmail = uniqueEmail("phase7-outsider");
    const slug = `e2e-phase7-${runId}`;
    const buyerName = `Phase7 Buyer ${runId}`;
    const buyerEmail = `phase7-buyer-${runId}@example.com`;

    await createAccountThroughUi(page, ownerEmail);
    await completeOnboarding(page, {
      agentName: `Phase7 Agent ${runId}`,
      brokerage: `Phase7 Realty ${runId}`,
      email: `agent-${runId}@example.com`,
      phone: "+1 204 555 0197",
      city: "Winnipeg",
      serviceAreas: "Winnipeg, River Heights, St. Vital",
      slug,
    });

    const bot = await findBotBySlug(slug);
    await exerciseFollowUpDashboardControls(page);
    await setFollowUpDelaysToZero(bot.id);

    const buyerPage = await newPublicPage(browser);
    await completeBuyerFlow(buyerPage, slug, buyerName, buyerEmail);
    await buyerPage.close();

    const buyerLead = await findLeadByEmail(buyerEmail);

    const denied = await page.request.post("/api/follow-ups/run");
    expect(denied.status()).toBe(401);

    const preConsentRun = await page.request.post("/api/follow-ups/run", { headers: { Authorization: "Bearer e2e-cron-secret" } });
    expect(preConsentRun.ok()).toBe(true);
    const preConsentPayload = await preConsentRun.json() as { errors?: string[]; seeded?: number; processed?: number; pendingConsent?: number };
    expect(preConsentPayload.errors ?? []).toEqual([]);

    let state = await findFollowUpStateForLead(buyerLead.id);
    if (!state && (preConsentPayload.seeded ?? 0) > 0) {
      const followUpRun = await page.request.post("/api/follow-ups/run", { headers: { Authorization: "Bearer e2e-cron-secret" } });
      expect(followUpRun.ok()).toBe(true);
      state = await findFollowUpStateForLead(buyerLead.id);
    }
    expect(state, JSON.stringify(preConsentPayload)).not.toBeNull();
    if (state!.status !== "pending_consent") {
      await admin
        .from("lead_follow_up_state")
        .update({ status: "scheduled", next_send_at: "1970-01-01T00:00:00.000Z" })
        .eq("id", state!.id)
        .eq("workspace_id", bot.workspace_id);

      const duePreConsentRun = await page.request.post("/api/follow-ups/run", { headers: { Authorization: "Bearer e2e-cron-secret" } });
      expect(duePreConsentRun.ok()).toBe(true);
    }

    state = await findFollowUpStateForLead(buyerLead.id);
    expect(state?.status).toBe("pending_consent");
    const missingConsentEvent = await findFollowUpEventForState(state!.id);
    expect(missingConsentEvent?.error_code).toBe("missing_explicit_email_consent");

    await page.goto(`/dashboard/leads/${buyerLead.id}`);
    await expect(page.getByRole("heading", { name: buyerName })).toBeVisible();
    await page.getByRole("button", { name: "Record consent attestation" }).click();
    await expect(page.getByText(/Consent status opted in/i)).toBeVisible();

    state = await findFollowUpStateForLead(buyerLead.id);
    expect(state).not.toBeNull();
    await admin
      .from("lead_follow_up_state")
      .update({ status: "scheduled", next_send_at: "1970-01-01T00:00:00.000Z" })
      .eq("id", state!.id)
      .eq("workspace_id", bot.workspace_id);

    const postConsentRun = await page.request.post("/api/follow-ups/run", { headers: { Authorization: "Bearer e2e-cron-secret" } });
    expect(postConsentRun.ok()).toBe(true);

    state = await findFollowUpStateForLead(buyerLead.id);
    expect(state?.status).toBe("skipped");

    const event = await findFollowUpEventForState(state!.id);
    expect(event?.status).toBe("skipped");
    expect(event?.error_code).toBe("follow_up_email_disabled");

    await page.goto("/dashboard/follow-ups");
    await expect(page.getByRole("heading", { name: "Email follow-up workflows" })).toBeVisible();
    await expect(page.getByText("Follow-up email delivery is disabled")).toBeVisible();
    await expect(page.getByText(/follow up email disabled/i).first()).toBeVisible();

    const unsubscribeToken = `phase7-token-${runId}-unsubscribe`;
    const { error: tokenError } = await admin
      .from("lead_email_preferences")
      .update({ unsubscribe_token_hash: hashToken(unsubscribeToken), status: "opted_in", consent_source: "dashboard", consent_text_version: "phase7-v1", consented_at: new Date().toISOString() })
      .eq("workspace_id", bot.workspace_id)
      .eq("email", buyerEmail);
    expect(tokenError).toBeNull();

    await page.goto(`/unsubscribe/${unsubscribeToken}`);
    await page.getByRole("button", { name: "Unsubscribe" }).click();
    await expect(page.getByText("No further automated follow-up emails")).toBeVisible();

    const preference = await findEmailPreference(bot.workspace_id, buyerEmail);
    expect(preference?.status).toBe("unsubscribed");

    const { data: anonSequences, error: anonSequenceError } = await anonClient().from("follow_up_sequences").select("id").eq("workspace_id", bot.workspace_id);
    const { data: anonPrefs, error: anonPrefsError } = await anonClient().from("lead_email_preferences").select("id").eq("workspace_id", bot.workspace_id);
    expect(anonSequenceError).toBeNull();
    expect(anonPrefsError).toBeNull();
    expect(anonSequences).toEqual([]);
    expect(anonPrefs).toEqual([]);

    await createConfirmedUser(outsiderEmail);
    const outsiderClient = await signInClient(outsiderEmail);
    const { data: hiddenStates, error: hiddenStateError } = await outsiderClient.from("lead_follow_up_state").select("id").eq("workspace_id", bot.workspace_id);
    expect(hiddenStateError).toBeNull();
    expect(hiddenStates).toEqual([]);

    const sequence = await findFirstFollowUpSequence(bot.id);
    const { data: deniedSequenceUpdate, error: deniedSequenceUpdateError } = await outsiderClient
      .from("follow_up_sequences")
      .update({ status: "paused" })
      .eq("id", sequence.id)
      .select("id, status");
    expect(deniedSequenceUpdateError).toBeNull();
    expect(deniedSequenceUpdate).toEqual([]);
  });
});

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


async function exerciseFollowUpDashboardControls(page: Page) {
  await page.goto("/dashboard/follow-ups");
  await expect(page.getByRole("heading", { name: "Email follow-up workflows" })).toBeVisible();
  await expect(page.getByText("Buyer follow-up when no appointment is booked")).toBeVisible();
  await expect(page.getByText("Seller valuation follow-up")).toBeVisible();
  await expect(page.getByText("Showing request follow-up")).toBeVisible();

  const sequenceForm = page.locator("form").filter({ has: page.getByRole("button", { name: /^Save$/ }) }).first();
  await sequenceForm.locator('select[name="status"]').selectOption("paused");
  await sequenceForm.getByRole("button", { name: /^Save$/ }).click();
  await expect(page.getByText("Follow-up settings saved.")).toBeVisible();

  const activeSequenceForm = page.locator("form").filter({ has: page.getByRole("button", { name: /^Save$/ }) }).first();
  await activeSequenceForm.locator('select[name="status"]').selectOption("active");
  await activeSequenceForm.getByRole("button", { name: /^Save$/ }).click();
  await expect(page.getByText("Follow-up settings saved.")).toBeVisible();

  const messageForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Save message" }) }).first();
  await messageForm.locator('input[name="delayMinutes"]').fill("0");
  await messageForm.locator('input[name="subjectTemplate"]').fill(`Phase7 follow up ${runId}`);
  await messageForm.getByRole("button", { name: "Save message" }).click();
  await expect(page.getByText("Follow-up settings saved.")).toBeVisible();
}

async function completeBuyerFlow(page: Page, slug: string, name: string, email: string) {
  await page.goto(`/c/${slug}`);
  await expect(page.getByText("Hosted real estate assistant")).toBeVisible();
  await page.getByRole("button", { name: "I want to buy" }).click();
  await sendChat(page, name);
  await sendChat(page, email);
  await sendChat(page, "River Heights");
  await sendChat(page, "800k");
  await sendChat(page, "within 1 month");
  await sendChat(page, "house");
  await sendChat(page, "yes");
  await expect(page.getByText("I saved this buyer request")).toBeVisible();
}

async function sendChat(page: Page, message: string) {
  await page.getByPlaceholder("Type your answer...").fill(message);
  await page.getByRole("button", { name: "Send" }).click();
}

async function newPublicPage(browser: Browser) {
  const context = await browser.newContext();
  return context.newPage();
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

async function findBotBySlug(slug: string) {
  const { data, error } = await admin.from("bots").select("id, workspace_id, slug").eq("slug", slug).single();
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  return data as { id: string; workspace_id: string; slug: string };
}

async function setFollowUpDelaysToZero(botId: string) {
  const { data: sequences, error } = await admin.from("follow_up_sequences").select("id").eq("bot_id", botId);
  expect(error).toBeNull();
  const ids = (sequences ?? []).map((sequence) => sequence.id);
  expect(ids.length).toBeGreaterThan(0);
  const { error: sequenceError } = await admin.from("follow_up_sequences").update({ status: "active" }).eq("bot_id", botId);
  expect(sequenceError).toBeNull();
  const { error: updateError } = await admin.from("follow_up_messages").update({ delay_minutes: 0, status: "active" }).in("sequence_id", ids);
  expect(updateError).toBeNull();
}


async function findFirstFollowUpSequence(botId: string) {
  const { data, error } = await admin.from("follow_up_sequences").select("id, status").eq("bot_id", botId).limit(1).single();
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  return data as { id: string; status: string };
}

async function findLeadByEmail(email: string) {
  const { data, error } = await admin.from("leads").select("id, workspace_id, conversation_id, status, score").eq("email", email).single();
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  return data as { id: string; workspace_id: string; conversation_id: string; status: string; score: number };
}

async function findFollowUpStateForLead(leadId: string) {
  const { data, error } = await admin
    .from("lead_follow_up_state")
    .select("id, workspace_id, lead_id, status")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  expect(error).toBeNull();
  return data as { id: string; workspace_id: string; lead_id: string; status: string } | null;
}

async function findFollowUpEventForState(stateId: string) {
  const { data, error } = await admin
    .from("notification_events")
    .select("id, status, error_code")
    .eq("follow_up_state_id", stateId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  expect(error).toBeNull();
  return data as { id: string; status: string; error_code: string | null } | null;
}

async function findEmailPreference(workspaceId: string, email: string) {
  const { data, error } = await admin.from("lead_email_preferences").select("id, status").eq("workspace_id", workspaceId).eq("email", email).maybeSingle();
  expect(error).toBeNull();
  return data as { id: string; status: string } | null;
}

async function cleanupUser(email: string) {
  const user = await findAuthUser(email);
  if (!user) return;
  await admin.from("workspaces").delete().eq("created_by", user.id);
  await admin.auth.admin.deleteUser(user.id);
}

async function findAuthUser(email: string): Promise<User | null> {
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    expect(error).toBeNull();
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 1000) return null;
    page += 1;
  }
}

function uniqueEmail(prefix: string) {
  const email = `${prefix}-${runId}@example.com`;
  createdEmails.add(email);
  return email;
}

function hashToken(token: string) {
  return createHash("sha256").update(token.trim()).digest("hex");
}

function loadDotEnv(fileName: string) {
  const envPath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    if (!process.env[key]) process.env[key] = rawValue.replace(/^['\"]|['\"]$/g, "");
  }
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
