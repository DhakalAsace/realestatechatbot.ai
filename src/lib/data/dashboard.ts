import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

export type WorkspaceRow = {
  id: string;
  name: string;
  slug: string;
};

export type AgentProfileRow = {
  id: string;
  workspace_id: string;
  display_name: string;
  brokerage_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  service_areas: string[];
  brand_color: string;
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
  theme: { brandColor?: string } | null;
};

export type LeadRow = {
  id: string;
  workspace_id: string;
  conversation_id: string;
  bot_id: string;
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
    return { user, workspace: null, profile: null, bots: [], leads: [] };
  }

  const [{ data: workspace }, { data: profile }, { data: bots }, { data: leads }] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id, name, slug")
      .eq("id", membership.workspace_id)
      .maybeSingle(),
    supabase
      .from("agent_profiles")
      .select("id, workspace_id, display_name, brokerage_name, email, phone, city, service_areas, brand_color")
      .eq("workspace_id", membership.workspace_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("bots")
      .select("id, workspace_id, agent_profile_id, name, slug, status, greeting, fallback_message, theme")
      .eq("workspace_id", membership.workspace_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("leads")
      .select("id, workspace_id, conversation_id, bot_id, status, temperature, name, email, phone, intent, score, location, timeframe, budget_min, budget_max, property_type, property_address, summary, created_at, updated_at")
      .eq("workspace_id", membership.workspace_id)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  return {
    user,
    workspace: workspace as WorkspaceRow | null,
    profile: profile as AgentProfileRow | null,
    bots: (bots ?? []) as BotRow[],
    leads: (leads ?? []) as LeadRow[],
  };
}

export async function getBotForDashboard(botId: string) {
  const context = await getDashboardContext();

  if (!context.workspace) return { ...context, bot: null };

  const supabase = await createServerSupabaseClient();
  const { data: bot } = await supabase
    .from("bots")
    .select("id, workspace_id, agent_profile_id, name, slug, status, greeting, fallback_message, theme")
    .eq("workspace_id", context.workspace.id)
    .eq("id", botId)
    .maybeSingle();

  return { ...context, bot: bot as BotRow | null };
}

export async function getLeadDetail(leadId: string) {
  const context = await getDashboardContext();

  if (!context.workspace) return { ...context, lead: null, messages: [] };

  const supabase = await createServerSupabaseClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, workspace_id, conversation_id, bot_id, status, temperature, name, email, phone, intent, score, location, timeframe, budget_min, budget_max, property_type, property_address, summary, created_at, updated_at")
    .eq("workspace_id", context.workspace.id)
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) return { ...context, lead: null, messages: [] };

  const { data: messages } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_type, content, created_at")
    .eq("workspace_id", context.workspace.id)
    .eq("conversation_id", lead.conversation_id)
    .order("created_at", { ascending: true });

  return {
    ...context,
    lead: lead as LeadRow,
    messages: (messages ?? []) as MessageRow[],
  };
}
