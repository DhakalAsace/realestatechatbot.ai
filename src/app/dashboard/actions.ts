"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { normalizeCalendarUrl } from "@/lib/appointments";
import { channelStatuses, channelTypes, defaultChannelMedium, defaultChannelSource, normalizeAllowedOrigins, sanitizeSourceText } from "@/lib/channels";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createUnsubscribeToken, hashFollowUpToken, normalizeEmail } from "@/lib/follow-ups";
import { hashValue } from "@/lib/security";
import { slugify, withShortSuffix } from "@/lib/slug";

const onboardingSchema = z.object({
  displayName: z.string().min(2).max(120),
  brokerageName: z.string().min(2).max(140),
  email: z.string().email(),
  phone: z.string().min(7).max(40),
  city: z.string().min(2).max(80),
  serviceAreas: z.string().min(2).max(300),
  botSlug: z.string().min(2).max(80).optional(),
});

const botSchema = z.object({
  botId: z.string().uuid(),
  assignedProfileId: z.union([z.string().uuid(), z.literal("")]).optional(),
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(80),
  status: z.enum(["draft", "active", "paused", "archived"]),
  greeting: z.string().min(10).max(500),
  fallbackMessage: z.string().min(10).max(500),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  aiEnabled: z.boolean(),
  calendarUrl: z.string().max(500).optional(),
  agentCalendarUrl: z.string().max(500).optional(),
});

const workspaceRoleSchema = z.enum(["owner", "admin", "agent", "viewer"]);

const workspaceSettingsSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(2).max(140),
});

const invitationSchema = z.object({
  workspaceId: z.string().uuid(),
  email: z.string().email().max(320),
  role: z.enum(["admin", "agent", "viewer"]),
});

const invitationIdSchema = z.object({
  invitationId: z.string().uuid(),
});

const memberRoleSchema = z.object({
  workspaceId: z.string().uuid(),
  targetUserId: z.string().uuid(),
  role: workspaceRoleSchema,
});

const memberRemoveSchema = z.object({
  workspaceId: z.string().uuid(),
  targetUserId: z.string().uuid(),
});

const profileSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  profileType: z.enum(["agent", "team"]),
  displayName: z.string().min(2).max(120),
  brokerageName: z.string().min(2).max(140),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  city: z.string().max(80).optional(),
  serviceAreas: z.string().max(300).optional(),
});

const leadAssignmentSchema = z.object({
  leadId: z.string().uuid(),
  agentProfileId: z.string().uuid(),
});

const inviteAcceptSchema = z.object({
  token: z.string().min(20).max(200),
});

const leadStatusSchema = z.object({
  leadId: z.string().uuid(),
  status: z.enum(["new", "qualified", "contacted", "converted", "lost", "spam"]),
});

const followUpSequenceStatusSchema = z.object({
  sequenceId: z.string().uuid(),
  status: z.enum(["draft", "active", "paused", "archived"]),
});

const followUpMessageSchema = z.object({
  messageId: z.string().uuid(),
  delayMinutes: z.coerce.number().int().min(0).max(43200),
  status: z.enum(["draft", "active", "paused", "archived"]),
  subjectTemplate: z.string().min(2).max(200),
  bodyTemplate: z.string().min(10).max(4000),
});

const leadEmailPreferenceSchema = z.object({
  leadId: z.string().uuid(),
  status: z.enum(["opted_in", "unsubscribed"]),
});

const appointmentUpdateSchema = z.object({
  appointmentId: z.string().uuid(),
  status: z.enum(["requested", "acknowledged", "confirmed", "declined", "cancelled", "completed"]),
  agentNotes: z.string().max(2000).optional(),
  redirectTo: z.string().max(300).optional(),
});

const channelSchema = z.object({
  botId: z.string().uuid(),
  type: z.enum(channelTypes),
  label: z.string().min(2).max(120),
  source: z.string().max(80).optional(),
  medium: z.string().max(80).optional(),
  campaign: z.string().max(120).optional(),
  content: z.string().max(120).optional(),
  allowedOrigins: z.string().max(1000).optional(),
});

const channelUpdateSchema = z.object({
  channelId: z.string().uuid(),
  label: z.string().min(2).max(120),
  status: z.enum(channelStatuses),
  source: z.string().max(80).optional(),
  medium: z.string().max(80).optional(),
  campaign: z.string().max(120).optional(),
  content: z.string().max(120).optional(),
  allowedOrigins: z.string().max(1000).optional(),
});

const propertySchema = z.object({
  propertyId: z.string().uuid().optional(),
  botId: z.string().uuid(),
  status: z.enum(["draft", "active", "archived"]),
  title: z.string().min(2).max(160),
  propertyType: z.string().max(80).optional(),
  price: z.string().max(20).optional(),
  address: z.string().max(240).optional(),
  city: z.string().max(120).optional(),
  area: z.string().max(120).optional(),
  bedrooms: z.string().max(10).optional(),
  bathrooms: z.string().max(10).optional(),
  description: z.string().max(2000).optional(),
  highlights: z.string().max(600).optional(),
  imageUrl: z.string().max(500).optional(),
  listingUrl: z.string().max(500).optional(),
});

