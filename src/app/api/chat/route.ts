import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { runChatTurn } from "@/lib/chat/flow";
import { summarizeLead } from "@/lib/chat/scoring";
import type { ChatState, LeadDraft } from "@/lib/chat/types";
import { checkRateLimit } from "@/lib/rate-limit";
import { createConversationSession, hashValue, parseConversationSession } from "@/lib/security";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  slug: z.string().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  sessionId: z.string().max(160).optional(),
  message: z.string().min(1).max(2000),
  sourceUrl: z.string().max(500).optional(),
});

type BotRecord = {
  id: string;
  workspace_id: string;
  agent_profile_id: string | null;
  name: string;
  slug: string;
  status: string;
  fallback_message: string;
};

type ChannelRecord = {
  id: string;
  workspace_id: string;
  bot_id: string;
  status: string;
  type: string;
};

type ConversationRecord = {
  id: string;
  workspace_id: string;
  bot_id: string;
  bot_channel_id: string;
  client_token_hash: string;
  current_state: ChatState | null;
};

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await safeJson(request));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid chat request." }, { status: 400 });
  }

  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const userAgent = headerStore.get("user-agent") ?? "unknown";
  const rate = checkRateLimit({
    key: `chat:${parsed.data.slug}:${hashValue(ip).slice(0, 16)}`,
    limit: 30,
    windowMs: 60_000,
  });

  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many messages. Please wait a moment and try again." }, { status: 429 });
  }

  let admin;
  try {
    admin = getSupabaseAdminClient();
  } catch {
    return NextResponse.json({ error: "Chat is not configured yet." }, { status: 503 });
  }

  const { data: bot } = await admin
    .from("bots")
    .select("id, workspace_id, agent_profile_id, name, slug, status, fallback_message")
    .eq("slug", parsed.data.slug)
    .maybeSingle<BotRecord>();

  if (!bot || bot.status !== "active") {
    return NextResponse.json({ error: "This bot is not available." }, { status: 404 });
  }

  const { data: channel } = await admin
    .from("bot_channels")
    .select("id, workspace_id, bot_id, status, type")
    .eq("workspace_id", bot.workspace_id)
    .eq("bot_id", bot.id)
    .eq("type", "hosted_link")
    .eq("status", "active")
    .maybeSingle<ChannelRecord>();

  if (!channel) {
    return NextResponse.json({ error: "This hosted channel is not active." }, { status: 404 });
  }

  const session = await getOrCreateConversation({
    bot,
    channel,
    ip,
    userAgent,
    sourceUrl: parsed.data.sourceUrl,
    sessionId: parsed.data.sessionId,
  });

  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const conversation = session.conversation;
  const result = runChatTurn(conversation.current_state, parsed.data.message);

  await admin.from("messages").insert({
    workspace_id: bot.workspace_id,
    conversation_id: conversation.id,
    sender_type: "visitor",
    content: parsed.data.message,
  });

  await admin.from("messages").insert({
    workspace_id: bot.workspace_id,
    conversation_id: conversation.id,
    sender_type: "bot",
    content: result.reply,
    content_json: { step: result.state.step, score: result.score },
  });

  await admin
    .from("conversations")
    .update({
      current_state: result.state,
      flow_type: result.lead.intent ?? "unknown",
      status: result.completed ? "needs_followup" : "open",
      last_message_at: new Date().toISOString(),
      completed_at: result.completed ? new Date().toISOString() : null,
    })
    .eq("id", conversation.id)
    .eq("bot_id", bot.id);

  await upsertLead({
    bot,
    conversationId: conversation.id,
    lead: result.lead,
    score: result.score,
    status: result.status,
    temperature: result.temperature,
  });

  return NextResponse.json({
    sessionId: session.sessionId,
    reply: result.reply,
    leadStatus: result.status,
    score: result.score,
  });
}

async function safeJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function getOrCreateConversation({
  bot,
  channel,
  ip,
  userAgent,
  sourceUrl,
  sessionId,
}: {
  bot: BotRecord;
  channel: ChannelRecord;
  ip: string;
  userAgent: string;
  sourceUrl?: string;
  sessionId?: string;
}): Promise<
  | { conversation: ConversationRecord; sessionId: string; error?: never; status?: never }
  | { error: string; status: number; conversation?: never; sessionId?: never }
> {
  const admin = getSupabaseAdminClient();

  if (sessionId) {
    const parsed = parseConversationSession(sessionId);

    if (!parsed) {
      return { error: "Invalid chat session.", status: 403 };
    }

    const { data: conversation } = await admin
      .from("conversations")
      .select("id, workspace_id, bot_id, bot_channel_id, client_token_hash, current_state")
      .eq("id", parsed.id)
      .eq("workspace_id", bot.workspace_id)
      .eq("bot_id", bot.id)
      .maybeSingle<ConversationRecord>();

    if (!conversation || conversation.client_token_hash !== parsed.tokenHash) {
      return { error: "Invalid chat session.", status: 403 };
    }

    return { conversation, sessionId };
  }

  const session = createConversationSession();
  const { data: conversation, error } = await admin
    .from("conversations")
    .insert({
      id: session.id,
      workspace_id: bot.workspace_id,
      bot_id: bot.id,
      bot_channel_id: channel.id,
      visitor_id: hashValue(`${ip}:${userAgent}`).slice(0, 32),
      client_token_hash: session.tokenHash,
      source_url: sourceUrl,
      visitor_ip_hash: hashValue(ip),
      user_agent: userAgent.slice(0, 300),
      current_state: { step: "intent", lead: {} },
    })
    .select("id, workspace_id, bot_id, bot_channel_id, client_token_hash, current_state")
    .single<ConversationRecord>();

  if (error || !conversation) {
    return { error: "Could not start chat session.", status: 500 };
  }

  return { conversation, sessionId: session.token };
}

async function upsertLead({
  bot,
  conversationId,
  lead,
  score,
  status,
  temperature,
}: {
  bot: BotRecord;
  conversationId: string;
  lead: LeadDraft;
  score: number;
  status: "new" | "qualified";
  temperature: "hot" | "warm" | "cold" | "unknown";
}) {
  const admin = getSupabaseAdminClient();

  await admin.from("leads").upsert(
    {
      workspace_id: bot.workspace_id,
      conversation_id: conversationId,
      bot_id: bot.id,
      agent_profile_id: bot.agent_profile_id,
      status,
      temperature,
      name: lead.name ?? null,
      email: lead.email ?? null,
      phone: lead.phone ?? null,
      intent: lead.intent ?? "unknown",
      budget_min: lead.budgetMin ?? null,
      budget_max: lead.budgetMax ?? null,
      location: lead.location ?? null,
      timeframe: lead.timeframe ?? null,
      property_type: lead.propertyType ?? null,
      property_address: lead.propertyAddress ?? null,
      pre_approved: lead.preApproved ?? null,
      wants_valuation: lead.wantsValuation ?? null,
      score,
      consent: Boolean(lead.email || lead.phone),
      consent_at: lead.email || lead.phone ? new Date().toISOString() : null,
      summary: summarizeLead(lead, score),
      metadata: { phase: 1 },
    },
    { onConflict: "workspace_id,conversation_id" },
  );
}
