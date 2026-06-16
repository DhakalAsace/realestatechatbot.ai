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
const password = `Phase4-${runId}!`;
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

test.describe.serial("Phase 4 properties and knowledge", () => {
  test.afterAll(async () => {
    for (const email of createdEmails) {
      await cleanupUser(email);
    }
  });

  test("dashboard library grounds public chat cards and knowledge answers", async ({ browser, page }) => {
    const ownerEmail = uniqueEmail("phase4-owner");
    const otherEmail = uniqueEmail("phase4-other");
    const slug = `e2e-phase4-${runId}`;
    const propertyTitle = `River Heights family house ${runId}`;
    const archivedTitle = `Archived condo ${runId}`;
    const knowledgeAnswer = `Sarah serves Winnipeg, River Heights, and St. Vital for buyer and seller clients. Ref ${runId}.`;

    await createAccountThroughUi(page, ownerEmail);
    await completeOnboarding(page, {
      agentName: `Phase4 Agent ${runId}`,
      brokerage: `Phase4 Realty ${runId}`,
      email: `agent-${runId}@example.com`,
      phone: "+1 204 555 0194",
      city: "Winnipeg",
      serviceAreas: "Winnipeg, River Heights, St. Vital",
      slug,
    });

    const bot = await findBotBySlug(slug);

    await page.goto("/dashboard/properties");
    await expect(page.getByRole("heading", { name: "Controlled property library" })).toBeVisible();
    await page.getByLabel("Property title").fill(propertyTitle);
    await page.getByLabel("Property type").fill("house");
    await page.getByLabel("Price").fill("780000");
    await page.getByLabel("Area").fill("River Heights");
    await page.getByLabel("City").fill("Winnipeg");
    await page.getByLabel("Bedrooms").fill("4");
    await page.getByLabel("Bathrooms").fill("2.5");
    await page.getByLabel("Listing URL").fill("https://example.com/river-heights-house");
    await page.getByLabel("Description").fill("Updated house near parks with a finished basement.");
    await page.getByLabel("Highlights").fill("finished basement, garage, near parks");
    await page.getByRole("button", { name: "Add property" }).click();
    await expect(page.getByText("Property added.")).toBeVisible();
    await expect(page.getByRole("heading", { name: propertyTitle })).toBeVisible();

    const { error: archivedError } = await admin.from("properties").insert({
      workspace_id: bot.workspace_id,
      bot_id: bot.id,
      status: "archived",
      title: archivedTitle,
      property_type: "condo",
      price: 300000,
      city: "Winnipeg",
      area: "River Heights",
      description: "Archived property should not be shown.",
    });
    expect(archivedError).toBeNull();

    await page.goto("/dashboard/knowledge");
    await expect(page.getByRole("heading", { name: "Controlled FAQ and notes" })).toBeVisible();
    await page.getByLabel("Knowledge title").fill(`Service areas ${runId}`);
    await page.getByLabel("Question").fill("Which areas do you serve?");
    await page.getByLabel("Answer").fill(knowledgeAnswer);
    await page.getByLabel("Tags").fill("areas, service");
    await page.getByRole("button", { name: "Add knowledge" }).click();
    await expect(page.getByText("Knowledge added.")).toBeVisible();

    const propertyPage = await newPublicPage(browser);
    await propertyPage.goto(`/c/${slug}`);
    await sendChat(propertyPage, "I want to buy River Heights houses");
    await expect(propertyPage.getByText(/agent-provided propert/i)).toBeVisible();
    await expect(propertyPage.getByText(propertyTitle)).toBeVisible();
    await expect(propertyPage.getByText("$780,000")).toBeVisible();
    await expect(propertyPage.getByText(archivedTitle)).toHaveCount(0);
    await propertyPage.close();

    const unknownPage = await newPublicPage(browser);
    await unknownPage.goto(`/c/${slug}`);
    await sendChat(unknownPage, "I want to buy Mars castle listings");
    await expect(unknownPage.getByText(/do not have a matching agent-provided property/i)).toBeVisible();
    await expect(unknownPage.getByText(propertyTitle)).toHaveCount(0);
    await unknownPage.close();

    const knowledgePage = await newPublicPage(browser);
    await knowledgePage.goto(`/c/${slug}`);
    await sendChat(knowledgePage, "Which areas do you serve?");
    await expect(knowledgePage.getByText(knowledgeAnswer)).toBeVisible();
    await knowledgePage.close();

    const anonClient = createClient(supabaseUrl, supabasePublishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: { transport: webSocketTransport },
    });
    const { data: anonProperties, error: anonPropertiesError } = await anonClient.from("properties").select("id");
    const { data: anonKnowledge, error: anonKnowledgeError } = await anonClient.from("knowledge_documents").select("id");
    expect(anonPropertiesError).toBeNull();
    expect(anonKnowledgeError).toBeNull();
    expect(anonProperties).toEqual([]);
    expect(anonKnowledge).toEqual([]);

    await createConfirmedUser(otherEmail);
    const otherClient = await signInClient(otherEmail);
    const { data: hiddenProperties, error: hiddenPropertiesError } = await otherClient.from("properties").select("id").eq("workspace_id", bot.workspace_id);
    const { data: hiddenKnowledge, error: hiddenKnowledgeError } = await otherClient.from("knowledge_documents").select("id").eq("workspace_id", bot.workspace_id);
    expect(hiddenPropertiesError).toBeNull();
    expect(hiddenKnowledgeError).toBeNull();
    expect(hiddenProperties).toEqual([]);
    expect(hiddenKnowledge).toEqual([]);
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

async function findBotBySlug(slug: string) {
  const { data, error } = await admin.from("bots").select("id, workspace_id, slug").eq("slug", slug).single();
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  return data as { id: string; workspace_id: string; slug: string };
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