const knowledgeSchema = z.object({
  documentId: z.string().uuid().optional(),
  botId: z.string().uuid(),
  status: z.enum(["draft", "active", "archived"]),
  kind: z.enum(["faq", "note"]),
  title: z.string().min(2).max(160),
  question: z.string().max(300).optional(),
  body: z.string().min(2).max(3000),
  tags: z.string().max(600).optional(),
});

export async function completeOnboarding(formData: FormData) {
  await requireUser();
  const parsed = onboardingSchema.safeParse({
    displayName: formData.get("displayName"),
    brokerageName: formData.get("brokerageName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    city: formData.get("city"),
    serviceAreas: formData.get("serviceAreas"),
    botSlug: formData.get("botSlug") || undefined,
  });

  if (!parsed.success) {
    redirect("/dashboard/onboarding?error=validation");
  }

  const supabase = await createServerSupabaseClient();
  const workspaceSlug = withShortSuffix(slugify(parsed.data.brokerageName, "workspace"));
  const botSlug = slugify(parsed.data.botSlug || parsed.data.displayName, "agent");
  const serviceAreas = parsed.data.serviceAreas
    .split(",")
    .map((area) => area.trim())
    .filter(Boolean);

  const { error } = await supabase.rpc("complete_workspace_onboarding", {
    p_workspace_name: parsed.data.brokerageName,
    p_workspace_slug: workspaceSlug,
    p_display_name: parsed.data.displayName,
    p_brokerage_name: parsed.data.brokerageName,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone,
    p_city: parsed.data.city,
    p_service_areas: serviceAreas,
    p_bot_slug: botSlug,
    p_brand_color: "#163f2f",
  });

  if (error) {
    redirect(onboardingErrorUrl(error, botSlug));
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updateWorkspaceSettings(formData: FormData) {
  const { user, supabase, membership } = await requireActionContext();
  ensureManager(membership.role, "/dashboard/team?error=permission");
  const parsed = workspaceSettingsSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
  });

  if (!parsed.success || parsed.data.workspaceId !== membership.workspace_id) redirect("/dashboard/team?error=validation");

  const { error } = await supabase.from("workspaces").update({ name: parsed.data.name }).eq("id", membership.workspace_id);
  if (error) redirect("/dashboard/team?error=settings");

  await writeAuditEvent(supabase, membership.workspace_id, user.id, null, "workspace_settings_updated", "workspace", membership.workspace_id, { name: parsed.data.name });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/team");
  redirect("/dashboard/team?saved=settings");
}

export async function createWorkspaceInvitation(formData: FormData) {
  const { user, supabase, membership } = await requireActionContext();
  ensureManager(membership.role, "/dashboard/team?error=permission");
  const parsed = invitationSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success || parsed.data.workspaceId !== membership.workspace_id) redirect("/dashboard/team?error=invite-validation");

  const token = randomBytes(24).toString("base64url");
  const { error } = await supabase.from("workspace_invitations").insert({
    workspace_id: membership.workspace_id,
    email: parsed.data.email.toLowerCase(),
    role: parsed.data.role,
    token_hash: hashValue(token),
    invited_by: user.id,
  });

  if (error) redirect("/dashboard/team?error=invite");

  await writeAuditEvent(supabase, membership.workspace_id, user.id, null, "workspace_invitation_created", "workspace_invitation", null, { email: parsed.data.email.toLowerCase(), role: parsed.data.role });
  revalidatePath("/dashboard/team");
  redirect(`/dashboard/team?saved=invite&invite=${encodeURIComponent(token)}`);
}

export async function revokeWorkspaceInvitation(formData: FormData) {
  const { user, supabase, membership } = await requireActionContext();
  ensureManager(membership.role, "/dashboard/team?error=permission");
  const parsed = invitationIdSchema.safeParse({ invitationId: formData.get("invitationId") });
  if (!parsed.success) redirect("/dashboard/team?error=invite-validation");

  const { error } = await supabase
    .from("workspace_invitations")
    .update({ status: "revoked" })
    .eq("id", parsed.data.invitationId)
    .eq("workspace_id", membership.workspace_id)
    .eq("status", "pending");
  if (error) redirect("/dashboard/team?error=invite");

  await writeAuditEvent(supabase, membership.workspace_id, user.id, null, "workspace_invitation_revoked", "workspace_invitation", parsed.data.invitationId, {});
  revalidatePath("/dashboard/team");
  redirect("/dashboard/team?saved=invite-revoked");
}

