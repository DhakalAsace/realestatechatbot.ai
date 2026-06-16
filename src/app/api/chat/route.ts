import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { AppointmentRequest } from "@/lib/appointments";
import { recordUsageEvent } from "@/lib/billing/entitlements";
import { runAiChatTurn, type AiTurnMetadata } from "@/lib/chat/ai";
import { runChatTurn } from "@/lib/chat/flow";
import { summarizeLead } from "@/lib/chat/scoring";
import { selectKnowledgeSnippets, selectPropertyCards, type KnowledgeSearchRow, type PropertyCard, type PropertySearchRow, type RetrievalContext } from "@/lib/chat/retrieval";
import type { ChatState } from "@/lib/chat/types";
import {
  buildAttribution,
  isChannelType,
  isPublicChannelKey,
  isSourceUrlAllowed,
  normalizeOrigin,
  type ChannelAttribution,
  type ChannelType,
} from "@/lib/channels";
import { sendAppointmentNotification, type AppointmentNotificationResult } from "@/lib/notifications";
import { checkChatAbuse, checkContentLength, readJsonWithByteLimit } from "@/lib/abuse";
import { createRouteLogger, requestIdFromHeaders } from "@/lib/observability";
import { checkRateLimit, reservePersistentRateLimit, type PersistentRateLimitClient } from "@/lib/rate-limit";
import { createConversationSession, hashValue, parseConversationSession, verifyWidgetChannelToken } from "@/lib/security";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const utmSchema = z
  .object({
    source: z.string().max(80).optional(),
    medium: z.string().max(80).optional(),
    campaign: z.string().max(120).optional(),
    content: z.string().max(120).optional(),
    term: z.string().max(120).optional(),
  })
  .optional();

const requestSchema = z
  .object({
    slug: z.string().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
    channelKey: z.string().max(80).optional(),
    widgetToken: z.string().max(1200).optional(),
    sessionId: z.string().max(160).optional(),
    message: z.string().min(1).max(2000),
    sourceUrl: z.string().max(500).optional(),
    referrer: z.string().max(500).optional(),
    utm: utmSchema,
  })
  .refine((value) => Boolean(value.slug || value.channelKey), { message: "slug or channelKey is required" });

type BotRecord = {
  id: string;
  workspace_id: string;
  agent_profile_id: string | null;
  name: string;
  slug: string;
  status: string;
  fallback_message: string;
  ai_enabled: boolean;
  ai_config: Record<string, unknown> | null;
  appointment_config: Record<string, unknown> | null;
};

type ChannelRecord = {
  id: string;
  workspace_id: string;
  bot_id: string;
  status: string;
  type: ChannelType;
  public_key: string;
  label: string;
  allowed_origins: string[] | null;
  source: string;
  medium: string;
  campaign: string | null;
  content: string | null;
};

type ConversationRecord = {
  id: string;
  workspace_id: string;
  bot_id: string;
  bot_channel_id: string;
  client_token_hash: string;
  current_state: ChatState | null;
};

type ResolvedBotChannel =
  | { bot: BotRecord; channel: ChannelRecord; attribution: ChannelAttribution; error?: never; status?: never }
  | { error: string; status: number; bot?: never; channel?: never; attribution?: never };

