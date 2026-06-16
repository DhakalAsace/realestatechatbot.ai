import { isChannelType, isPublicChannelKey, isSourceUrlAllowed, normalizeOrigin } from "@/lib/channels";
import { createRouteLogger, requestIdFromHeaders } from "@/lib/observability";
import { checkRateLimit, reservePersistentRateLimit, type PersistentRateLimitClient } from "@/lib/rate-limit";
import { createWidgetChannelToken, hashValue } from "@/lib/security";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type WidgetChannel = {
  id: string;
  workspace_id: string;
  bot_id: string;
  status: string;
  type: string;
  public_key: string;
  allowed_origins: string[] | null;
};

type WidgetBot = {
  id: string;
  workspace_id: string;
  status: string;
  theme: { brandColor?: string } | null;
};

export async function GET(request: Request) {
  const startedAt = Date.now();
  const logger = createRouteLogger({ route: "widget.js", requestId: requestIdFromHeaders(request.headers), startedAt });
  const url = new URL(request.url);
  const channelKey = url.searchParams.get("channel") ?? "";
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipHash = hashValue(ip);
  const localRate = checkRateLimit({ key: `widget:local:${ipHash.slice(0, 16)}`, limit: 240, windowMs: 60_000 });

  if (!localRate.allowed) {
    logger.warn("widget_rate_limited", { scope: "local_ip" });
    logger.done(429);
    return javascriptResponse("console.warn('RealEstateChatbot.ai widget: too many requests.');", 429);
  }

  if (!isPublicChannelKey(channelKey)) {
    logger.warn("widget_invalid_channel_key");
    logger.done(400);
    return javascriptResponse("console.warn('RealEstateChatbot.ai widget: invalid channel key.');", 400);
  }

  let admin;
  try {
    admin = getSupabaseAdminClient();
  } catch (error) {
    logger.error("widget_admin_client_unavailable", error);
    logger.done(503);
    return javascriptResponse("console.warn('RealEstateChatbot.ai widget: chat is not configured.');", 503);
  }

  const globalLimit = await reserveWidgetLimit({ admin, logger, key: `widget:global:${ipHash.slice(0, 24)}:minute`, limit: 240, windowSeconds: 60, scope: "global_ip" });
  if (globalLimit) return globalLimit;

  const { data: channel } = await admin
    .from("bot_channels")
    .select("id, workspace_id, bot_id, status, type, public_key, allowed_origins")
    .eq("public_key", channelKey)
    .maybeSingle<WidgetChannel>();

  if (!channel || channel.status !== "active" || !isChannelType(channel.type) || channel.type !== "web_embed") {
    logger.warn("widget_channel_unavailable");
    logger.done(404);
    return javascriptResponse("console.warn('RealEstateChatbot.ai widget: channel unavailable.');", 404);
  }

  const channelLimit = await reserveWidgetLimit({ admin, logger, key: `widget:${channel.workspace_id}:${channel.id}:${ipHash.slice(0, 24)}:minute`, limit: 60, windowSeconds: 60, scope: "workspace_channel_ip" });
  if (channelLimit) return channelLimit;

  const requestOrigin = getTrustedRequestOrigin(request);
  const allowedOrigins = channel.allowed_origins ?? [];
  if (!requestOrigin || !isSourceUrlAllowed(requestOrigin, allowedOrigins)) {
    logger.warn("widget_origin_rejected", { channelId: channel.id, workspaceId: channel.workspace_id });
    logger.done(403);
    return javascriptResponse("console.warn('RealEstateChatbot.ai widget: origin is not allowed for this channel.');", 403);
  }

  const { data: bot } = await admin
    .from("bots")
    .select("id, workspace_id, status, theme")
    .eq("workspace_id", channel.workspace_id)
    .eq("id", channel.bot_id)
    .maybeSingle<WidgetBot>();

  if (!bot || bot.status !== "active") {
    logger.warn("widget_bot_unavailable", { channelId: channel.id, workspaceId: channel.workspace_id });
    logger.done(404);
    return javascriptResponse("console.warn('RealEstateChatbot.ai widget: bot unavailable.');", 404);
  }

  const brandColor = normalizeBrandColor(bot.theme?.brandColor);
  const widgetToken = createWidgetChannelToken({ channelKey, origin: requestOrigin });
  const script = `
(() => {
  const appOrigin = ${JSON.stringify(url.origin)};
  const channelKey = ${JSON.stringify(channelKey)};
  const widgetToken = ${JSON.stringify(widgetToken)};
  const brandColor = ${JSON.stringify(brandColor)};
  const loadedKey = "__realestatechatbot_" + channelKey;

  if (window[loadedKey]) return;
  window[loadedKey] = true;

  const root = document.createElement("div");
  root.setAttribute("data-realestatechatbot", channelKey);
  root.style.position = "fixed";
  root.style.right = "20px";
  root.style.bottom = "20px";
  root.style.zIndex = "2147483000";
  root.style.fontFamily = "Arial, sans-serif";

  const frame = document.createElement("iframe");
  const params = new URLSearchParams();
  params.set("token", widgetToken);
  params.set("parentUrl", window.location.href);
  if (document.referrer) params.set("referrer", document.referrer);
  const current = new URLSearchParams(window.location.search);
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((key) => {
    const value = current.get(key);
    if (value) params.set(key, value);
  });
  frame.src = appOrigin + "/embed/" + channelKey + "?" + params.toString();
  frame.title = "Real estate chat assistant";
  frame.style.display = "none";
  frame.style.width = "min(420px, calc(100vw - 32px))";
  frame.style.height = "min(720px, calc(100vh - 96px))";
  frame.style.border = "0";
  frame.style.borderRadius = "10px";
  frame.style.boxShadow = "0 16px 48px rgba(22, 32, 24, 0.22)";
  frame.style.background = "#fff";

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Chat";
  button.setAttribute("aria-label", "Open real estate chat");
  button.style.marginTop = "10px";
  button.style.marginLeft = "auto";
  button.style.display = "block";
  button.style.border = "0";
  button.style.borderRadius = "999px";
  button.style.background = brandColor;
  button.style.color = "#fff";
  button.style.fontWeight = "700";
  button.style.fontSize = "15px";
  button.style.lineHeight = "1";
  button.style.padding = "14px 18px";
  button.style.cursor = "pointer";
  button.style.boxShadow = "0 10px 30px rgba(22, 32, 24, 0.2)";

  button.addEventListener("click", () => {
    const open = frame.style.display === "block";
    frame.style.display = open ? "none" : "block";
    button.textContent = open ? "Chat" : "Close";
    button.setAttribute("aria-label", open ? "Open real estate chat" : "Close real estate chat");
  });

  root.appendChild(frame);
  root.appendChild(button);
  document.body.appendChild(root);
})();
`.trim();

  logger.done(200, { workspaceId: channel.workspace_id, botId: bot.id, channelId: channel.id });
  return javascriptResponse(script, 200);
}

