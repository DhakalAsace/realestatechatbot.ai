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
const password = `Phase2-${runId}!`;
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

test.describe.serial("Phase 2 channel attribution", () => {
  test.afterAll(async () => {
    for (const email of createdEmails) {
      await cleanupUser(email);
    }
  });

  test("channels create protected share surfaces and attribute campaign/widget leads", async ({ browser, page }) => {
    const ownerEmail = uniqueEmail("phase2-owner");
    const slug = `e2e-phase2-${runId}`;
    const campaignLabel = `Instagram campaign ${runId}`;
    const widgetLabel = `Website widget ${runId}`;
    const qrLabel = `Open house QR ${runId}`;
    const buyerName = `Channel Buyer ${runId}`;
    const buyerEmail = uniqueEmail("phase2-buyer");
    const sellerName = `Widget Seller ${runId}`;
    const sellerEmail = uniqueEmail("phase2-seller");

    await createAccountThroughUi(page, ownerEmail);
    await completeOnboarding(page, {
      agentName: `Phase2 Agent ${runId}`,
      brokerage: `Phase2 Realty ${runId}`,
      email: `agent-${runId}@example.com`,
      phone: "+1 204 555 0188",
      city: "Winnipeg",
      serviceAreas: "Winnipeg, River Heights",
      slug,
    });

    await createChannelThroughUi(page, {
      label: campaignLabel,
      type: "campaign",
      source: "instagram",
      medium: "social",
      campaign: "spring-launch",
      content: "bio-link",
    });

    const campaignChannel = await findChannelByLabel(campaignLabel);
    const buyerPage = await newPublicPage(browser);
    await completeBuyerFlowAtPath(
      buyerPage,
      `/c/${slug}?ch=${campaignChannel.public_key}&utm_source=google&utm_medium=cpc&utm_campaign=ppc&utm_content=ad1&utm_term=duplex`,
      buyerName,
      buyerEmail,
    );
    await buyerPage.close();

    await page.goto("/dashboard/channels");
    await page.getByLabel("New channel label").fill(`No origins widget ${runId}`);
    await page.getByLabel("New channel type").selectOption("web_embed");
    await page.getByLabel("New source").fill("website");
    await page.getByLabel("New medium").fill("widget");
    await page.getByRole("button", { name: "Create channel" }).click();
    await expect(page.getByText("Website widget channels need at least one allowed origin.")).toBeVisible();

    const appOrigin = new URL(page.url()).origin;
    await createChannelThroughUi(page, {
      label: widgetLabel,
      type: "web_embed",
      source: "website",
      medium: "widget",
      campaign: "main-site",
      content: "floating-button",
      allowedOrigins: `https://agent.example, ${appOrigin}`,
    });

    const widgetChannel = await findChannelByLabel(widgetLabel);
    const { data: noOriginWidget, error: noOriginWidgetError } = await admin
      .from("bot_channels")
      .insert({
        workspace_id: campaignChannel.workspace_id,
        bot_id: campaignChannel.bot_id,
        type: "web_embed",
        status: "active",
        label: `No origin widget row ${runId}`,
        source: "website",
        medium: "widget",
        allowed_origins: [],
      })
      .select("id, public_key")
      .single();
    expect(noOriginWidgetError).toBeNull();
    const noOriginWidgetScript = await page.request.get(`/widget.js?channel=${noOriginWidget!.public_key}`, {
      headers: { referer: "https://agent.example/landing" },
    });
    expect(noOriginWidgetScript.status()).toBe(403);

    const sibling = await createSiblingBotChannel(campaignChannel.workspace_id);
    const swappedResponse = await page.request.post("/api/chat", {
      data: { slug, channelKey: sibling.channelKey, message: "I want to buy", sourceUrl: "https://agent.example/swap-test" },
    });
    expect(swappedResponse.status()).toBe(404);
    expect(await swappedResponse.json()).toEqual({ error: "This bot is not available." });

    const { error: draftError } = await admin.from("bots").update({ status: "draft" }).eq("id", sibling.botId);
    expect(draftError).toBeNull();
    const draftBotResponse = await page.request.post("/api/chat", {
      data: { slug: sibling.botSlug, channelKey: sibling.channelKey, message: "I want to buy", sourceUrl: "https://agent.example/draft-test" },
    });
    expect(draftBotResponse.status()).toBe(404);
    expect(await draftBotResponse.json()).toEqual({ error: "This bot is not available." });

    const blockedWidgetScript = await page.request.get(`/widget.js?channel=${widgetChannel.public_key}`, {
      headers: { referer: "https://evil.example/landing" },
    });
    expect(blockedWidgetScript.status()).toBe(403);

    const widgetScript = await page.request.get(`/widget.js?channel=${widgetChannel.public_key}`, {
      headers: { referer: "https://agent.example/landing" },
    });
    expect(widgetScript.ok()).toBe(true);
    const widgetScriptText = await widgetScript.text();
    expect(widgetScriptText).toContain('"/embed/"');
    expect(widgetScriptText).toContain(widgetChannel.public_key);
    expect(widgetScriptText).toContain("#163f2f");
    const widgetToken = extractWidgetToken(widgetScriptText);

    const noTokenResponse = await page.request.post("/api/chat", {
      data: { slug, channelKey: widgetChannel.public_key, message: "I want to sell", sourceUrl: "https://agent.example/landing" },
    });
    expect(noTokenResponse.status()).toBe(403);

    const badSourceResponse = await page.request.post("/api/chat", {
      data: { slug, channelKey: widgetChannel.public_key, widgetToken, message: "I want to sell", sourceUrl: "https://evil.example/landing" },
    });
    expect(badSourceResponse.status()).toBe(403);

    const directEmbedPage = await newPublicPage(browser);
    await directEmbedPage.goto(`/embed/${widgetChannel.public_key}?parentUrl=https%3A%2F%2Fagent.example%2Flanding`);
    await expect(directEmbedPage.getByText(/not found|could not be found/i)).toBeVisible();
    await directEmbedPage.close();

    const widgetPage = await newPublicPage(browser);
    await widgetPage.goto("/");
    await widgetPage.addScriptTag({ url: `/widget.js?channel=${widgetChannel.public_key}` });
    await expect(widgetPage.getByRole("button", { name: "Open real estate chat" })).toBeVisible();
    await widgetPage.getByRole("button", { name: "Open real estate chat" }).click();
    await expect(widgetPage.frameLocator('iframe[title="Real estate chat assistant"]').getByText("Hosted real estate assistant")).toBeVisible();
    await widgetPage.close();

    const sellerPage = await newPublicPage(browser);
    await completeSellerFlowAtPath(
      sellerPage,
      `/embed/${widgetChannel.public_key}?token=${encodeURIComponent(widgetToken)}&parentUrl=https%3A%2F%2Fagent.example%2Flanding&utm_source=agent-site&utm_medium=widget&utm_campaign=landing`,
      sellerName,
      sellerEmail,
    );
    await sellerPage.close();

    await createChannelThroughUi(page, {
      label: qrLabel,
      type: "qr_code",
      source: "open-house",
      medium: "qr",
      campaign: "weekend-open-house",
    });

    const qrChannel = await findChannelByLabel(qrLabel);
    const qrResponse = await page.request.get(`/api/channels/${qrChannel.id}/qr.svg`);
    expect(qrResponse.ok()).toBe(true);
    expect(await qrResponse.text()).toContain("<svg");

    const { error: draftQrBotError } = await admin.from("bots").update({ status: "draft" }).eq("id", qrChannel.bot_id);
    expect(draftQrBotError).toBeNull();
    const inactiveBotQrResponse = await page.request.get(`/api/channels/${qrChannel.id}/qr.svg`);
    expect(inactiveBotQrResponse.status()).toBe(404);
    const { error: reactivateQrBotError } = await admin.from("bots").update({ status: "active" }).eq("id", qrChannel.bot_id);
    expect(reactivateQrBotError).toBeNull();

    const nonQrResponse = await page.request.get(`/api/channels/${campaignChannel.id}/qr.svg`);
    expect(nonQrResponse.status()).toBe(404);

    const { error: disableError } = await admin.from("bot_channels").update({ status: "disabled" }).eq("id", qrChannel.id);
    expect(disableError).toBeNull();
    const disabledQrResponse = await page.request.get(`/api/channels/${qrChannel.id}/qr.svg`);
    expect(disabledQrResponse.status()).toBe(404);
    const disabledResponse = await page.request.post("/api/chat", {
      data: { slug, channelKey: qrChannel.public_key, message: "I want to buy a home" },
    });
    expect(disabledResponse.status()).toBe(404);
    expect(await disabledResponse.json()).toEqual({ error: "This channel is not available." });

    const { error: disableHostedError } = await admin
      .from("bot_channels")
      .update({ status: "disabled" })
      .eq("workspace_id", campaignChannel.workspace_id)
      .eq("bot_id", campaignChannel.bot_id)
      .eq("type", "hosted_link");
    expect(disableHostedError).toBeNull();

    await page.goto("/dashboard/channels");
    await expect(page.getByText("No active hosted link")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open default link" })).toHaveCount(0);
    const disabledQrCard = page.locator("article").filter({ has: page.getByRole("heading", { name: qrLabel }) });
    await expect(disabledQrCard.getByText("QR actions are inactive until this channel is enabled.")).toBeVisible();
    await expect(disabledQrCard.getByRole("link", { name: "Open link" })).toHaveCount(0);
    await expect(disabledQrCard.getByRole("link", { name: "Download SVG" })).toHaveCount(0);
    await expect(disabledQrCard.getByRole("link", { name: "Open SVG" })).toHaveCount(0);

    const buyerLead = await findLeadByEmail(buyerEmail);
    expect(buyerLead.bot_channel_id).toBe(campaignChannel.id);
    expect(buyerLead.source_type).toBe("campaign");
    expect(buyerLead.source_label).toBe(campaignLabel);
    expect(buyerLead.source).toBe("google");
    expect(buyerLead.medium).toBe("cpc");
    expect(buyerLead.campaign).toBe("ppc");
    expect(buyerLead.content).toBe("ad1");
    expect(buyerLead.term).toBe("duplex");

    await page.goto(`/dashboard/leads/${buyerLead.id}`);
    await expect(page.getByText("Term", { exact: true })).toBeVisible();
    await expect(page.getByText("duplex", { exact: true })).toBeVisible();
    await expect(page.getByText(campaignLabel)).toBeVisible();

    const sellerLead = await findLeadByEmail(sellerEmail);
    expect(sellerLead.bot_channel_id).toBe(widgetChannel.id);
    expect(sellerLead.source_type).toBe("web_embed");
    expect(sellerLead.source_label).toBe(widgetLabel);
    expect(sellerLead.source).toBe("agent-site");
    expect(sellerLead.medium).toBe("widget");
    expect(sellerLead.campaign).toBe("landing");
    expect(sellerLead.source_url).toBe("https://agent.example/landing");

    const extraChannelLabels = await createExtraChannels(campaignChannel.workspace_id, campaignChannel.bot_id, 4);
    await page.goto("/dashboard/leads");
    await expect(page.getByRole("link", { exact: true, name: extraChannelLabels.at(-1)! })).toBeVisible();

    const otherChannel = await createOtherWorkspaceChannel();
    const { error: mismatchError } = await admin.from("leads").update({ bot_channel_id: otherChannel.channelId }).eq("id", buyerLead.id);
    expect(mismatchError?.message).toContain("lead_channel_workspace_mismatch");

    await page.goto("/dashboard/leads");
    await expect(page.getByRole("link", { exact: true, name: campaignLabel })).toBeVisible();
    await expect(page.getByRole("link", { exact: true, name: widgetLabel })).toBeVisible();
    await page.getByRole("link", { exact: true, name: campaignLabel }).click();
    await expect(page.getByText(buyerName)).toBeVisible();
    await expect(page.getByText(sellerName)).toHaveCount(0);
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

async function createChannelThroughUi(page: Page, data: ChannelData) {
  await page.goto("/dashboard/channels");
  await expect(page.getByRole("heading", { name: "Share and track your bot" })).toBeVisible();
  await page.getByLabel("New channel label").fill(data.label);
  await page.getByLabel("New channel type").selectOption(data.type);
  await page.getByLabel("New source").fill(data.source);
  await page.getByLabel("New medium").fill(data.medium);
  await page.getByLabel("New campaign").fill(data.campaign ?? "");
  await page.getByLabel("New content").fill(data.content ?? "");
  if (data.allowedOrigins) {
    await page.getByLabel("Allowed origins for widget").fill(data.allowedOrigins);
  }
  await page.getByRole("button", { name: "Create channel" }).click();
  await expect(page.getByText("Channel saved.")).toBeVisible();
  await expect(page.getByRole("heading", { name: data.label })).toBeVisible();
}

async function completeBuyerFlowAtPath(page: Page, path: string, name: string, email: string) {
  await page.goto(path);
  await expect(page.getByText("Hosted real estate assistant")).toBeVisible();
  await page.getByRole("button", { name: "I want to buy" }).click();
  await expect(page.getByText("What is your name?")).toBeVisible();
  await sendChat(page, name);
  await expect(page.getByText("best email or phone")).toBeVisible();
  await sendChat(page, email);
  await expect(page.getByText("Which city or neighbourhood")).toBeVisible();
  await sendChat(page, "Winnipeg");
  await expect(page.getByText("What budget range")).toBeVisible();
  await sendChat(page, "900000");
  await expect(page.getByText("ideal timeline")).toBeVisible();
  await sendChat(page, "within 30 days");
  await expect(page.getByText("What property type")).toBeVisible();
  await sendChat(page, "house");
  await expect(page.getByText("pre-approved")).toBeVisible();
  await sendChat(page, "yes");
  await expect(page.getByText("I saved this buyer request")).toBeVisible();
}

async function completeSellerFlowAtPath(page: Page, path: string, name: string, email: string) {
  await page.goto(path);
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

async function findChannelByLabel(label: string) {
  const { data, error } = await admin
    .from("bot_channels")
    .select("id, workspace_id, bot_id, public_key, type, status, label, source, medium, campaign, content")
    .eq("label", label)
    .single();
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  return data as {
    id: string;
    workspace_id: string;
    bot_id: string;
    public_key: string;
    type: string;
    status: string;
    label: string;
    source: string;
    medium: string;
    campaign: string | null;
    content: string | null;
  };
}

async function findLeadByEmail(email: string) {
  const { data, error } = await admin
    .from("leads")
    .select("id, workspace_id, bot_id, conversation_id, bot_channel_id, source_type, source_label, source, medium, campaign, content, term, source_url")
    .eq("email", email)
    .single();
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  return data as {
    id: string;
    workspace_id: string;
    bot_id: string;
    conversation_id: string;
    bot_channel_id: string | null;
    source_type: string | null;
    source_label: string | null;
    source: string | null;
    medium: string | null;
    campaign: string | null;
    content: string | null;
    term: string | null;
    source_url: string | null;
  };
}

async function createSiblingBotChannel(workspaceId: string) {
  const botSlug = `sibling-${runId}`;
  const { data: bot, error: botError } = await admin
    .from("bots")
    .insert({ workspace_id: workspaceId, name: `Sibling Bot ${runId}`, slug: botSlug, status: "active", greeting: "Hi, are you buying or selling?", fallback_message: "Are you buying or selling?" })
    .select("id, slug")
    .single();
  expect(botError).toBeNull();
  expect(bot).not.toBeNull();

  const { data: channel, error: channelError } = await admin
    .from("bot_channels")
    .insert({ workspace_id: workspaceId, bot_id: bot!.id, type: "campaign", status: "active", label: `Sibling Channel ${runId}`, source: "sibling", medium: "test" })
    .select("id, public_key")
    .single();
  expect(channelError).toBeNull();
  expect(channel).not.toBeNull();

  return { botId: bot!.id as string, botSlug: bot!.slug as string, channelId: channel!.id as string, channelKey: channel!.public_key as string };
}

async function createExtraChannels(workspaceId: string, botId: string, count: number) {
  const rows = Array.from({ length: count }, (_, index) => ({
    workspace_id: workspaceId,
    bot_id: botId,
    type: "social_link",
    status: "active",
    label: `Extra filter channel ${index + 1} ${runId}`,
    source: `extra-${index + 1}`,
    medium: "social",
  }));
  const { data, error } = await admin.from("bot_channels").insert(rows).select("label");
  expect(error).toBeNull();
  return (data ?? []).map((row) => row.label as string);
}

async function createOtherWorkspaceChannel() {
  const email = uniqueEmail("phase2-other");
  const { data: authData, error: authError } = await admin.auth.admin.createUser({ email, password, email_confirm: true } as never);
  expect(authError).toBeNull();
  const user = authData.user!;
  const workspaceSlug = `other-${runId}`;
  const botSlug = `other-bot-${runId}`;

  const { data: workspace, error: workspaceError } = await admin.from("workspaces").insert({ name: `Other ${runId}`, slug: workspaceSlug, created_by: user.id }).select("id").single();
  expect(workspaceError).toBeNull();
  expect(workspace).not.toBeNull();
  const workspaceId = workspace!.id as string;

  await admin.from("workspace_members").insert({ workspace_id: workspaceId, user_id: user.id, role: "owner" });
  const { data: bot, error: botError } = await admin
    .from("bots")
    .insert({ workspace_id: workspaceId, name: `Other Bot ${runId}`, slug: botSlug, status: "active", greeting: "Hi, are you buying or selling?", fallback_message: "Are you buying or selling?" })
    .select("id")
    .single();
  expect(botError).toBeNull();
  expect(bot).not.toBeNull();
  const botId = bot!.id as string;

  const { data: channel, error: channelError } = await admin
    .from("bot_channels")
    .insert({ workspace_id: workspaceId, bot_id: botId, type: "campaign", status: "active", label: `Other Channel ${runId}`, source: "other", medium: "test" })
    .select("id")
    .single();
  expect(channelError).toBeNull();
  expect(channel).not.toBeNull();
  return { workspaceId, botId, channelId: channel!.id as string };
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

function extractWidgetToken(script: string) {
  const match = script.match(/const widgetToken = "([^"]+)";/);
  expect(match?.[1]).toBeTruthy();
  return match![1];
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
    const value = rawValue.replace(/^[\'"]|[\'"]$/g, "");

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

type ChannelData = {
  label: string;
  type: "hosted_link" | "web_embed" | "qr_code" | "social_link" | "campaign";
  source: string;
  medium: string;
  campaign?: string;
  content?: string;
  allowedOrigins?: string;
};