export async function POST(request: Request) {
  const startedAt = Date.now();
  const headerStore = await headers();
  const logger = createRouteLogger({ route: "api.chat", requestId: requestIdFromHeaders(headerStore), startedAt });
  const contentLength = checkContentLength(headerStore.get("content-length"));

  if (!contentLength.allowed) {
    logger.warn("chat_payload_rejected", { reason: contentLength.code });
    logger.done(contentLength.status);
    return NextResponse.json({ error: "Message is too large." }, { status: contentLength.status });
  }

  const body = await readJsonWithByteLimit(request);
  if (!body.ok) {
    logger.warn("chat_payload_rejected", { reason: body.code });
    logger.done(body.status);
    return NextResponse.json({ error: "Message is too large." }, { status: body.status });
  }

  const parsed = requestSchema.safeParse(body.value);

  if (!parsed.success) {
    logger.warn("chat_payload_rejected", { reason: "schema", issueCount: parsed.error.issues.length });
    logger.done(400);
    return NextResponse.json({ error: "Invalid chat request." }, { status: 400 });
  }

  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipHash = hashValue(ip);
  const userAgent = headerStore.get("user-agent") ?? "unknown";
  const localRate = checkRateLimit({
    key: `chat:local:${ipHash.slice(0, 16)}`,
    limit: 180,
    windowMs: 60_000,
  });

  if (!localRate.allowed) {
    logger.warn("chat_rate_limited", { scope: "local_ip" });
    logger.done(429);
    return NextResponse.json({ error: "Too many messages. Please wait a moment and try again." }, { status: 429 });
  }

  let admin;
  try {
    admin = getSupabaseAdminClient();
  } catch (error) {
    logger.error("chat_admin_client_unavailable", error);
    logger.done(503);
    return NextResponse.json({ error: "Chat is not configured yet." }, { status: 503 });
  }

  const globalLimit = await reservePublicLimit({
    admin,
    logger,
    key: `chat:global:${ipHash.slice(0, 24)}:minute`,
    limit: 300,
    windowSeconds: 60,
    scope: "global_ip",
  });
  if (globalLimit) return globalLimit;

  const resolved = await resolveBotChannel({
    admin,
    slug: parsed.data.slug,
    channelKey: parsed.data.channelKey,
    widgetToken: parsed.data.widgetToken,
    sourceUrl: parsed.data.sourceUrl,
    referrer: parsed.data.referrer,
    utm: parsed.data.utm,
  });

  if ("error" in resolved) {
    const status = resolved.status ?? 500;
    logger.warn("chat_channel_rejected", { status });
    logger.done(status);
    return NextResponse.json({ error: resolved.error }, { status });
  }

  const { bot, channel, attribution } = resolved;
  const abuse = checkChatAbuse(parsed.data.message);
  if (!abuse.allowed) {
    await recordAbuseEvent({
      admin,
      logger,
      route: "api.chat",
      reason: abuse.code,
      ipHash,
      workspaceId: bot.workspace_id,
      botId: bot.id,
      channelId: channel.id,
      metadata: { channelType: channel.type },
    });
    logger.warn("chat_abuse_blocked", { reason: abuse.code, workspaceId: bot.workspace_id, botId: bot.id, channelId: channel.id });
    logger.done(abuse.status);
    return NextResponse.json({ error: abuse.status === 413 ? "Message is too large." : "Message could not be accepted." }, { status: abuse.status });
  }

  const channelLimit = await reservePublicLimit({
    admin,
    logger,
    key: `chat:${bot.workspace_id}:${channel.id}:${ipHash.slice(0, 24)}:minute`,
    limit: 30,
    windowSeconds: 60,
    scope: "workspace_channel_ip",
  });
  if (channelLimit) return channelLimit;

  const session = await getOrCreateConversation({
    bot,
    channel,
    attribution,
    ip,
    userAgent,
    sessionId: parsed.data.sessionId,
  });

  if ("error" in session) {
    const status = session.status ?? 500;
    logger.warn("chat_session_rejected", { status, workspaceId: bot.workspace_id, botId: bot.id, channelId: channel.id });
    logger.done(status);
    return NextResponse.json({ error: session.error }, { status });
  }

  const conversation = session.conversation;
  const usageReservation = await recordUsageEvent(admin, {
    workspaceId: bot.workspace_id,
    eventType: "chat_turn",
    sourceType: "conversation",
    sourceId: conversation.id,
    idempotencyKey: `chat_turn:${conversation.id}:${Date.now()}:${hashValue(parsed.data.message).slice(0, 16)}`,
    metadata: { botId: bot.id, channelId: channel.id, channelType: channel.type },
  });

  if (!usageReservation.ok) {
    logger.error("chat_usage_write_failed", usageReservation.error ?? "unknown", { workspaceId: bot.workspace_id, botId: bot.id, channelId: channel.id });
    logger.done(500);
    return NextResponse.json({ error: "Could not save chat usage. Please try again." }, { status: 500 });
  }
  if (!usageReservation.allowed) {
    logger.warn("chat_usage_limit_blocked", { workspaceId: bot.workspace_id, botId: bot.id, channelId: channel.id });
    logger.done(402);
    return NextResponse.json({ error: "This assistant is temporarily unavailable. Please try again later." }, { status: 402 });
  }

  const deterministicResult = runChatTurn(conversation.current_state, parsed.data.message);
  const retrieval = await loadRetrievalContext({
    admin,
    bot,
    visitorMessage: parsed.data.message,
    lead: deterministicResult.lead,
  });
  let aiBot: BotRecord = bot;
  if (shouldMeterAiTurn(bot)) {
    const aiUsage = await recordUsageEvent(admin, {
      workspaceId: bot.workspace_id,
      eventType: "ai_message",
      sourceType: "conversation",
      sourceId: conversation.id,
      idempotencyKey: `ai_message:${conversation.id}:${Date.now()}:${hashValue(parsed.data.message).slice(0, 16)}`,
      metadata: { botId: bot.id, channelId: channel.id },
    });
    if (!aiUsage.ok) {
      logger.error("chat_ai_usage_write_failed", aiUsage.error ?? "unknown", { workspaceId: bot.workspace_id, botId: bot.id, channelId: channel.id });
      logger.done(500);
      return NextResponse.json({ error: "Could not save chat usage. Please try again." }, { status: 500 });
    }
    if (!aiUsage.allowed) {
      aiBot = { ...bot, ai_enabled: false };
    }
  }

  const turn = await runAiChatTurn({
    bot: aiBot,
    previousState: conversation.current_state,
    visitorMessage: parsed.data.message,
    deterministicResult,
    retrieval,
  });
  const result = turn.result;
  const persistence = await recordChatTurn({
    admin,
    bot,
    channel,
    attribution,
    conversationId: conversation.id,
    message: parsed.data.message,
    reply: result.reply,
    state: result.state,
    lead: result.lead,
    score: result.score,
    status: result.status,
    temperature: result.temperature,
    completed: result.completed,
    aiMetadata: turn.metadata,
    propertyCards: retrieval.propertyCards,
    appointmentRequest: result.appointmentRequest,
  });

  if (!persistence.ok) {
    if (session.created) {
      await admin.from("conversations").delete().eq("id", conversation.id).eq("workspace_id", bot.workspace_id);
    }

    logger.error("chat_persistence_failed", "record_chat_turn_failed", { workspaceId: bot.workspace_id, botId: bot.id, channelId: channel.id, conversationId: conversation.id });
    logger.done(500);
    return NextResponse.json({ error: "Could not save chat message. Please try again." }, { status: 500 });
  }

  const notification = await maybeSendAppointmentNotification({
    admin,
    workspaceId: bot.workspace_id,
    botName: bot.name,
    appointmentRequest: result.appointmentRequest,
    lead: result.lead,
    notificationEventId: persistence.notificationEventId,
    recipientEmail: persistence.recipientEmail,
    calendarUrl: persistence.calendarUrl,
  });

  logger.done(200, { workspaceId: bot.workspace_id, botId: bot.id, channelId: channel.id, channelType: channel.type, completed: result.completed, leadStatus: result.status });
  return NextResponse.json({
    sessionId: session.sessionId,
    reply: result.reply,
    leadStatus: result.status,
    score: result.score,
    propertyCards: retrieval.propertyCards.length > 0 ? retrieval.propertyCards : undefined,
    appointment: result.appointmentRequest && persistence.appointmentId ? {
      id: persistence.appointmentId,
      type: result.appointmentRequest.type,
      requestedWindow: result.appointmentRequest.requestedWindow,
      notificationStatus: notification?.status,
    } : undefined,
  });
}

