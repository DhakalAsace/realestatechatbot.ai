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
const password = `Phase6-${runId}!`;
const createdEmails = new Set<string>();
const webSocketTransport = ws as unknown as WebSocketLikeConstructor;

const admin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: webSocketTransport },
});

test.describe.serial("Phase 6 team access and routing", () => {
  test.afterAll(async () => {
    for (const email of createdEmails) {
      await cleanupUser(email);
    }
  });

  test("team profiles route leads, reassignment routes appointments, and role boundaries hold", async ({ browser, page }) => {
    const ownerEmail = uniqueEmail("phase6-owner");
    const adminEmail = uniqueEmail("phase6-admin");
    const viewerEmail = uniqueEmail("phase6-viewer");
    const slug = `e2e-phase6-${runId}`;
    const teamName = `Winnipeg Team ${runId}`;
    const reassignedTeamName = `Reassigned Team ${runId}`;
    const reassignedTeamEmail = `reroute-team-${runId}@example.com`;
    const buyerEmail = `phase6-buyer-${runId}@example.com`;
    const buyerName = `Phase6 Buyer ${runId}`;
    const reassignedCalendarUrl = `https://calendly.com/phase6-${runId}/reroute`;

    await createAccountThroughUi(page, ownerEmail);
    await completeOnboarding(page, {
      agentName: `Phase6 Agent ${runId}`,
      brokerage: `Phase6 Realty ${runId}`,
      email: `agent-${runId}@example.com`,
      phone: "+1 204 555 0196",
      city: "Winnipeg",
      serviceAreas: "Winnipeg, River Heights, St. Vital",
      slug,
    });

    const bot = await findBotBySlug(slug);

    await page.goto("/dashboard/team");
    await expect(page.getByRole("heading", { name: "Workspace settings and routing" })).toBeVisible();
    await createTeamProfileThroughUi(page, {
      displayName: teamName,
      email: `team-${runId}@example.com`,
      brokerage: `Phase6 Team Brokerage ${runId}`,
    });
    await createTeamProfileThroughUi(page, {
      displayName: reassignedTeamName,
      email: reassignedTeamEmail,
      brokerage: `Phase6 Reroute Brokerage ${runId}`,
    });

    const teamProfile = await findAgentProfileByName(teamName);
    const reassignedProfile = await findAgentProfileByName(reassignedTeamName);
    const { error: calendarError } = await admin.from("agent_profiles").update({ calendar_url: reassignedCalendarUrl }).eq("id", reassignedProfile.id);
    expect(calendarError).toBeNull();

    await page.goto(`/dashboard/bots/${bot.id}`);
    await page.getByLabel("Assigned profile").selectOption(teamProfile.id);
    await page.getByRole("button", { name: "Save bot" }).click();
    await expect(page.getByText("Bot saved.")).toBeVisible();

    const buyerPage = await newPublicPage(browser);
    await completeBuyerFlow(buyerPage, slug, buyerName, buyerEmail);

    const buyerLead = await findLeadByEmail(buyerEmail);
    expect(buyerLead.assigned_agent_profile_id).toBe(teamProfile.id);

    await page.goto(`/dashboard/leads?assignee=${teamProfile.id}`);
    await expect(page.getByText(buyerName)).toBeVisible();
    await expect(page.getByText(`Assigned to ${teamName}`)).toBeVisible();

    await page.goto(`/dashboard/leads/${buyerLead.id}`);
    await expect(page.getByText(`Assigned to ${teamName}`)).toBeVisible();
    await page.locator('select[name="agentProfileId"]').selectOption(reassignedProfile.id);
    await page.getByRole("button", { name: "Assign lead" }).click();
    await expect(page.getByText(`Assigned to ${reassignedTeamName}`)).toBeVisible();

    await sendChat(buyerPage, "book a consultation tomorrow morning");
    await expect(buyerPage.getByText(/saved the buyer consultation request/i)).toBeVisible();
    await buyerPage.close();

    const reassignedLead = await findLeadByEmail(buyerEmail);
    expect(reassignedLead.assigned_agent_profile_id).toBe(reassignedProfile.id);
    const appointment = await findLatestAppointmentForLead(buyerLead.id);
    expect(appointment.assigned_agent_profile_id).toBe(reassignedProfile.id);
    expect(appointment.agent_profile_id).toBe(teamProfile.id);
    expect(appointment.calendar_url).toBe(reassignedCalendarUrl);
    const notification = await findNotificationForAppointment(appointment.id);
    expect(notification.recipient_email).toBe(reassignedTeamEmail);

    await page.goto(`/dashboard/bots/${bot.id}`);
    await page.getByLabel("Assigned profile").selectOption("");
    await page.getByRole("button", { name: "Save bot" }).click();
    await expect(page.getByText("Bot saved.")).toBeVisible();
    const clearedBot = await findBotBySlug(slug);
    expect(clearedBot.agent_profile_id).toBeNull();

    await page.goto("/dashboard/team");
    const adminToken = await createInviteThroughUi(page, adminEmail, "admin");
    const viewerToken = await createInviteThroughUi(page, viewerEmail, "viewer");
    await expect(page.getByText("workspace invitation created").first()).toBeVisible();

    await createConfirmedUser(adminEmail);
    await createConfirmedUser(viewerEmail);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await signInThroughUi(page, adminEmail);
    await page.goto(`/invite/${adminToken}`);
    await page.getByRole("button", { name: "Accept invite" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    const adminMembership = await findMembership(bot.workspace_id, adminEmail);
    expect(adminMembership?.role).toBe("admin");

    await page.goto("/dashboard/team");
    const enabledRoleOptions = await page.locator('select[name="role"]:not(:disabled)').first().locator("option").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
    expect(enabledRoleOptions).not.toContain("owner");
    await expect(page.getByText("Only owners can create, demote, or remove owner members.")).toBeHidden();

    const viewerPage = await newPublicPage(browser);
    await signInThroughUi(viewerPage, viewerEmail);
    await viewerPage.goto(`/invite/${viewerToken}`);
    await expect(viewerPage.getByText(viewerEmail)).toBeVisible();
    await viewerPage.getByRole("button", { name: "Accept invite" }).click();
    await expect(viewerPage).toHaveURL(/\/dashboard$/);

    const viewerMembership = await findMembership(bot.workspace_id, viewerEmail);
    expect(viewerMembership?.role).toBe("viewer");

    await viewerPage.goto("/dashboard/team");
    await expect(viewerPage.getByText("Read only").first()).toBeVisible();
    await expect(viewerPage.getByRole("button", { name: "Create invite link" })).toBeDisabled();

    await viewerPage.goto(`/dashboard/leads/${buyerLead.id}`);
    await expect(viewerPage.getByText("Read-only access. Lead updates are available to owners, admins, and assigned agents.")).toBeVisible();
    await expect(viewerPage.getByRole("button", { name: "Update status" })).toHaveCount(0);
    await viewerPage.close();

    const viewerClient = await signInClient(viewerEmail);
    const { data: viewerUpdateData, error: viewerUpdateError } = await viewerClient
      .from("leads")
      .update({ status: "lost" })
      .eq("id", buyerLead.id)
      .select("id, status");
    expect(viewerUpdateError).toBeNull();
    expect(viewerUpdateData).toEqual([]);

    const unchangedLead = await findLeadByEmail(buyerEmail);
    expect(unchangedLead.status).toBe("qualified");

    const { error: viewerAuditError } = await viewerClient.from("audit_events").insert({
      workspace_id: bot.workspace_id,
      action: "spoofed_audit",
      subject_type: "test",
      metadata: { runId },
    });
    expect(viewerAuditError).not.toBeNull();

    const ownerClient = await signInClient(ownerEmail);
    const { error: ownerAuditError } = await ownerClient.from("audit_events").insert({
      workspace_id: bot.workspace_id,
      action: "owner_spoofed_audit",
      subject_type: "test",
      metadata: { runId },
    });
    expect(ownerAuditError).not.toBeNull();

    const ownerUser = await findAuthUser(ownerEmail);
    expect(ownerUser).not.toBeNull();
    const { error: lastOwnerError } = await admin
      .from("workspace_members")
      .update({ role: "viewer" })
      .eq("workspace_id", bot.workspace_id)
      .eq("user_id", ownerUser!.id);
    expect(lastOwnerError).not.toBeNull();
    expect(lastOwnerError?.message).toContain("last_owner_required");

    const { data: anonInvites, error: anonInviteError } = await anonClient().from("workspace_invitations").select("id").eq("workspace_id", bot.workspace_id);
    const { data: anonAudit, error: anonAuditError } = await anonClient().from("audit_events").select("id").eq("workspace_id", bot.workspace_id);
    expect(anonInviteError).toBeNull();
    expect(anonAuditError).toBeNull();
    expect(anonInvites).toEqual([]);
    expect(anonAudit).toEqual([]);
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

async function createTeamProfileThroughUi(page: Page, data: { displayName: string; email: string; brokerage: string }) {
  const profileForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Create profile" }) });
  await profileForm.locator('select[name="profileType"]').selectOption("team");
  await profileForm.locator('input[name="displayName"]').fill(data.displayName);
  await profileForm.locator('input[name="brokerageName"]').fill(data.brokerage);
  await profileForm.locator('input[name="email"]').fill(data.email);
  await profileForm.locator('input[name="phone"]').fill("+1 204 555 0176");
  await profileForm.locator('input[name="city"]').fill("Winnipeg");
  await profileForm.locator('input[name="serviceAreas"]').fill("Winnipeg, St. Boniface");
  await profileForm.getByRole("button", { name: "Create profile" }).click();
  await expect(page.getByText("Team change saved.")).toBeVisible();
  await expect(page.getByText(data.displayName)).toBeVisible();
}

async function createInviteThroughUi(page: Page, email: string, role: "admin" | "viewer") {
  const previousToken = new URL(page.url()).searchParams.get("invite");
  const inviteForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Create invite link" }) });
  await inviteForm.locator('input[name="email"]').fill(email);
  await inviteForm.locator('select[name="role"]').selectOption(role);
  await inviteForm.getByRole("button", { name: "Create invite link" }).click();
  await page.waitForURL((url) => {
    const token = url.searchParams.get("invite");
    return url.pathname === "/dashboard/team" && Boolean(token) && token !== previousToken;
  });
  await expect(page.getByText("Invite link ready")).toBeVisible();
  const token = new URL(page.url()).searchParams.get("invite");
  expect(token).toBeTruthy();
  return token!;
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
  await sendChat(page, "850k");
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

function anonClient() {
  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: webSocketTransport },
  });
}

async function signInClient(email: string) {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  expect(error).toBeNull();
  return client;
}

async function createConfirmedUser(email: string) {
  createdEmails.add(email);
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true } as never);
  expect(error).toBeNull();
}

async function findBotBySlug(slug: string) {
  const { data, error } = await admin.from("bots").select("id, workspace_id, slug, agent_profile_id").eq("slug", slug).single();
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  return data as { id: string; workspace_id: string; slug: string; agent_profile_id: string | null };
}

async function findAgentProfileByName(displayName: string) {
  const { data, error } = await admin
    .from("agent_profiles")
    .select("id, workspace_id, display_name, profile_type, status")
    .eq("display_name", displayName)
    .single();
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  return data as { id: string; workspace_id: string; display_name: string; profile_type: string; status: string };
}

async function findLeadByEmail(email: string) {
  const { data, error } = await admin
    .from("leads")
    .select("id, workspace_id, conversation_id, agent_profile_id, status, score, assigned_agent_profile_id")
    .eq("email", email)
    .single();
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  return data as { id: string; workspace_id: string; conversation_id: string; agent_profile_id: string | null; status: string; score: number; assigned_agent_profile_id: string | null };
}

async function findLatestAppointmentForLead(leadId: string) {
  const { data, error } = await admin
    .from("appointments")
    .select("id, lead_id, agent_profile_id, assigned_agent_profile_id, calendar_url")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  return data as { id: string; lead_id: string; agent_profile_id: string | null; assigned_agent_profile_id: string | null; calendar_url: string | null };
}

async function findNotificationForAppointment(appointmentId: string) {
  const { data, error } = await admin
    .from("notification_events")
    .select("id, appointment_id, recipient_email, status")
    .eq("appointment_id", appointmentId)
    .single();
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  return data as { id: string; appointment_id: string; recipient_email: string | null; status: string };
}

async function findMembership(workspaceId: string, email: string) {
  const user = await findAuthUser(email);
  expect(user).not.toBeNull();
  const { data, error } = await admin
    .from("workspace_members")
    .select("workspace_id, user_id, role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user!.id)
    .maybeSingle();
  expect(error).toBeNull();
  return data as { workspace_id: string; user_id: string; role: string } | null;
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
