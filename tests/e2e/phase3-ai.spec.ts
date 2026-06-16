import { expect, test, type Browser, type Page } from "@playwright/test";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import { createClient, type User } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import ws from "ws";

loadDotEnv(".env.local");

const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabaseSecretKey = requireEnv("SUPABASE_SECRET_KEY");
const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const password = `Phase3-${runId}!`;
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

test.describe.serial("Phase 3 AI runtime contract", () => {
  test.afterAll(async () => {
    for (const email of createdEmails) {
      await cleanupUser(email);
    }
  });

  test("AI-enabled hosted chat keeps deterministic persistence and records fallback metadata in test mode", async ({ browser, page }) => {
    const ownerEmail = uniqueEmail("phase3-owner");
    const slug = `e2e-phase3-${runId}`;
    const buyerName = `AI Buyer ${runId}`;
    const buyerEmail = uniqueEmail("phase3-buyer");

    await createAccountThroughUi(page, ownerEmail);
    await completeOnboarding(page, {
      agentName: `Phase3 Agent ${runId}`,
      brokerage: `Phase3 Realty ${runId}`,
      email: `agent-${runId}@example.com`,
      phone: "+1 204 555 0193",
      city: "Winnipeg",
      serviceAreas: "Winnipeg, River Heights",
      slug,
    });

    const bot = await findBotBySlug(slug);
    await page.goto(`/dashboard/bots/${bot.id}`);
    const aiToggle = page.getByLabel("AI-assisted replies");
    await expect(aiToggle).toBeVisible();
    await aiToggle.check();
    await page.getByRole("button", { name: "Save bot" }).click();
    await expect(page.getByText("Bot saved.")).toBeVisible();

    const publicPage = await newPublicPage(browser);
    await completeBuyerFlow(publicPage, slug, buyerName, buyerEmail);
    await publicPage.close();

    const lead = await findLeadByEmail(buyerEmail);
    expect(lead.status).toBe("qualified");
    expect(lead.score).toBe(100);

    const { data: botMessages, error: messageError } = await admin
      .from("messages")
      .select("content_json")
      .eq("conversation_id", lead.conversation_id)
      .eq("sender_type", "bot")
      .order("created_at", { ascending: false })
      .limit(1);

    expect(messageError).toBeNull();
    expect(botMessages?.[0]?.content_json).toMatchObject({
      phase: 3,
      ai: {
        enabled: true,
        mode: "deterministic_fallback",
        fallbackReason: "disabled_by_env",
        model: "gpt-5.5",
      },
    });
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

async function sendChat(page: Page, message: string) {
  await page.getByPlaceholder("Type your answer...").fill(message);
  await page.getByRole("button", { name: "Send" }).click();
}

async function newPublicPage(browser: Browser) {
  const context = await browser.newContext();
  return context.newPage();
}

async function findBotBySlug(slug: string) {
  const { data, error } = await admin.from("bots").select("id, slug").eq("slug", slug).single();
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  return data as { id: string; slug: string };
}

async function findLeadByEmail(email: string) {
  const { data, error } = await admin.from("leads").select("id, conversation_id, status, score").eq("email", email).single();
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