export async function updateWorkspaceMemberRole(formData: FormData) {
  const { user, supabase, membership } = await requireActionContext();
  ensureManager(membership.role, "/dashboard/team?error=permission");
  const parsed = memberRoleSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    targetUserId: formData.get("targetUserId"),
    role: formData.get("role"),
  });
  if (!parsed.success || parsed.data.workspaceId !== membership.workspace_id) redirect("/dashboard/team?error=member");

  const target = await loadMember(supabase, membership.workspace_id, parsed.data.targetUserId);
  if (!target) redirect("/dashboard/team?error=member");
  guardOwnerMemberChange(membership.role, target.role, parsed.data.role);
  await guardLastOwner(supabase, membership.workspace_id, target.role, parsed.data.role);

  const memberSupabase = getSupabaseAdminClient();
  const { error } = await memberSupabase
    .from("workspace_members")
    .update({ role: parsed.data.role })
    .eq("workspace_id", membership.workspace_id)
    .eq("user_id", parsed.data.targetUserId);
  if (error) redirect("/dashboard/team?error=member");

  await writeAuditEvent(supabase, membership.workspace_id, user.id, parsed.data.targetUserId, "workspace_member_role_changed", "workspace_member", parsed.data.targetUserId, { from: target.role, to: parsed.data.role });
  revalidatePath("/dashboard/team");
  redirect("/dashboard/team?saved=member");
}

export async function removeWorkspaceMember(formData: FormData) {
  const { user, supabase, membership } = await requireActionContext();
  ensureManager(membership.role, "/dashboard/team?error=permission");
  const parsed = memberRemoveSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    targetUserId: formData.get("targetUserId"),
  });
  if (!parsed.success || parsed.data.workspaceId !== membership.workspace_id) redirect("/dashboard/team?error=member");

  const target = await loadMember(supabase, membership.workspace_id, parsed.data.targetUserId);
  if (!target) redirect("/dashboard/team?error=member");
  guardOwnerMemberChange(membership.role, target.role, "viewer");
  await guardLastOwner(supabase, membership.workspace_id, target.role, "viewer");

  const memberSupabase = getSupabaseAdminClient();
  const { error } = await memberSupabase.from("workspace_members").delete().eq("workspace_id", membership.workspace_id).eq("user_id", parsed.data.targetUserId);
  if (error) redirect("/dashboard/team?error=member");

  await writeAuditEvent(supabase, membership.workspace_id, user.id, parsed.data.targetUserId, "workspace_member_removed", "workspace_member", parsed.data.targetUserId, { role: target.role });
  revalidatePath("/dashboard/team");
  redirect("/dashboard/team?saved=member-removed");
}

export async function createAgentProfile(formData: FormData) {
  const { user, supabase, membership } = await requireActionContext();
  ensureManager(membership.role, "/dashboard/team?error=permission");
  const parsed = profileSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    userId: optionalFormString(formData.get("userId")),
    profileType: formData.get("profileType"),
    displayName: formData.get("displayName"),
    brokerageName: formData.get("brokerageName"),
    email: optionalFormString(formData.get("email")),
    phone: optionalFormString(formData.get("phone")),
    city: optionalFormString(formData.get("city")),
    serviceAreas: optionalFormString(formData.get("serviceAreas")),
  });
  if (!parsed.success || parsed.data.workspaceId !== membership.workspace_id) redirect("/dashboard/team?error=profile");

  const serviceAreas = splitCommaList(parsed.data.serviceAreas);
  const { data, error } = await supabase
    .from("agent_profiles")
    .insert({
      workspace_id: membership.workspace_id,
      user_id: parsed.data.userId || null,
      profile_type: parsed.data.profileType,
      display_name: parsed.data.displayName,
      brokerage_name: parsed.data.brokerageName,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      city: parsed.data.city || null,
      service_areas: serviceAreas,
    })
    .select("id")
    .single();
  if (error || !data) redirect("/dashboard/team?error=profile");

  await writeAuditEvent(supabase, membership.workspace_id, user.id, parsed.data.userId || null, "agent_profile_created", "agent_profile", data.id, { profileType: parsed.data.profileType, displayName: parsed.data.displayName });
  revalidatePath("/dashboard/team");
  redirect("/dashboard/team?saved=profile");
}

export async function assignLead(formData: FormData) {
  const { user, supabase, membership } = await requireActionContext();
  ensureManager(membership.role, "/dashboard/leads?error=permission");
  const parsed = leadAssignmentSchema.safeParse({
    leadId: formData.get("leadId"),
    agentProfileId: formData.get("agentProfileId"),
  });
  if (!parsed.success) redirect("/dashboard/leads?error=assignment");

  const { data: profile } = await supabase.from("agent_profiles").select("id").eq("workspace_id", membership.workspace_id).eq("id", parsed.data.agentProfileId).eq("status", "active").maybeSingle();
  if (!profile) redirect(`/dashboard/leads/${parsed.data.leadId}?error=assignment`);

  const { data: assignedLeads, error } = await supabase
    .from("leads")
    .update({ assigned_agent_profile_id: parsed.data.agentProfileId, assigned_by: user.id, assigned_at: new Date().toISOString() })
    .eq("workspace_id", membership.workspace_id)
    .eq("id", parsed.data.leadId)
    .select("id");
  if (error || (assignedLeads?.length ?? 0) !== 1) redirect(`/dashboard/leads/${parsed.data.leadId}?error=assignment`);

  await supabase.from("appointments").update({ assigned_agent_profile_id: parsed.data.agentProfileId }).eq("workspace_id", membership.workspace_id).eq("lead_id", parsed.data.leadId);
  await writeAuditEvent(supabase, membership.workspace_id, user.id, null, "lead_assigned", "lead", parsed.data.leadId, { agentProfileId: parsed.data.agentProfileId });
  revalidatePath("/dashboard/leads");
  revalidatePath(`/dashboard/leads/${parsed.data.leadId}`);
  redirect(`/dashboard/leads/${parsed.data.leadId}?saved=assignment`);
}

