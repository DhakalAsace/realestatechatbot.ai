import { notFound } from "next/navigation";
import { ChatWidget } from "@/components/chat-widget";
import { isChannelType, isPublicChannelKey, isSourceUrlAllowed, normalizeOrigin, sanitizeUrl, type ChannelType, type UTMInput } from "@/lib/channels";
import { verifyWidgetChannelToken } from "@/lib/security";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  robots: { index: false, follow: false },
};

type EmbedPageProps = {
  params: Promise<{ channelKey: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type EmbedChannel = {
  id: string;
  workspace_id: string;
  bot_id: string;
  type: ChannelType;
  status: string;
  public_key: string;
  label: string;
  allowed_origins: string[] | null;
};

type EmbedBot = {
  id: string;
  workspace_id: string;
  agent_profile_id: string | null;
  name: string;
  slug: string;
  status: string;
  greeting: string;
  theme: { brandColor?: string } | null;
};

type AgentProfile = {
  brand_color: string;
};

export default async function EmbedPage({ params, searchParams }: EmbedPageProps) {
  const [{ channelKey }, query] = await Promise.all([params, searchParams]);
  const sourceUrl = firstQueryValue(query.parentUrl);
  const referrer = firstQueryValue(query.referrer);
  const widgetToken = firstQueryValue(query.token);
  const result = await loadEmbed(channelKey, sourceUrl, widgetToken);

  if (!result.bot || !result.channel) {
    notFound();
  }

  const brandColor = result.bot.theme?.brandColor ?? result.profile?.brand_color ?? "#173f2f";

  return (
    <main className="h-screen min-h-[520px] bg-white text-[#162018]">
      <ChatWidget
        botName={result.bot.name}
        brandColor={brandColor}
        channelKey={result.channel.public_key}
        compact
        greeting={result.bot.greeting}
        referrer={referrer}
        slug={result.bot.slug}
        sourceUrl={sourceUrl}
        utm={parseUtm(query)}
        widgetToken={widgetToken}
      />
    </main>
  );
}

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseUtm(query: Record<string, string | string[] | undefined>): UTMInput {
  return {
    source: firstQueryValue(query.utm_source),
    medium: firstQueryValue(query.utm_medium),
    campaign: firstQueryValue(query.utm_campaign),
    content: firstQueryValue(query.utm_content),
    term: firstQueryValue(query.utm_term),
  };
}

async function loadEmbed(channelKey: string, sourceUrl?: string, widgetToken?: string): Promise<{ bot: EmbedBot | null; channel: EmbedChannel | null; profile: AgentProfile | null }> {
  if (!isPublicChannelKey(channelKey)) {
    return { bot: null, channel: null, profile: null };
  }

  const token = verifyWidgetChannelToken(widgetToken);
  if (!token || token.channelKey !== channelKey) {
    return { bot: null, channel: null, profile: null };
  }

  const normalizedSourceUrl = sanitizeUrl(sourceUrl);
  const sourceOrigin = normalizeOrigin(normalizedSourceUrl);
  if (token.origin === "*" || sourceOrigin !== token.origin) {
    return { bot: null, channel: null, profile: null };
  }

  let admin;
  try {
    admin = getSupabaseAdminClient();
  } catch {
    return { bot: null, channel: null, profile: null };
  }

  const { data: channel } = await admin
    .from("bot_channels")
    .select("id, workspace_id, bot_id, type, status, public_key, label, allowed_origins")
    .eq("public_key", channelKey)
    .maybeSingle<EmbedChannel>();

  if (!channel || channel.status !== "active" || !isChannelType(channel.type) || channel.type !== "web_embed") {
    return { bot: null, channel: null, profile: null };
  }

  if (!isSourceUrlAllowed(normalizedSourceUrl, channel.allowed_origins ?? [])) {
    return { bot: null, channel: null, profile: null };
  }

  const { data: bot } = await admin
    .from("bots")
    .select("id, workspace_id, agent_profile_id, name, slug, status, greeting, theme")
    .eq("workspace_id", channel.workspace_id)
    .eq("id", channel.bot_id)
    .maybeSingle<EmbedBot>();

  if (!bot || bot.status !== "active") {
    return { bot: null, channel: null, profile: null };
  }

  const { data: profile } = bot.agent_profile_id
    ? await admin
        .from("agent_profiles")
        .select("brand_color")
        .eq("workspace_id", bot.workspace_id)
        .eq("id", bot.agent_profile_id)
        .maybeSingle<AgentProfile>()
    : { data: null };

  return { bot, channel, profile: profile ?? null };
}