type RouteLogger = ReturnType<typeof createRouteLogger>;

async function reservePublicLimit({
  admin,
  logger,
  key,
  limit,
  windowSeconds,
  scope,
}: {
  admin: ReturnType<typeof getSupabaseAdminClient>;
  logger: RouteLogger;
  key: string;
  limit: number;
  windowSeconds: number;
  scope: string;
}) {
  const result = await reservePersistentRateLimit(admin as unknown as PersistentRateLimitClient, { key, limit, windowSeconds });
  if (!result.ok) {
    logger.error("public_rate_limit_failed", result.error, { scope });
    logger.done(503);
    return NextResponse.json({ error: "Chat is temporarily unavailable. Please try again." }, { status: 503 });
  }

  if (!result.allowed) {
    logger.warn("public_rate_limit_blocked", { scope, resetAt: result.resetAt });
    logger.done(429);
    return NextResponse.json({ error: "Too many messages. Please wait a moment and try again." }, { status: 429 });
  }

  return null;
}

async function recordAbuseEvent({
  admin,
  logger,
  route,
  reason,
  ipHash,
  workspaceId,
  botId,
  channelId,
  metadata = {},
}: {
  admin: ReturnType<typeof getSupabaseAdminClient>;
  logger: RouteLogger;
  route: string;
  reason: string;
  ipHash: string;
  workspaceId?: string;
  botId?: string;
  channelId?: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await admin.from("abuse_events").insert({
    workspace_id: workspaceId ?? null,
    bot_id: botId ?? null,
    bot_channel_id: channelId ?? null,
    route,
    reason,
    ip_hash: ipHash,
    metadata,
  });

  if (error) {
    logger.warn("abuse_event_write_failed", { reason, error: error.message });
  }
}

function shouldMeterAiTurn(bot: BotRecord) {
  return Boolean(bot.ai_enabled && process.env.OPENAI_API_KEY && process.env.AI_CHAT_DISABLE_MODEL !== "1");
}

async function resolveBotChannel({
  admin,
  slug,
  channelKey,
  widgetToken,
  sourceUrl,
  referrer,
  utm,
}: {
  admin: ReturnType<typeof getSupabaseAdminClient>;
  slug?: string;
  channelKey?: string;
  widgetToken?: string;
  sourceUrl?: string;
  referrer?: string;
  utm?: z.infer<typeof utmSchema>;
}): Promise<ResolvedBotChannel> {
  if (channelKey) {
    if (!isPublicChannelKey(channelKey)) {
      return { error: "This channel is not available.", status: 404 };
    }

    const { data: channel } = await admin
      .from("bot_channels")
      .select("id, workspace_id, bot_id, status, type, public_key, label, allowed_origins, source, medium, campaign, content")
      .eq("public_key", channelKey)
      .maybeSingle<ChannelRecord>();

    if (!channel || channel.status !== "active" || !isChannelType(channel.type)) {
      return { error: "This channel is not available.", status: 404 };
    }

    const { data: bot } = await admin
      .from("bots")
      .select("id, workspace_id, agent_profile_id, name, slug, status, fallback_message, ai_enabled, ai_config, appointment_config")
      .eq("workspace_id", channel.workspace_id)
      .eq("id", channel.bot_id)
      .maybeSingle<BotRecord>();

    if (!bot || bot.status !== "active" || (slug && bot.slug !== slug)) {
      return { error: "This bot is not available.", status: 404 };
    }

    const attribution = buildAttribution({
      channelType: channel.type,
      channelSource: channel.source,
      channelMedium: channel.medium,
      channelCampaign: channel.campaign,
      channelContent: channel.content,
      sourceUrl,
      referrer,
      utm,
    });

    if (channel.type === "web_embed") {
      const widgetAccess = validateWidgetAccess({ channel, channelKey, sourceUrl: attribution.sourceUrl, widgetToken });
      if (!widgetAccess.ok) return widgetAccess;
    }

    return { bot, channel, attribution };
  }

  if (!slug) {
    return { error: "Invalid chat request.", status: 400 };
  }

  const { data: bot } = await admin
    .from("bots")
    .select("id, workspace_id, agent_profile_id, name, slug, status, fallback_message, ai_enabled, ai_config, appointment_config")
    .eq("slug", slug)
    .maybeSingle<BotRecord>();

  if (!bot || bot.status !== "active") {
    return { error: "This bot is not available.", status: 404 };
  }

  const { data: channel } = await admin
    .from("bot_channels")
    .select("id, workspace_id, bot_id, status, type, public_key, label, allowed_origins, source, medium, campaign, content")
    .eq("workspace_id", bot.workspace_id)
    .eq("bot_id", bot.id)
    .eq("type", "hosted_link")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<ChannelRecord>();

  if (!channel || !isChannelType(channel.type)) {
    return { error: "This hosted channel is not active.", status: 404 };
  }

  const attribution = buildAttribution({
    channelType: channel.type,
    channelSource: channel.source,
    channelMedium: channel.medium,
    channelCampaign: channel.campaign,
    channelContent: channel.content,
    sourceUrl,
    referrer,
    utm,
  });

  return { bot, channel, attribution };
}

function validateWidgetAccess({
  channel,
  channelKey,
  sourceUrl,
  widgetToken,
}: {
  channel: ChannelRecord;
  channelKey: string;
  sourceUrl: string | null;
  widgetToken?: string;
}): { ok: true } | { error: string; status: number; ok?: never } {
  const token = verifyWidgetChannelToken(widgetToken);
  if (!token || token.channelKey !== channelKey) {
    return { error: "This channel is not available.", status: 403 };
  }

  const sourceOrigin = normalizeOrigin(sourceUrl);
  if (token.origin === "*" || sourceOrigin !== token.origin) {
    return { error: "This channel is not available.", status: 403 };
  }

  if (!isSourceUrlAllowed(sourceUrl, channel.allowed_origins ?? [])) {
    return { error: "This channel is not available.", status: 403 };
  }

  return { ok: true };
}

async function loadRetrievalContext({
  admin,
  bot,
  visitorMessage,
  lead,
}: {
  admin: ReturnType<typeof getSupabaseAdminClient>;
  bot: BotRecord;
  visitorMessage: string;
  lead: Record<string, unknown>;
}): Promise<RetrievalContext> {
  const typedLead = lead as Parameters<typeof selectPropertyCards>[2];

  try {
    const [{ data: properties }, { data: knowledgeDocuments }] = await Promise.all([
      admin
        .from("properties")
        .select("id, title, property_type, price, address, city, area, bedrooms, bathrooms, description, highlights, image_url, listing_url")
        .eq("workspace_id", bot.workspace_id)
        .eq("bot_id", bot.id)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(50),
      admin
        .from("knowledge_documents")
        .select("id, title, kind, question, body, tags")
        .eq("workspace_id", bot.workspace_id)
        .eq("bot_id", bot.id)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(50),
    ]);

    return {
      propertyCards: selectPropertyCards((properties ?? []) as PropertySearchRow[], visitorMessage, typedLead),
      knowledgeSnippets: selectKnowledgeSnippets((knowledgeDocuments ?? []) as KnowledgeSearchRow[], visitorMessage),
    };
  } catch (error) {
    createRouteLogger({ route: "api.chat.retrieval" }).error("chat_retrieval_failed", error);
    return { propertyCards: [], knowledgeSnippets: [] };
  }
}

async function getOrCreateConversation({
  bot,
  channel,
  attribution,
  ip,
  userAgent,
  sessionId,
}: {
  bot: BotRecord;
  channel: ChannelRecord;
  attribution: ChannelAttribution;
  ip: string;
  userAgent: string;
  sessionId?: string;
}): Promise<
  | { conversation: ConversationRecord; sessionId: string; created: boolean; error?: never; status?: never }
  | { error: string; status: number; conversation?: never; sessionId?: never; created?: never }
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

    if (!conversation || conversation.client_token_hash !== parsed.tokenHash || conversation.bot_channel_id !== channel.id) {
      return { error: "Invalid chat session.", status: 403 };
    }

    return { conversation, sessionId, created: false };
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
      source_url: attribution.sourceUrl,
      referrer: attribution.referrer,
      source: attribution.source,
      medium: attribution.medium,
      campaign: attribution.campaign,
      content: attribution.content,
      term: attribution.term,
      visitor_ip_hash: hashValue(ip),
      user_agent: userAgent.slice(0, 300),
      current_state: { step: "intent", lead: {} },
      metadata: {
        channel: { publicKey: channel.public_key, type: channel.type, label: channel.label },
        attribution,
      },
    })
    .select("id, workspace_id, bot_id, bot_channel_id, client_token_hash, current_state")
    .single<ConversationRecord>();

  if (error || !conversation) {
    return { error: "Could not start chat session.", status: 500 };
  }

  return { conversation, sessionId: session.token, created: true };
}

