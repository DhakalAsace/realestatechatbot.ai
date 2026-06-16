import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import type { ChannelStatus, ChannelType } from "@/lib/channels";
import { getWorkspaceBillingSummary, type BillingSummary } from "@/lib/billing/entitlements";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type WorkspaceRow = {
  id: string;
  name: string;
  slug: string;
};

export type WorkspaceRole = "owner" | "admin" | "agent" | "viewer" | "member";

export type WorkspaceMemberRow = {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkspaceInvitationRow = {
  id: string;
  workspace_id: string;
  email: string;
  role: "admin" | "agent" | "viewer";
  status: "pending" | "accepted" | "revoked" | "expired";
  invited_by: string;
  accepted_by: string | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type AuditEventRow = {
  id: string;
  workspace_id: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  action: string;
  subject_type: string;
  subject_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AgentProfileRow = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  display_name: string;
  brokerage_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  service_areas: string[];
  brand_color: string;
  calendar_url: string | null;
  profile_type: "agent" | "team";
  status: "active" | "archived";
};

export type BotRow = {
  id: string;
  workspace_id: string;
  agent_profile_id: string | null;
  name: string;
  slug: string;
  status: "draft" | "active" | "paused" | "archived";
  greeting: string;
  fallback_message: string;
  ai_enabled: boolean;
  ai_config: Record<string, unknown> | null;
  appointment_config: { calendarUrl?: string } | null;
  theme: { brandColor?: string } | null;
};

export type ChannelRow = {
  id: string;
  workspace_id: string;
  bot_id: string;
  type: ChannelType;
  status: ChannelStatus;
  public_key: string;
  label: string;
  allowed_origins: string[];
  source: string;
  medium: string;
  campaign: string | null;
  content: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type LeadRow = {
  id: string;
  workspace_id: string;
  conversation_id: string;
  bot_id: string;
  bot_channel_id: string | null;
  agent_profile_id: string | null;
  assigned_agent_profile_id: string | null;
  assigned_at: string | null;
  assigned_by: string | null;
  status: "new" | "qualified" | "contacted" | "converted" | "lost" | "spam";
  temperature: "hot" | "warm" | "cold" | "unknown";
  name: string | null;
  email: string | null;
  phone: string | null;
  intent: "buyer" | "seller" | "unknown";
  score: number;
  location: string | null;
  timeframe: string | null;
  budget_min: number | null;
  budget_max: number | null;
  property_type: string | null;
  property_address: string | null;
  summary: string | null;
  source_type: ChannelType | null;
  source_label: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  source_url: string | null;
  referrer: string | null;
  created_at: string;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_type: "visitor" | "bot" | "agent" | "system";
  content: string;
  created_at: string;
};

export type PropertyRow = {
  id: string;
  workspace_id: string;
  bot_id: string;
  status: "draft" | "active" | "archived";
  title: string;
  property_type: string | null;
  price: number | null;
  address: string | null;
  city: string | null;
  area: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  description: string | null;
  highlights: string[];
  image_url: string | null;
  listing_url: string | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgeDocumentRow = {
  id: string;
  workspace_id: string;
  bot_id: string;
  status: "draft" | "active" | "archived";
  kind: "faq" | "note";
  title: string;
  question: string | null;
  body: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type AppointmentRow = {
  id: string;
  workspace_id: string;
  lead_id: string;
  conversation_id: string;
  bot_id: string;
  bot_channel_id: string;
  agent_profile_id: string | null;
  assigned_agent_profile_id: string | null;
  request_type: "buyer_consultation" | "seller_valuation" | "showing" | "general_followup";
  status: "requested" | "acknowledged" | "confirmed" | "declined" | "cancelled" | "completed";
  preferred_time_text: string;
  timezone: string;
  visitor_notes: string | null;
  agent_notes: string | null;
  calendar_url: string | null;
  requested_at: string;
  created_at: string;
  updated_at: string;
  lead?: Pick<LeadRow, "id" | "name" | "email" | "phone" | "intent" | "location" | "property_address" | "score"> | Pick<LeadRow, "id" | "name" | "email" | "phone" | "intent" | "location" | "property_address" | "score">[] | null;
  notification_events?: NotificationEventRow[];
};

export type NotificationEventRow = {
  id: string;
  workspace_id: string;
  appointment_id: string | null;
  lead_id: string | null;
  follow_up_state_id?: string | null;
  follow_up_message_id?: string | null;
  event_type?: string;
  status: "pending" | "sent" | "failed" | "skipped";
  recipient_email: string | null;
  provider: string;
  provider_message_id: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type FollowUpSequenceRow = {
  id: string;
  workspace_id: string;
  bot_id: string;
  name: string;
  default_key: "buyer_no_booking" | "seller_valuation" | "showing_request";
  trigger_type: "buyer_no_booking" | "seller_valuation" | "showing_request";
  status: "draft" | "active" | "paused" | "archived";
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type FollowUpMessageRow = {
  id: string;
  workspace_id: string;
  sequence_id: string;
  step_index: number;
  delay_minutes: number;
  status: "draft" | "active" | "paused" | "archived";
  subject_template: string;
  body_template: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type LeadEmailPreferenceRow = {
  id: string;
  workspace_id: string;
  lead_id: string | null;
  email: string;
  status: "pending" | "opted_in" | "unsubscribed";
  consent_source: string | null;
  consent_text_version: string | null;
  consented_at: string | null;
  unsubscribed_at: string | null;
  unsubscribe_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type LeadFollowUpStateRow = {
  id: string;
  workspace_id: string;
  lead_id: string;
  sequence_id: string;
  current_message_id: string | null;
  status: "scheduled" | "processing" | "pending_consent" | "paused" | "completed" | "skipped" | "failed" | "unsubscribed";
  next_send_at: string | null;
  attempt_count: number;
  max_attempts: number;
  last_notification_event_id: string | null;
  errors: unknown;
  idempotency_key: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type BillingCustomerRow = {
  id: string;
  workspace_id: string;
  stripe_customer_id: string;
  email: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SubscriptionRow = {
  id: string;
  workspace_id: string;
  billing_customer_id: string | null;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  plan_key: "free" | "starter" | "pro";
  status: "incomplete" | "incomplete_expired" | "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "paused" | "inactive";
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  trial_end: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type UsageEventRow = {
  id: string;
  workspace_id: string;
  event_type: string;
  quantity: number;
  source_type: string | null;
  source_id: string | null;
  idempotency_key: string;
  occurred_at: string;
  period_start: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function getDashboardContext() {
  const user = await requireUser();
  const supabase = await createServerSupabaseClient();

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return { user, membership: null, workspace: null, profile: null, agentProfiles: [], bots: [], channels: [], leads: [], appointments: [] };
  }

  const [{ data: workspace }, { data: agentProfiles }, { data: bots }, { data: leads }] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id, name, slug")
      .eq("id", membership.workspace_id)
      .maybeSingle(),
    supabase
      .from("agent_profiles")
      .select("id, workspace_id, user_id, display_name, brokerage_name, email, phone, city, service_areas, brand_color, calendar_url, profile_type, status")
      .eq("workspace_id", membership.workspace_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("bots")
      .select("id, workspace_id, agent_profile_id, name, slug, status, greeting, fallback_message, ai_enabled, ai_config, appointment_config, theme")
      .eq("workspace_id", membership.workspace_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("leads")
      .select("id, workspace_id, conversation_id, bot_id, bot_channel_id, agent_profile_id, assigned_agent_profile_id, assigned_at, assigned_by, status, temperature, name, email, phone, intent, score, location, timeframe, budget_min, budget_max, property_type, property_address, summary, source_type, source_label, source, medium, campaign, content, term, source_url, referrer, created_at, updated_at")
      .eq("workspace_id", membership.workspace_id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const profile = agentProfiles?.[0] ?? null;

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, workspace_id, lead_id, conversation_id, bot_id, bot_channel_id, agent_profile_id, assigned_agent_profile_id, request_type, status, preferred_time_text, timezone, visitor_notes, agent_notes, calendar_url, requested_at, created_at, updated_at, lead:leads(id, name, email, phone, intent, location, property_address, score), notification_events(id, workspace_id, appointment_id, lead_id, status, recipient_email, provider, provider_message_id, error_code, error_message, created_at, updated_at)")
    .eq("workspace_id", membership.workspace_id)
    .order("requested_at", { ascending: false })
    .limit(100);

  const { data: channels } = await supabase
    .from("bot_channels")
    .select("id, workspace_id, bot_id, type, status, public_key, label, allowed_origins, source, medium, campaign, content, settings, created_at, updated_at")
    .eq("workspace_id", membership.workspace_id)
    .order("created_at", { ascending: true });

  return {
    user,
    membership: membership as { workspace_id: string; role: WorkspaceRole },
    workspace: workspace as WorkspaceRow | null,
    profile: profile as AgentProfileRow | null,
    agentProfiles: (agentProfiles ?? []) as AgentProfileRow[],
    bots: (bots ?? []) as BotRow[],
    channels: (channels ?? []) as ChannelRow[],
    leads: (leads ?? []) as LeadRow[],
    appointments: (appointments ?? []) as AppointmentRow[],
  };
}

export async function getBotForDashboard(botId: string) {
  const context = await getDashboardContext();

  if (!context.workspace) return { ...context, bot: null };

  const supabase = await createServerSupabaseClient();
  const { data: bot } = await supabase
    .from("bots")
    .select("id, workspace_id, agent_profile_id, name, slug, status, greeting, fallback_message, ai_enabled, ai_config, appointment_config, theme")
    .eq("workspace_id", context.workspace.id)
    .eq("id", botId)
    .maybeSingle();

  return { ...context, bot: bot as BotRow | null };
}

export async function getLeadDetail(leadId: string) {
  const context = await getDashboardContext();

  if (!context.workspace) return { ...context, lead: null, messages: [], appointments: [], emailPreference: null, followUpStates: [] };

  const supabase = await createServerSupabaseClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, workspace_id, conversation_id, bot_id, bot_channel_id, agent_profile_id, assigned_agent_profile_id, assigned_at, assigned_by, status, temperature, name, email, phone, intent, score, location, timeframe, budget_min, budget_max, property_type, property_address, summary, source_type, source_label, source, medium, campaign, content, term, source_url, referrer, created_at, updated_at")
    .eq("workspace_id", context.workspace.id)
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) return { ...context, lead: null, messages: [], appointments: [], emailPreference: null, followUpStates: [] };

  const leadEmail = typeof lead.email === "string" ? lead.email.toLowerCase() : null;
  const [{ data: messages }, { data: appointments }, { data: emailPreference }, { data: followUpStates }] = await Promise.all([
    supabase
      .from("messages")
      .select("id, conversation_id, sender_type, content, created_at")
      .eq("workspace_id", context.workspace.id)
      .eq("conversation_id", lead.conversation_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("appointments")
      .select("id, workspace_id, lead_id, conversation_id, bot_id, bot_channel_id, agent_profile_id, assigned_agent_profile_id, request_type, status, preferred_time_text, timezone, visitor_notes, agent_notes, calendar_url, requested_at, created_at, updated_at, notification_events(id, workspace_id, appointment_id, lead_id, status, recipient_email, provider, provider_message_id, error_code, error_message, created_at, updated_at)")
      .eq("workspace_id", context.workspace.id)
      .eq("lead_id", lead.id)
      .order("requested_at", { ascending: false }),
    leadEmail
      ? supabase
          .from("lead_email_preferences")
          .select("id, workspace_id, lead_id, email, status, consent_source, consent_text_version, consented_at, unsubscribed_at, unsubscribe_reason, metadata, created_at, updated_at")
          .eq("workspace_id", context.workspace.id)
          .eq("email", leadEmail)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("lead_follow_up_state")
      .select("id, workspace_id, lead_id, sequence_id, current_message_id, status, next_send_at, attempt_count, max_attempts, last_notification_event_id, errors, idempotency_key, metadata, created_at, updated_at")
      .eq("workspace_id", context.workspace.id)
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false }),
  ]);

  return {
    ...context,
    lead: lead as LeadRow,
    messages: (messages ?? []) as MessageRow[],
    appointments: (appointments ?? []) as AppointmentRow[],
    emailPreference: emailPreference as LeadEmailPreferenceRow | null,
    followUpStates: (followUpStates ?? []) as LeadFollowUpStateRow[],
  };
}

export async function getLibraryContext() {
  const context = await getDashboardContext();

  if (!context.workspace) return { ...context, properties: [], knowledgeDocuments: [] };

  const supabase = await createServerSupabaseClient();
  const [{ data: properties }, { data: knowledgeDocuments }] = await Promise.all([
    supabase
      .from("properties")
      .select("id, workspace_id, bot_id, status, title, property_type, price, address, city, area, bedrooms, bathrooms, description, highlights, image_url, listing_url, created_at, updated_at")
      .eq("workspace_id", context.workspace.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("knowledge_documents")
      .select("id, workspace_id, bot_id, status, kind, title, question, body, tags, created_at, updated_at")
      .eq("workspace_id", context.workspace.id)
      .order("updated_at", { ascending: false }),
  ]);

  return {
    ...context,
    properties: (properties ?? []) as PropertyRow[],
    knowledgeDocuments: (knowledgeDocuments ?? []) as KnowledgeDocumentRow[],
  };
}

export async function getAppointmentsContext() {
  const context = await getDashboardContext();
  return context;
}

export async function getFollowUpsContext() {
  const context = await getDashboardContext();

  if (!context.workspace) {
    return { ...context, followUpSequences: [], followUpMessages: [], leadEmailPreferences: [], followUpStates: [], followUpEvents: [] };
  }

  const supabase = await createServerSupabaseClient();
  const [{ data: followUpSequences }, { data: followUpMessages }, { data: leadEmailPreferences }, { data: followUpStates }, { data: followUpEvents }] = await Promise.all([
    supabase
      .from("follow_up_sequences")
      .select("id, workspace_id, bot_id, name, default_key, trigger_type, status, description, metadata, created_at, updated_at")
      .eq("workspace_id", context.workspace.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("follow_up_messages")
      .select("id, workspace_id, sequence_id, step_index, delay_minutes, status, subject_template, body_template, metadata, created_at, updated_at")
      .eq("workspace_id", context.workspace.id)
      .order("step_index", { ascending: true }),
    supabase
      .from("lead_email_preferences")
      .select("id, workspace_id, lead_id, email, status, consent_source, consent_text_version, consented_at, unsubscribed_at, unsubscribe_reason, metadata, created_at, updated_at")
      .eq("workspace_id", context.workspace.id)
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("lead_follow_up_state")
      .select("id, workspace_id, lead_id, sequence_id, current_message_id, status, next_send_at, attempt_count, max_attempts, last_notification_event_id, errors, idempotency_key, metadata, created_at, updated_at")
      .eq("workspace_id", context.workspace.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("notification_events")
      .select("id, workspace_id, appointment_id, lead_id, follow_up_state_id, follow_up_message_id, event_type, status, recipient_email, provider, provider_message_id, error_code, error_message, created_at, updated_at")
      .eq("workspace_id", context.workspace.id)
      .eq("event_type", "follow_up_email")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return {
    ...context,
    followUpSequences: (followUpSequences ?? []) as FollowUpSequenceRow[],
    followUpMessages: (followUpMessages ?? []) as FollowUpMessageRow[],
    leadEmailPreferences: (leadEmailPreferences ?? []) as LeadEmailPreferenceRow[],
    followUpStates: (followUpStates ?? []) as LeadFollowUpStateRow[],
    followUpEvents: (followUpEvents ?? []) as NotificationEventRow[],
  };
}


export async function getBillingContext() {
  const context = await getDashboardContext();

  if (!context.workspace) {
    return { ...context, billingSummary: null as BillingSummary | null, billingCustomer: null, subscriptions: [], usageEvents: [] };
  }

  const supabase = await createServerSupabaseClient();
  const admin = getSupabaseAdminClient();
  const [{ data: billingCustomer }, { data: subscriptions }, { data: usageEvents }, billingSummary] = await Promise.all([
    supabase
      .from("billing_customers")
      .select("id, workspace_id, stripe_customer_id, email, metadata, created_at, updated_at")
      .eq("workspace_id", context.workspace.id)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("id, workspace_id, billing_customer_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_product_id, plan_key, status, current_period_start, current_period_end, cancel_at_period_end, canceled_at, trial_end, metadata, created_at, updated_at")
      .eq("workspace_id", context.workspace.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("usage_events")
      .select("id, workspace_id, event_type, quantity, source_type, source_id, idempotency_key, occurred_at, period_start, metadata, created_at")
      .eq("workspace_id", context.workspace.id)
      .order("occurred_at", { ascending: false })
      .limit(50),
    getWorkspaceBillingSummary(admin, context.workspace.id),
  ]);

  return {
    ...context,
    billingSummary,
    billingCustomer: billingCustomer as BillingCustomerRow | null,
    subscriptions: (subscriptions ?? []) as SubscriptionRow[],
    usageEvents: (usageEvents ?? []) as UsageEventRow[],
  };
}


export async function getTeamContext() {
  const context = await getDashboardContext();

  if (!context.workspace) {
    return { ...context, members: [], invitations: [], auditEvents: [] };
  }

  const supabase = await createServerSupabaseClient();
  const [{ data: members }, { data: invitations }, { data: auditEvents }] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("workspace_id, user_id, role, invited_by, created_at, updated_at")
      .eq("workspace_id", context.workspace.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("workspace_invitations")
      .select("id, workspace_id, email, role, status, invited_by, accepted_by, accepted_at, expires_at, created_at, updated_at")
      .eq("workspace_id", context.workspace.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("audit_events")
      .select("id, workspace_id, actor_user_id, target_user_id, action, subject_type, subject_id, metadata, created_at")
      .eq("workspace_id", context.workspace.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return {
    ...context,
    members: (members ?? []) as WorkspaceMemberRow[],
    invitations: (invitations ?? []) as WorkspaceInvitationRow[],
    auditEvents: (auditEvents ?? []) as AuditEventRow[],
  };
}
