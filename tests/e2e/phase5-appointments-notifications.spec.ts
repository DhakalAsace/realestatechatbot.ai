import { expect, test, type Browser, type Page } from "@playwright/test";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import { createClient, type User } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import ws from "ws";

loadDotEnv(".env.local");

const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabasePublishableKey = requireAnyEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY");
const supabaseSecretKey = requireEnv("SUPABASE_SECRET_KEY");
const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const password = `Phase5-${runId}!`;
const createdEmails = new Set<string>();
const webSocketTransport = ws as unknown as WebSocketLikeConstructor;

const admin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: webSocketTransport },
});

test.describe.serial("Phase 5 appointments and notifications", () => {
  test.afterAll(async () => {
    for (const email of createdEmails) {
      await cleanupUser(email);
    }
  });

  test("hosted chat captures appointment requests and dashboard/RLS show the durable records", async ({ browser, page }) => {
    const ownerEmail = uniqueEmail("phase5-owner");
    const otherEmail = uniqueEmail("phase5-other");
    const slug = `e2e-phase5-${runId}`;
    const buyerName = `Phase5 Buyer ${runId}`;
    const buyerEmail = `buyer-${runId}@example.com`;
    const sellerEmail = `seller-${runId}@example.com`;

    await createAccountThroughUi(page, ownerEmail);
    await completeOnboarding(page, {
      agentName: `Phase5 Agent ${runId}`,
      brokerage: `Phase5 Realty ${runId}`,
      email: `agent-${runId}@example.com`,
      phone: "+1 204 555 0195",
      city: "Winnipeg",
      serviceAreas: "Winnipeg, River Heights, St. Vital",
      slug,
    });

    const bot = await findBotBySlug(slug);
    await page.goto(`/dashboard/bots/${bot.id}`);
    await page.getByLabel("Bot calendar URL").fill("https://calendly.com/phase5-bot/intro");
    await page.getByLabel("Agent fallback calendar URL").fill("https://calendly.com/phase5-agent/intro");
    await page.getByRole("button", { name: "Save bot" }).click();
    await expect(page.getByText("Bot saved.")).toBeVisible();

    const buyerPage = await newPublicPage(browser);
    await completeBuyerFlow(buyerPage, slug, buyerName, buyerEmail);
    await sendChat(buyerPage, "book a consultation tomorrow afternoon");
    await expect(buyerPage.getByText(/saved the buyer consultation request/i)).toBeVisible();
    await sendChat(buyerPage, "Can I schedule a showing this weekend?");
    await expect(buyerPage.getByText(/saved the showing request/i)).toBeVisible();
    await buyerPage.close();

    const sellerPage = await newPublicPage(browser);
    await completeSellerFlowWithValuationAppointment(sellerPage, slug, sellerEmail);
    await sellerPage.close();

    const buyerLead = await findLeadByEmail(buyerEmail);
    const appointments = await findAppointmentsForLead(buyerLead.id);
    expect(appointments.map((appointment) => appointment.request_type).sort()).toEqual(["buyer_consultation", "showing"]);
    expect(appointments.every((appointment) => appointment.calendar_url === "https://calendly.com/phase5-bot/intro")).toBe(true);

    const sellerLead = await findLeadByEmail(sellerEmail);
    const sellerAppointments = await findAppointmentsForLead(sellerLead.id);
    expect(sellerAppointments).toHaveLength(1);
    expect(sellerAppointments[0].request_type).toBe("seller_valuation");

    const { data: notificationEvents, error: notificationError } = await admin
      .from("notification_events")
      .select("id, status, error_code, appointment_id")
      .in("appointment_id", appointments.map((appointment) => appointment.id));
    expect(notificationError).toBeNull();
    expect(notificationEvents?.length).toBeGreaterThanOrEqual(2);
    expect(notificationEvents?.every((event) => event.status === "skipped" && event.error_code === "missing_resend_api_key")).toBe(true);

    await page.goto("/dashboard/appointments");
    await expect(page.getByRole("heading", { name: "Appointment requests" })).toBeVisible();
    await expect(page.getByText(buyerName).first()).toBeVisible();
    await expect(page.getByText(/Skipped: missing resend api key/i).first()).toBeVisible();
    await page.getByLabel("Status").first().selectOption("acknowledged");
    await page.getByLabel("Agent notes").first().fill("Called and left voicemail.");
    await page.getByRole("button", { name: "Save appointment" }).first().click();
    await expect(page.getByText("Appointment saved.")).toBeVisible();

    await page.goto(`/dashboard/leads/${buyerLead.id}`);
    await expect(page.getByRole("heading", { name: "Appointments" })).toBeVisible();
    await expect(page.getByText("buyer consultation", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("showing", { exact: true }).first()).toBeVisible();

    const { data: anonAppointments, error: anonAppointmentsError } = await anonClient().from("appointments").select("id");
    const { data: anonNotifications, error: anonNotificationsError } = await anonClient().from("notification_events").select("id");
    expect(anonAppointmentsError).toBeNull();
    expect(anonNotificationsError).toBeNull();
    expect(anonAppointments).toEqual([]);
    expect(anonNotifications).toEqual([]);

    await createConfirmedUser(otherEmail);
    const otherClient = await signInClient(otherEmail);
    const { data: hiddenAppointments, error: hiddenAppointmentsError } = await otherClient.from("appointments").select("id").eq("workspace_id", bot.workspace_id);
    const { data: hiddenNotifications, error: hiddenNotificationsError } = await otherClient.from("notification_events").select("id").eq("workspace_id", bot.workspace_id);
    expect(hiddenAppointmentsError).toBeNull();
    expect(hiddenNotificationsError).toBeNull();
    expect(hiddenAppointments).toEqual([]);
    expect(hiddenNotifications).toEqual([]);
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

async function completeBuyerFlow(page: Page, slug: string, name: string, email: string) {
  await page.goto(`/c/${slug}`);
  await expect(page.getByText("Hosted real estate assistant")).toBeVisible();
  await page.getByRole("button", { name: "I want to buy" }).click();
  await expect(page.getByText("What is your name?")).toBeVisible();
  await sendChat(page, name);
  await expect(page.getByText("best email or phone")).toBeVisible();
  await sendChat(page, email);
  await expect(page.getByText("Which city or neighbourhood")).toBeVisible();
  await sendChat(page, "River Heights");
  await expect(page.getByText("What budget range")).toBeVisible();
  await sendChat(page, "800k");
  await expect(page.getByText("ideal timeline")).toBeVisible();
  await sendChat(page, "within 1 month");
  await expect(page.getByText("What property type")).toBeVisible();
  await sendChat(page, "house");
  await expect(page.getByText("pre-approved")).toBeVisible();
  await sendChat(page, "yes");
  await expect(page.getByText("I saved this buyer request")).toBeVisible();
}

async function completeSellerFlowWithValuationAppointment(page: Page, slug: string, email: string) {
  await page.goto(`/c/${slug}`);
  await page.getByRole("button", { name: "I want to sell" }).click();
  await expect(page.getByText("What is your name?")).toBeVisible();
  await sendChat(page, `Phase5 Seller ${runId}`);
  await sendChat(page, email);
  await sendChat(page, "St. Vital");
  await sendChat(page, "in 2 months");
  await expect(page.getByText("valuation or pricing opinion")).toBeVisible();
  await sendChat(page, "yes tomorrow morning");
  await expect(page.getByText(/saved the seller valuation request/i)).toBeVisible();
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

async function findLeadByEmail(email: string) {
  const { data, error } = await admin.from("leads").select("id, workspace_id, conversation_id, status, score").eq("email", email).single();
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  return data as { id: string; workspace_id: string; conversation_id: string; status: string; score: number };
}

async function findAppointmentsForLead(leadId: string) {
  const { data, error } = await admin
    .from("appointments")
    .select("id, workspace_id, request_type, status, preferred_time_text, calendar_url")
    .eq("lead_id", leadId)
    .order("requested_at", { ascending: true });
  expect(error).toBeNull();
  return (data ?? []) as Array<{ id: string; workspace_id: string; request_type: string; status: string; preferred_time_text: string; calendar_url: string | null }>;
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

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function requireAnyEnv(...names: string[]) {
  for (const name of names) {
    if (process.env[name]) return process.env[name];
  }
  throw new Error(`Missing one of ${names.join(", ")}`);
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
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
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
