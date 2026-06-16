import Link from "next/link";
import { notFound } from "next/navigation";
import { ChatWidget } from "@/components/chat-widget";
import { isChannelType, isPublicChannelKey, type ChannelType, type UTMInput } from "@/lib/channels";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  robots: { index: false, follow: false },
};

type PublicBotPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type PublicBot = {
  id: string;
  workspace_id: string;
  agent_profile_id: string | null;
  name: string;
  slug: string;
  status: string;
  greeting: string;
  theme: { brandColor?: string } | null;
};

type PublicChannel = {
  id: string;
  workspace_id: string;
  bot_id: string;
  type: ChannelType;
  status: string;
  public_key: string;
  label: string;
};

type AgentProfile = {
  display_name: string;
  brokerage_name: string;
  service_areas: string[];
  brand_color: string;
};

export default async function PublicBotPage({ params, searchParams }: PublicBotPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const channelKey = firstQueryValue(query.ch);
  const result = await loadPublicBot(slug, channelKey);

  if (result.kind === "missing-env") {
    return (
      <main className="min-h-screen bg-[#f7f8f3] px-5 py-8 text-[#162018]">
        <div className="mx-auto max-w-2xl rounded-lg border border-[#d9ded2] bg-white p-6">
          <h1 className="text-2xl font-semibold">Chat setup pending</h1>
          <p className="mt-3 text-sm leading-6 text-[#657064]">
            Supabase environment variables are not configured for this deployment yet.
          </p>
          <Link className="mt-5 inline-flex rounded-md bg-[#173f2f] px-4 py-2 text-sm font-semibold text-white" href="/login">
            Go to login
          </Link>
        </div>
      </main>
    );
  }

  if (!result.bot || !result.channel || result.bot.status !== "active") {
    notFound();
  }

  const profile = result.profile;
  const brandColor = result.bot.theme?.brandColor ?? profile?.brand_color ?? "#173f2f";

  return (
    <main className="min-h-screen bg-[#f7f8f3] px-4 py-4 text-[#162018] md:px-5 md:py-6">
      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-lg border border-[#d9ded2] bg-white p-4">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#657064]">Hosted assistant</p>
          <h1 className="mt-3 text-2xl font-semibold">{profile?.display_name ?? result.bot.name}</h1>
          <p className="mt-1 text-sm text-[#657064]">{profile?.brokerage_name ?? "Real estate team"}</p>
          <div className="mt-5 rounded-md bg-[#f2f5ee] p-3 text-sm leading-6">
            {(profile?.service_areas ?? []).length > 0 ? profile?.service_areas.join(", ") : "Buyer and seller lead capture"}
          </div>
          <p className="mt-5 text-sm leading-6 text-[#657064]">
            Start with buying or selling. The assistant will collect the core details and save the transcript for agent follow-up.
          </p>
        </aside>

        <ChatWidget
          botName={result.bot.name}
          brandColor={brandColor}
          channelKey={result.channel.public_key}
          greeting={result.bot.greeting}
          slug={result.bot.slug}
          utm={parseUtm(query)}
        />
      </div>
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

async function loadPublicBot(
  slug: string,
  channelKey?: string,
): Promise<{ kind: "ok"; bot: PublicBot | null; channel: PublicChannel | null; profile: AgentProfile | null } | { kind: "missing-env" }> {
  let admin;

  try {
    admin = getSupabaseAdminClient();
  } catch {
    return { kind: "missing-env" };
  }

  const { data: bot } = await admin
    .from("bots")
    .select("id, workspace_id, agent_profile_id, name, slug, status, greeting, theme")
    .eq("slug", slug)
    .maybeSingle<PublicBot>();

  if (!bot || bot.status !== "active") {
    return { kind: "ok", bot: null, channel: null, profile: null };
  }

  const channelQuery = admin
    .from("bot_channels")
    .select("id, workspace_id, bot_id, type, status, public_key, label")
    .eq("workspace_id", bot.workspace_id)
    .eq("bot_id", bot.id)
    .eq("status", "active");

  const { data: channel } = channelKey
    ? isPublicChannelKey(channelKey)
      ? await channelQuery.eq("public_key", channelKey).maybeSingle<PublicChannel>()
      : { data: null }
    : await channelQuery.eq("type", "hosted_link").order("created_at", { ascending: true }).limit(1).maybeSingle<PublicChannel>();

  if (!channel || !isChannelType(channel.type)) {
    return { kind: "ok", bot: null, channel: null, profile: null };
  }

  const { data: profile } = bot.agent_profile_id
    ? await admin
        .from("agent_profiles")
        .select("display_name, brokerage_name, service_areas, brand_color")
        .eq("workspace_id", bot.workspace_id)
        .eq("id", bot.agent_profile_id)
        .maybeSingle<AgentProfile>()
    : { data: null };

  return { kind: "ok", bot, channel, profile: profile ?? null };
}