export async function acceptWorkspaceInvitation(formData: FormData) {
  await requireUser();
  const parsed = inviteAcceptSchema.safeParse({ token: formData.get("token") });
  if (!parsed.success) redirect("/login?error=invite");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("accept_workspace_invitation", { p_token_hash: hashValue(parsed.data.token) });
  if (error) redirect(`/invite/${encodeURIComponent(parsed.data.token)}?error=accept`);

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function createChannel(formData: FormData) {
  await requireUser();
  const parsed = channelSchema.safeParse({
    botId: formData.get("botId"),
    type: formData.get("type"),
    label: formData.get("label"),
    source: formData.get("source") || undefined,
    medium: formData.get("medium") || undefined,
    campaign: formData.get("campaign") || undefined,
    content: formData.get("content") || undefined,
    allowedOrigins: formData.get("allowedOrigins") || undefined,
  });

  if (!parsed.success) redirect("/dashboard/channels?error=validation");

  const supabase = await createServerSupabaseClient();
  const { data: bot } = await supabase
    .from("bots")
    .select("id, workspace_id")
    .eq("id", parsed.data.botId)
    .maybeSingle();

  if (!bot) redirect("/dashboard/channels?error=bot");

  const allowedOrigins = normalizeAllowedOrigins(parsed.data.allowedOrigins);
  if (parsed.data.type === "web_embed" && allowedOrigins.length === 0) {
    redirect("/dashboard/channels?error=origins");
  }

  const { error } = await supabase.from("bot_channels").insert({
    workspace_id: bot.workspace_id,
    bot_id: bot.id,
    type: parsed.data.type,
    status: "active",
    label: parsed.data.label,
    source: sanitizeSourceText(parsed.data.source, 80) ?? defaultChannelSource(parsed.data.type),
    medium: sanitizeSourceText(parsed.data.medium, 80) ?? defaultChannelMedium(parsed.data.type),
    campaign: sanitizeSourceText(parsed.data.campaign, 120),
    content: sanitizeSourceText(parsed.data.content, 120),
    allowed_origins: allowedOrigins,
    settings: {},
  });

  if (error) redirect("/dashboard/channels?error=create");

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/channels");
  revalidatePath("/dashboard/leads");
  redirect("/dashboard/channels?saved=created");
}

export async function updateChannel(formData: FormData) {
  await requireUser();
  const parsed = channelUpdateSchema.safeParse({
    channelId: formData.get("channelId"),
    label: formData.get("label"),
    status: formData.get("status"),
    source: formData.get("source") || undefined,
    medium: formData.get("medium") || undefined,
    campaign: formData.get("campaign") || undefined,
    content: formData.get("content") || undefined,
    allowedOrigins: formData.get("allowedOrigins") || undefined,
  });

  if (!parsed.success) redirect("/dashboard/channels?error=validation");

  const supabase = await createServerSupabaseClient();
  const { data: channel } = await supabase
    .from("bot_channels")
    .select("id, type")
    .eq("id", parsed.data.channelId)
    .maybeSingle();

  if (!channel) redirect("/dashboard/channels?error=channel");

  const allowedOrigins = normalizeAllowedOrigins(parsed.data.allowedOrigins);
  if (channel.type === "web_embed" && parsed.data.status === "active" && allowedOrigins.length === 0) {
    redirect("/dashboard/channels?error=origins");
  }

  const { error } = await supabase
    .from("bot_channels")
    .update({
      label: parsed.data.label,
      status: parsed.data.status,
      source: sanitizeSourceText(parsed.data.source, 80) ?? defaultChannelSource(channel.type),
      medium: sanitizeSourceText(parsed.data.medium, 80) ?? defaultChannelMedium(channel.type),
      campaign: sanitizeSourceText(parsed.data.campaign, 120),
      content: sanitizeSourceText(parsed.data.content, 120),
      allowed_origins: allowedOrigins,
    })
    .eq("id", parsed.data.channelId);

  if (error) redirect("/dashboard/channels?error=update");

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/channels");
  revalidatePath("/dashboard/leads");
  redirect("/dashboard/channels?saved=updated");
}

export async function updateBot(formData: FormData) {
  await requireUser();
  const parsed = botSchema.safeParse({
    botId: formData.get("botId"),
    assignedProfileId: formData.get("assignedProfileId") === null ? undefined : String(formData.get("assignedProfileId")),
    name: formData.get("name"),
    slug: slugify(String(formData.get("slug") ?? "")),
    status: formData.get("status"),
    greeting: formData.get("greeting"),
    fallbackMessage: formData.get("fallbackMessage"),
    brandColor: formData.get("brandColor"),
    aiEnabled: formData.get("aiEnabled") === "on",
    calendarUrl: optionalFormString(formData.get("calendarUrl")),
    agentCalendarUrl: optionalFormString(formData.get("agentCalendarUrl")),
  });

  if (!parsed.success) redirect("/dashboard?error=bot-validation");

  const supabase = await createServerSupabaseClient();
  const { data: existingBot } = await supabase
    .from("bots")
    .select("id, workspace_id, agent_profile_id")
    .eq("id", parsed.data.botId)
    .maybeSingle();

  if (!existingBot) redirect("/dashboard?error=bot");

  const assignedProfileId = parsed.data.assignedProfileId === "" ? null : (parsed.data.assignedProfileId ?? existingBot.agent_profile_id);
  if (assignedProfileId) {
    const { data: profile } = await supabase
      .from("agent_profiles")
      .select("id")
      .eq("workspace_id", existingBot.workspace_id)
      .eq("id", assignedProfileId)
      .eq("status", "active")
      .maybeSingle();

    if (!profile) redirect(`/dashboard/bots/${parsed.data.botId}?error=profile`);
  }

  const botCalendarUrl = normalizeCalendarUrl(parsed.data.calendarUrl);
  const agentCalendarUrl = normalizeCalendarUrl(parsed.data.agentCalendarUrl);
  const { data: updatedBots, error } = await supabase
    .from("bots")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      status: parsed.data.status,
      greeting: parsed.data.greeting,
      fallback_message: parsed.data.fallbackMessage,
      agent_profile_id: assignedProfileId,
      ai_enabled: parsed.data.aiEnabled,
      appointment_config: botCalendarUrl ? { calendarUrl: botCalendarUrl } : {},
      theme: { brandColor: parsed.data.brandColor },
    })
    .eq("id", parsed.data.botId)
    .select("id");

  if (error || (updatedBots?.length ?? 0) !== 1) {
    const errorCode = error && "code" in error ? error.code : undefined;
    const errorMessage = error?.message ?? "";
    const reason = errorCode === "23505" || errorMessage.includes("bots_slug_key") ? "duplicate-slug" : "update";

    redirect(`/dashboard/bots/${parsed.data.botId}?error=${reason}`);
  }

  if (assignedProfileId) {
    const { error: profileError } = await supabase
      .from("agent_profiles")
      .update({ calendar_url: agentCalendarUrl })
      .eq("id", assignedProfileId)
      .eq("workspace_id", existingBot.workspace_id);

    if (profileError) redirect(`/dashboard/bots/${parsed.data.botId}?error=calendar`);
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/bots/${parsed.data.botId}`);
  redirect(`/dashboard/bots/${parsed.data.botId}?saved=1`);
}


export async function createProperty(formData: FormData) {
  await requireUser();
  const parsed = parsePropertyForm(formData);
  if (!parsed.success) redirect("/dashboard/properties?error=validation");

  const supabase = await createServerSupabaseClient();
  const bot = await loadBotForAction(supabase, parsed.data.botId);
  if (!bot) redirect("/dashboard/properties?error=bot");

  const { error } = await supabase.from("properties").insert({
    workspace_id: bot.workspace_id,
    bot_id: bot.id,
    ...propertyPayload(parsed.data),
  });

  if (error) redirect("/dashboard/properties?error=create");

  revalidatePath("/dashboard/properties");
  redirect("/dashboard/properties?saved=created");
}

export async function updateProperty(formData: FormData) {
  await requireUser();
  const parsed = parsePropertyForm(formData);
  if (!parsed.success || !parsed.data.propertyId) redirect("/dashboard/properties?error=validation");

  const supabase = await createServerSupabaseClient();
  const { data: existing } = await supabase.from("properties").select("id, workspace_id").eq("id", parsed.data.propertyId).maybeSingle();
  if (!existing) redirect("/dashboard/properties?error=missing");

  const bot = await loadBotForAction(supabase, parsed.data.botId);
  if (!bot || bot.workspace_id !== existing.workspace_id) redirect("/dashboard/properties?error=bot");

  const { error } = await supabase
    .from("properties")
    .update({ bot_id: bot.id, ...propertyPayload(parsed.data) })
    .eq("id", parsed.data.propertyId);

  if (error) redirect("/dashboard/properties?error=update");

  revalidatePath("/dashboard/properties");
  redirect("/dashboard/properties?saved=updated");
}

export async function createKnowledgeDocument(formData: FormData) {
  await requireUser();
  const parsed = parseKnowledgeForm(formData);
  if (!parsed.success) redirect("/dashboard/knowledge?error=validation");

  const supabase = await createServerSupabaseClient();
  const bot = await loadBotForAction(supabase, parsed.data.botId);
  if (!bot) redirect("/dashboard/knowledge?error=bot");

  const { error } = await supabase.from("knowledge_documents").insert({
    workspace_id: bot.workspace_id,
    bot_id: bot.id,
    ...knowledgePayload(parsed.data),
  });

  if (error) redirect("/dashboard/knowledge?error=create");

  revalidatePath("/dashboard/knowledge");
  redirect("/dashboard/knowledge?saved=created");
}

export async function updateKnowledgeDocument(formData: FormData) {
  await requireUser();
  const parsed = parseKnowledgeForm(formData);
  if (!parsed.success || !parsed.data.documentId) redirect("/dashboard/knowledge?error=validation");

  const supabase = await createServerSupabaseClient();
  const { data: existing } = await supabase.from("knowledge_documents").select("id, workspace_id").eq("id", parsed.data.documentId).maybeSingle();
  if (!existing) redirect("/dashboard/knowledge?error=missing");

  const bot = await loadBotForAction(supabase, parsed.data.botId);
  if (!bot || bot.workspace_id !== existing.workspace_id) redirect("/dashboard/knowledge?error=bot");

  const { error } = await supabase
    .from("knowledge_documents")
    .update({ bot_id: bot.id, ...knowledgePayload(parsed.data) })
    .eq("id", parsed.data.documentId);

  if (error) redirect("/dashboard/knowledge?error=update");

  revalidatePath("/dashboard/knowledge");
  redirect("/dashboard/knowledge?saved=updated");
}

export async function updateAppointmentStatus(formData: FormData) {
  await requireUser();
  const parsed = appointmentUpdateSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    status: formData.get("status"),
    agentNotes: optionalFormString(formData.get("agentNotes")),
    redirectTo: optionalFormString(formData.get("redirectTo")),
  });

  if (!parsed.success) redirect("/dashboard/appointments?error=status");

  const supabase = await createServerSupabaseClient();
  const timestampUpdates = appointmentTimestampUpdates(parsed.data.status);
  const { data: updatedAppointments, error } = await supabase
    .from("appointments")
    .update({
      status: parsed.data.status,
      agent_notes: parsed.data.agentNotes || null,
      ...timestampUpdates,
    })
    .eq("id", parsed.data.appointmentId)
    .select("id");

  const redirectTo = parsed.data.redirectTo?.startsWith("/dashboard/") ? parsed.data.redirectTo : "/dashboard/appointments";
  if (error || (updatedAppointments?.length ?? 0) !== 1) redirect(`${redirectTo}?error=status`);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/appointments");
  revalidatePath(redirectTo);
  redirect(`${redirectTo}?saved=appointment`);
}

function appointmentTimestampUpdates(status: z.infer<typeof appointmentUpdateSchema>["status"]) {
  const now = new Date().toISOString();
  if (status === "acknowledged") return { acknowledged_at: now };
  if (status === "confirmed") return { confirmed_at: now, acknowledged_at: now };
  if (status === "cancelled" || status === "declined") return { cancelled_at: now };
  return {};
}

export async function updateLeadStatus(formData: FormData) {
  await requireUser();
  const parsed = leadStatusSchema.safeParse({
    leadId: formData.get("leadId"),
    status: formData.get("status"),
  });

  if (!parsed.success) redirect("/dashboard/leads?error=status");

  const supabase = await createServerSupabaseClient();
  const { data: updatedLeads, error } = await supabase
    .from("leads")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.leadId)
    .select("id");

  if (error || (updatedLeads?.length ?? 0) !== 1) redirect(`/dashboard/leads/${parsed.data.leadId}?error=status`);

  revalidatePath("/dashboard/leads");
  revalidatePath(`/dashboard/leads/${parsed.data.leadId}`);
  redirect(`/dashboard/leads/${parsed.data.leadId}?saved=1`);
}

export async function updateFollowUpSequenceStatus(formData: FormData) {
  const { user, supabase, membership } = await requireActionContext();
  ensureManager(membership.role, "/dashboard/follow-ups?error=permission");
  const parsed = followUpSequenceStatusSchema.safeParse({
    sequenceId: formData.get("sequenceId"),
    status: formData.get("status"),
  });

  if (!parsed.success) redirect("/dashboard/follow-ups?error=sequence");

  const { data: updated, error } = await supabase
    .from("follow_up_sequences")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.sequenceId)
    .eq("workspace_id", membership.workspace_id)
    .select("id");

  if (error || (updated?.length ?? 0) !== 1) redirect("/dashboard/follow-ups?error=sequence");

  await writeAuditEvent(supabase, membership.workspace_id, user.id, null, "follow_up_sequence_status_updated", "follow_up_sequence", parsed.data.sequenceId, { status: parsed.data.status });
  revalidatePath("/dashboard/follow-ups");
  redirect("/dashboard/follow-ups?saved=sequence");
}

export async function updateFollowUpMessage(formData: FormData) {
  const { user, supabase, membership } = await requireActionContext();
  ensureManager(membership.role, "/dashboard/follow-ups?error=permission");
  const parsed = followUpMessageSchema.safeParse({
    messageId: formData.get("messageId"),
    delayMinutes: formData.get("delayMinutes"),
    status: formData.get("status"),
    subjectTemplate: formData.get("subjectTemplate"),
    bodyTemplate: formData.get("bodyTemplate"),
  });

  if (!parsed.success) redirect("/dashboard/follow-ups?error=message");

  const { data: updated, error } = await supabase
    .from("follow_up_messages")
    .update({
      delay_minutes: parsed.data.delayMinutes,
      status: parsed.data.status,
      subject_template: parsed.data.subjectTemplate,
      body_template: parsed.data.bodyTemplate,
    })
    .eq("id", parsed.data.messageId)
    .eq("workspace_id", membership.workspace_id)
    .select("id");

  if (error || (updated?.length ?? 0) !== 1) redirect("/dashboard/follow-ups?error=message");

  await writeAuditEvent(supabase, membership.workspace_id, user.id, null, "follow_up_message_updated", "follow_up_message", parsed.data.messageId, { delayMinutes: parsed.data.delayMinutes, status: parsed.data.status });
  revalidatePath("/dashboard/follow-ups");
  redirect("/dashboard/follow-ups?saved=message");
}

export async function updateLeadEmailPreference(formData: FormData) {
  const { user, supabase, membership } = await requireActionContext();
  ensureManager(membership.role, "/dashboard/leads?error=permission");
  const parsed = leadEmailPreferenceSchema.safeParse({
    leadId: formData.get("leadId"),
    status: formData.get("status"),
  });

  if (!parsed.success) redirect("/dashboard/leads?error=follow-up");

  const { data: lead } = await supabase
    .from("leads")
    .select("id, workspace_id, email")
    .eq("id", parsed.data.leadId)
    .eq("workspace_id", membership.workspace_id)
    .maybeSingle();

  const email = normalizeEmail((lead as { email?: string | null } | null)?.email);
  if (!lead || !email) redirect(`/dashboard/leads/${parsed.data.leadId}?error=follow-up-email`);

  const now = new Date().toISOString();
  const token = createUnsubscribeToken();
  const payload: {
    workspace_id: string;
    lead_id: string;
    email: string;
    status: "opted_in" | "unsubscribed";
    consent_source: string | null;
    consent_text_version: string | null;
    consented_at: string | null;
    unsubscribe_token_hash: string | null;
    unsubscribed_at: string | null;
    unsubscribe_reason: string | null;
    metadata: Record<string, unknown>;
  } = parsed.data.status === "opted_in"
    ? {
        workspace_id: membership.workspace_id,
        lead_id: parsed.data.leadId,
        email,
        status: "opted_in",
        consent_source: "dashboard",
        consent_text_version: "phase7-v1",
        consented_at: now,
        unsubscribe_token_hash: hashFollowUpToken(token),
        unsubscribed_at: null,
        unsubscribe_reason: null,
        metadata: {
          consentBasis: "Agent attests the lead gave permission for email follow-up about this real estate inquiry.",
          consentTextVersion: "phase7-v1",
          recordedByUserId: user.id,
          recordedAt: now,
        },
      }
    : {
        workspace_id: membership.workspace_id,
        lead_id: parsed.data.leadId,
        email,
        status: "unsubscribed",
        consent_source: null,
        consent_text_version: null,
        consented_at: null,
        unsubscribe_token_hash: null,
        unsubscribed_at: now,
        unsubscribe_reason: "agent_suppressed",
        metadata: {
          suppressionReason: "Agent suppressed automated follow-up from dashboard.",
          recordedByUserId: user.id,
          recordedAt: now,
        },
      };

  const { error } = await supabase.from("lead_email_preferences").upsert(payload, { onConflict: "workspace_id,email" });
  if (error) redirect(`/dashboard/leads/${parsed.data.leadId}?error=follow-up`);

  if (parsed.data.status === "opted_in") {
    await supabase
      .from("lead_follow_up_state")
      .update({ status: "scheduled", next_send_at: now })
      .eq("workspace_id", membership.workspace_id)
      .eq("lead_id", parsed.data.leadId)
      .in("status", ["paused", "pending_consent"]);
  } else {
    await supabase
      .from("lead_follow_up_state")
      .update({ status: "unsubscribed", next_send_at: null })
      .eq("workspace_id", membership.workspace_id)
      .eq("lead_id", parsed.data.leadId)
      .in("status", ["scheduled", "processing", "paused", "failed"]);
  }

  await writeAuditEvent(supabase, membership.workspace_id, user.id, null, "lead_email_follow_up_preference_updated", "lead", parsed.data.leadId, { status: parsed.data.status });
  revalidatePath("/dashboard/follow-ups");
  revalidatePath(`/dashboard/leads/${parsed.data.leadId}`);
  redirect(`/dashboard/leads/${parsed.data.leadId}?saved=follow-up`);
}

export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}


type ActionMembership = { workspace_id: string; role: "owner" | "admin" | "agent" | "viewer" | "member" };

async function requireActionContext() {
  const user = await requireUser();
  const supabase = await createServerSupabaseClient();
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/dashboard/onboarding");

  return { user, supabase, membership: membership as ActionMembership };
}

function ensureManager(role: ActionMembership["role"], redirectTo: string) {
  if (role !== "owner" && role !== "admin") redirect(redirectTo);
}

function guardOwnerMemberChange(actorRole: ActionMembership["role"], targetRole: ActionMembership["role"], nextRole: ActionMembership["role"]) {
  if (actorRole === "owner") return;

  if (targetRole === "owner" || nextRole === "owner") {
    redirect("/dashboard/team?error=owner-permission");
  }
}

async function loadMember(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, workspaceId: string, userId: string) {
  const { data } = await supabase.from("workspace_members").select("user_id, role").eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle();
  return data as { user_id: string; role: ActionMembership["role"] } | null;
}

async function guardLastOwner(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, workspaceId: string, currentRole: ActionMembership["role"], nextRole: ActionMembership["role"]) {
  if (currentRole !== "owner" || nextRole === "owner") return;

  const { count } = await supabase
    .from("workspace_members")
    .select("user_id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("role", "owner");

  if ((count ?? 0) <= 1) redirect("/dashboard/team?error=last-owner");
}

async function writeAuditEvent(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  workspaceId: string,
  actorUserId: string,
  targetUserId: string | null,
  action: string,
  subjectType: string,
  subjectId: string | null,
  metadata: Record<string, unknown>,
) {
  const auditSupabase = getSupabaseAdminClient();
  const { error } = await auditSupabase.from("audit_events").insert({
    workspace_id: workspaceId,
    actor_user_id: actorUserId,
    target_user_id: targetUserId,
    action,
    subject_type: subjectType,
    subject_id: subjectId,
    metadata,
  });

  if (error) console.error("audit_event_failed", error.message);
}

function parsePropertyForm(formData: FormData) {
  return propertySchema.safeParse({
    propertyId: formData.get("propertyId") || undefined,
    botId: formData.get("botId"),
    status: formData.get("status"),
    title: formData.get("title"),
    propertyType: optionalFormString(formData.get("propertyType")),
    price: optionalFormString(formData.get("price")),
    address: optionalFormString(formData.get("address")),
    city: optionalFormString(formData.get("city")),
    area: optionalFormString(formData.get("area")),
    bedrooms: optionalFormString(formData.get("bedrooms")),
    bathrooms: optionalFormString(formData.get("bathrooms")),
    description: optionalFormString(formData.get("description")),
    highlights: optionalFormString(formData.get("highlights")),
    imageUrl: optionalFormString(formData.get("imageUrl")),
    listingUrl: optionalFormString(formData.get("listingUrl")),
  });
}

function parseKnowledgeForm(formData: FormData) {
  return knowledgeSchema.safeParse({
    documentId: formData.get("documentId") || undefined,
    botId: formData.get("botId"),
    status: formData.get("status"),
    kind: formData.get("kind"),
    title: formData.get("title"),
    question: optionalFormString(formData.get("question")),
    body: formData.get("body"),
    tags: optionalFormString(formData.get("tags")),
  });
}

function propertyPayload(data: z.infer<typeof propertySchema>) {
  return {
    status: data.status,
    title: data.title,
    property_type: data.propertyType || null,
    price: parseOptionalInteger(data.price),
    address: data.address || null,
    city: data.city || null,
    area: data.area || null,
    bedrooms: parseOptionalInteger(data.bedrooms),
    bathrooms: parseOptionalNumber(data.bathrooms),
    description: data.description || null,
    highlights: splitCommaList(data.highlights),
    image_url: normalizeOptionalUrl(data.imageUrl),
    listing_url: normalizeOptionalUrl(data.listingUrl),
  };
}

function knowledgePayload(data: z.infer<typeof knowledgeSchema>) {
  return {
    status: data.status,
    kind: data.kind,
    title: data.title,
    question: data.question || null,
    body: data.body,
    tags: splitCommaList(data.tags),
  };
}

async function loadBotForAction(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, botId: string) {
  const { data } = await supabase.from("bots").select("id, workspace_id").eq("id", botId).maybeSingle();
  return data as { id: string; workspace_id: string } | null;
}

function optionalFormString(value: FormDataEntryValue | null) {
  const stringValue = String(value ?? "").trim();
  return stringValue.length > 0 ? stringValue : undefined;
}

function parseOptionalInteger(value: string | undefined) {
  if (!value) return null;
  const parsed = Number.parseInt(value.replace(/[$,\s]/g, ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseOptionalNumber(value: string | undefined) {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function splitCommaList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function normalizeOptionalUrl(value: string | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function onboardingErrorUrl(error: { message?: string; code?: string }, botSlug: string) {
  const message = error.message ?? "";

  if (message.includes("duplicate_bot_slug") || message.includes("bots_slug_key")) {
    const suggestedSlug = withShortSuffix(botSlug);
    return `/dashboard/onboarding?error=duplicate-slug&botSlug=${encodeURIComponent(botSlug)}&suggestedSlug=${encodeURIComponent(suggestedSlug)}`;
  }

  if (message.includes("already_onboarded")) {
    return "/dashboard";
  }

  if (message.includes("invalid") || message.includes("missing_required_fields")) {
    return "/dashboard/onboarding?error=validation";
  }

  return "/dashboard/onboarding?error=setup";
}