async function reserveWidgetLimit({
  admin,
  logger,
  key,
  limit,
  windowSeconds,
  scope,
}: {
  admin: ReturnType<typeof getSupabaseAdminClient>;
  logger: ReturnType<typeof createRouteLogger>;
  key: string;
  limit: number;
  windowSeconds: number;
  scope: string;
}) {
  const result = await reservePersistentRateLimit(admin as unknown as PersistentRateLimitClient, { key, limit, windowSeconds });
  if (!result.ok) {
    logger.error("widget_rate_limit_failed", result.error, { scope });
    logger.done(503);
    return javascriptResponse("console.warn('RealEstateChatbot.ai widget: temporarily unavailable.');", 503);
  }

  if (!result.allowed) {
    logger.warn("widget_rate_limited", { scope, resetAt: result.resetAt });
    logger.done(429);
    return javascriptResponse("console.warn('RealEstateChatbot.ai widget: too many requests.');", 429);
  }

  return null;
}

function getTrustedRequestOrigin(request: Request) {
  return normalizeOrigin(request.headers.get("origin")) ?? normalizeOrigin(request.headers.get("referer"));
}

function normalizeBrandColor(value: unknown) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#173f2f";
}

function javascriptResponse(body: string, status: number) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": status === 200 ? "private, max-age=300" : "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