async function recordChatTurn({
  admin,
  bot,
  channel,
  attribution,
  conversationId,
  message,
  reply,
  state,
  lead,
  score,
  status,
  temperature,
  completed,
  aiMetadata,
  propertyCards,
  appointmentRequest,
}: {
  admin: ReturnType<typeof getSupabaseAdminClient>;
  bot: BotRecord;
  channel: ChannelRecord;
  attribution: ChannelAttribution;
  conversationId: string;
  message: string;
  reply: string;
  state: ChatState;
  lead: Record<string, unknown>;
  score: number;
  status: "new" | "qualified";
  temperature: "hot" | "warm" | "cold" | "unknown";
  completed: boolean;
  aiMetadata: AiTurnMetadata;
  propertyCards: PropertyCard[];
  appointmentRequest?: AppointmentRequest;
}) {
  const hasContact = Boolean(lead.email || lead.phone);
  const appointmentIdempotencyKey = appointmentRequest
    ? hashValue(`${conversationId}:${appointmentRequest.type}:${appointmentRequest.requestedWindow}:${appointmentRequest.notes ?? ""}`)
    : null;
  const { data, error } = await admin.rpc("record_chat_turn_with_appointment", {
    p_workspace_id: bot.workspace_id,
    p_bot_id: bot.id,
    p_bot_channel_id: channel.id,
    p_conversation_id: conversationId,
    p_visitor_message: message,
    p_bot_reply: reply,
    p_bot_message_json: {
      phase: appointmentRequest ? 5 : 3,
      step: state.step,
      score,
      channel: { publicKey: channel.public_key, type: channel.type, label: channel.label },
      ai: aiMetadata,
      retrieval: aiMetadata.retrieval,
      propertyCards,
      safetyFlags: aiMetadata.safetyFlags,
    },
    p_current_state: state,
    p_flow_type: lead.intent ?? "unknown",
    p_conversation_status: completed ? "needs_followup" : "open",
    p_completed_at: completed ? new Date().toISOString() : null,
    p_agent_profile_id: bot.agent_profile_id,
    p_lead: hasContact ? JSON.parse(JSON.stringify(lead)) : null,
    p_lead_status: hasContact ? status : null,
    p_lead_temperature: hasContact ? temperature : null,
    p_score: hasContact ? score : null,
    p_source_type: channel.type,
    p_source_label: channel.label,
    p_source: attribution.source,
    p_medium: attribution.medium,
    p_campaign: attribution.campaign,
    p_content: attribution.content,
    p_term: attribution.term,
    p_source_url: attribution.sourceUrl,
    p_referrer: attribution.referrer,
    p_summary: hasContact ? summarizeLead(lead, score) : null,
    p_appointment_request_type: appointmentRequest?.type ?? null,
    p_appointment_preferred_time_text: appointmentRequest?.requestedWindow ?? null,
    p_appointment_notes: appointmentRequest?.notes ?? null,
    p_appointment_idempotency_key: appointmentIdempotencyKey,
  });

  if (error) {
    createRouteLogger({ route: "api.chat.persistence" }).error("record_chat_turn_with_appointment_failed", error.message);
    return { ok: false as const };
  }

  const payload = normalizePersistencePayload(data);
  return { ok: true as const, ...payload };
}

