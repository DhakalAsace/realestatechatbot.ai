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
const password = `Phase1-${runId}!`;
const createdEmails = new Set<string>();
const webSocketTransport = ws as unknown as WebSocketLikeConstructor;

const admin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  realtime: {
    transport: webSocketTransport,
  },
});

test.describe.serial("Phase 1 hosted chatbot", () => {
  test.afterAll(async () => {
    for (const email of createdEmails) {
      await cleanupUser(email);
    }
  });

  test("logged-out users cannot access the dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  });

  test("default workspace, hosted buyer/seller flows, lead inbox, RLS, invalid contact, and invalid slug", async ({ browser, page }) => {
    const email = uniqueEmail("owner");
    const slug = `e2e-sarah-${runId}`;
    const buyerName = `Buyer ${runId}`;
    const buyerEmail = uniqueEmail("buyer");
    const sellerName = `Seller ${runId}`;
    const sellerEmail = uniqueEmail("seller");
    const invalidName = `Invalid Contact ${runId}`;

    await createAccountThroughUi(page, email);
    await completeOnboarding(page, {
      agentName: `Agent ${runId}`,
      brokerage: `Northline ${runId}`,
      email: `agent-${runId}@example.com`,
      phone: "+1 204 555 0199",
      city: "Winnipeg",
      serviceAreas: "Winnipeg, River Heights, St. Vital",
      slug,
    });

    await expect(page.getByRole("heading", { name: `Northline ${runId}` })).toBeVisible();
    await expect(page.getByText(`/c/${slug}`)).toBeVisible();

    const buyerPage = await newPublicPage(browser);
    await completeBuyerFlow(buyerPage, slug, buyerName, buyerEmail);
    await buyerPage.close();

    const sellerPage = await newPublicPage(browser);
    await completeSellerFlow(sellerPage, slug, sellerName, sellerEmail);
    await sellerPage.close();

    await page.goto("/dashboard/leads");
    await expect(page.getByText(buyerName)).toBeVisible();
    await expect(page.getByText(sellerName)).toBeVisible();
    await expect(page.getByText("Score 100").first()).toBeVisible();

    await page.getByText(buyerName).click();
    await expect(page.getByRole("heading", { name: buyerName })).toBeVisible();
    await expect(page.getByText(buyerEmail).first()).toBeVisible();
    await expect(page.getByText("within 1 month").first()).toBeVisible();
    await expect(page.getByText("pre-approved").first()).toBeVisible();

    const buyerLead = await findLeadByEmail(buyerEmail);
    const sellerLead = await findLeadByEmail(sellerEmail);
    expect(buyerLead.status).toBe("qualified");
    expect(buyerLead.score).toBe(100);
    expect(sellerLead.status).toBe("qualified");
    expect(sellerLead.score).toBe(100);

    const { count: messageCount, error: messageError } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", [buyerLead.conversation_id, sellerLead.conversation_id]);
    expect(messageError).toBeNull();
    expect(messageCount).toBeGreaterThanOrEqual(20);

    const otherEmail = uniqueEmail("other");
    await createConfirmedUser(otherEmail);
    const otherClient = await signInClient(otherEmail);
    const { data: hiddenLeads, error: hiddenLeadsError } = await otherClient.from("leads").select("id").eq("id", buyerLead.id);
    expect(hiddenLeadsError).toBeNull();
    expect(hiddenLeads).toEqual([]);

    const invalidPage = await newPublicPage(browser);
    await invalidPage.goto(`/c/${slug}`);
    await invalidPage.getByRole("button", { name: "I want to buy" }).click();
    await expect(invalidPage.getByText("What is your name?")).toBeVisible();
    await sendChat(invalidPage, invalidName);
    await expect(invalidPage.getByText("best email or phone")).toBeVisible();
    await sendChat(invalidPage, "not-contact-info");
    await expect(invalidPage.getByText("Please share an email or phone number")).toBeVisible();
    await invalidPage.close();

    const { count: invalidLeadCount, error: invalidLeadError } = await admin
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("name", invalidName);
    expect(invalidLeadError).toBeNull();
    expect(invalidLeadCount).toBe(0);

    await page.goto(`/c/no-such-slug-${runId}`);
    await expect(page.getByText(/not found|could not be found/i)).toBeVisible();
  });

  test("duplicate hosted slug shows a clear error and leaves no partial workspace", async ({ page }) => {
    const firstEmail = uniqueEmail("dupe-first");
    const secondEmail = uniqueEmail("dupe-second");
    const slug = `e2e-dupe-${runId}`;

    await createAccountThroughUi(page, firstEmail);
    await completeOnboarding(page, {
      agentName: `Dupe Owner ${runId}`,
      brokerage: `Dupe Realty ${runId}`,
      email: `dupe-agent-${runId}@example.com`,
      phone: "+1 204 555 0101",
      city: "Winnipeg",
      serviceAreas: "Winnipeg",
      slug,
    });
    await expect(page.getByText(`/c/${slug}`)).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await createAccountThroughUi(page, secondEmail);
    await submitOnboarding(page, {
      agentName: `Dupe Second ${runId}`,
      brokerage: `Dupe Second Realty ${runId}`,
      email: `dupe-second-agent-${runId}@example.com`,
      phone: "+1 204 555 0102",
      city: "Winnipeg",
      serviceAreas: "Winnipeg",
      slug,
    });

    await expect(page.getByText(`/${slug} is already taken`)).toBeVisible();

    const secondUser = await findAuthUser(secondEmail);
    expect(secondUser).not.toBeNull();

    const { count, error } = await admin
      .from("workspaces")
      .select("id", { count: "exact", head: true })
      .eq("created_by", secondUser!.id);
    expect(error).toBeNull();
    expect(count).toBe(0);
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
  await submitOnboarding(page, data);
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function submitOnboarding(page: Page, data: OnboardingData) {
  await expect(page.getByRole("heading", { name: "Set up the sample agent bot" })).toBeVisible();
  await page.getByLabel("Agent name").fill(data.agentName);
  await page.getByLabel("Brokerage").fill(data.brokerage);
  await page.getByLabel("Email").fill(data.email);
  await page.getByLabel("Phone").fill(data.phone);
  await page.getByLabel("City").fill(data.city);
  await page.getByLabel("Hosted slug").fill(data.slug);
  await page.getByLabel("Service areas").fill(data.serviceAreas);
  await page.getByRole("button", { name: "Create workspace and bot" }).click();
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
  await sendChat(page, "Winnipeg");
  await expect(page.getByText("What budget range")).toBeVisible();
  await sendChat(page, "1 million");
  await expect(page.getByText("ideal timeline")).toBeVisible();
  await sendChat(page, "within 1 month");
  await expect(page.getByText("What property type")).toBeVisible();
  await sendChat(page, "house");
  await expect(page.getByText("pre-approved")).toBeVisible();
  await sendChat(page, "yes");
  await expect(page.getByText("I saved this buyer request")).toBeVisible();
}

async function completeSellerFlow(page: Page, slug: string, name: string, email: string) {
  await page.goto(`/c/${slug}`);
  await expect(page.getByText("Hosted real estate assistant")).toBeVisible();
  await page.getByRole("button", { name: "I want to sell" }).click();
  await expect(page.getByText("What is your name?")).toBeVisible();
  await sendChat(page, name);
  await expect(page.getByText("best email or phone")).toBeVisible();
  await sendChat(page, email);
  await expect(page.getByText("property address or neighbourhood")).toBeVisible();
  await sendChat(page, "River Heights");
  await expect(page.getByText("When are you hoping to sell?")).toBeVisible();
  await sendChat(page, "within 2 months");
  await expect(page.getByText(/valuation or pricing opinion/i)).toBeVisible();
  await sendChat(page, "yes");
  await expect(page.getByText("I saved this seller request")).toBeVisible();
}

async function sendChat(page: Page, message: string) {
  await page.getByPlaceholder("Type your answer...").fill(message);
  await page.getByRole("button", { name: "Send" }).click();
}

async function newPublicPage(browser: Browser) {
  const context = await browser.newContext();
  return context.newPage();
}

async function createConfirmedUser(email: string) {
  createdEmails.add(email);
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  } as never);
  expect(error).toBeNull();
}

async function signInClient(email: string) {
  const client = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      transport: webSocketTransport,
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  expect(error).toBeNull();
  return client;
}

async function findLeadByEmail(email: string) {
  const { data, error } = await admin
    .from("leads")
    .select("id, conversation_id, status, score")
    .eq("email", email)
    .single();
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  return data as { id: string; conversation_id: string; status: string; score: number };
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
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
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