async function maybeSendAppointmentNotification({
  admin,
  workspaceId,
  botName,
  appointmentRequest,
  lead,
  notificationEventId,
  recipientEmail,
  calendarUrl,
}: {
  admin: ReturnType<typeof getSupabaseAdminClient>;
  workspaceId: string;
  botName: string;
  appointmentRequest?: AppointmentRequest;
  lead: Record<string, unknown>;
  notificationEventId?: string | null;
  recipientEmail?: string | null;
  calendarUrl?: string | null;
}) {
  if (!appointmentRequest || !notificationEventId) return null;

  const result = await sendAppointmentNotification({
    appointment: appointmentRequest,
    lead,
    recipientEmail,
    botName,
    calendarUrl,
  });
  await updateNotificationEvent({ admin, workspaceId, notificationEventId, result });

  return result;
}

async function updateNotificationEvent({
  admin,
  workspaceId,
  notificationEventId,
  result,
}: {
  admin: ReturnType<typeof getSupabaseAdminClient>;
  workspaceId: string;
  notificationEventId: string;
  result: AppointmentNotificationResult;
}) {
  const now = new Date().toISOString();
  const update =
    result.status === "sent"
      ? { status: "sent", provider_message_id: result.providerId ?? null, sent_at: now, attempt_count: 1 }
      : result.status === "failed"
        ? { status: "failed", failed_at: now, error_code: result.reason, error_message: result.reason, attempt_count: 1 }
        : { status: "skipped", error_code: result.reason, error_message: result.reason, attempt_count: 1 };

  const { error } = await admin
    .from("notification_events")
    .update(update)
    .eq("id", notificationEventId)
    .eq("workspace_id", workspaceId);

  if (error) {
    createRouteLogger({ route: "api.chat.notification" }).error("notification_event_update_failed", error.message);
  }
}

function normalizePersistencePayload(data: unknown) {
  if (!data || typeof data !== "object") {
    return { appointmentId: null, notificationEventId: null, recipientEmail: null, calendarUrl: null };
  }

  const value = data as Record<string, unknown>;
  return {
    appointmentId: typeof value.appointmentId === "string" ? value.appointmentId : null,
    notificationEventId: typeof value.notificationEventId === "string" ? value.notificationEventId : null,
    recipientEmail: typeof value.recipientEmail === "string" ? value.recipientEmail : null,
    calendarUrl: typeof value.calendarUrl === "string" ? value.calendarUrl : null,
  };
}
