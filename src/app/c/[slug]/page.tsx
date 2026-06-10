import Link from "next/link";
import { notFound } from "next/navigation";
import { ChatWidget } from "@/components/chat-widget";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type PublicBotPageProps = {
  params: Promise<{ slug: string }>;
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

type AgentProfile = {
  display_name: string;
  brokerage_name: string;
  service_areas: string[];
  brand_color: string;
};

export default async function PublicBotPage({ params }: PublicBotPageProps) {
  const { slug } = await params;
  const result = await loadPublicBot(slug);

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

  if (!result.bot || result.bot.status !== "active") {
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

        <ChatWidget botName={result.bot.name} brandColor={brandColor} greeting={result.bot.greeting} slug={result.bot.slug} />
      </div>
    </main>
  );
}

async function loadPublicBot(slug: string): Promise<{ kind: "ok"; bot: PublicBot | null; profile: AgentProfile | null } | { kind: "missing-env" }> {
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
    return { kind: "ok", bot: null, profile: null };
  }

  const { data: channel } = await admin
    .from("bot_channels")
    .select("id")
    .eq("workspace_id", bot.workspace_id)
    .eq("bot_id", bot.id)
    .eq("type", "hosted_link")
    .eq("status", "active")
    .maybeSingle();

  if (!channel) {
    return { kind: "ok", bot: null, profile: null };
  }

  const { data: profile } = bot.agent_profile_id
    ? await admin
        .from("agent_profiles")
        .select("display_name, brokerage_name, service_areas, brand_color")
        .eq("workspace_id", bot.workspace_id)
        .eq("id", bot.agent_profile_id)
        .maybeSingle<AgentProfile>()
    : { data: null };

  return { kind: "ok", bot, profile: profile ?? null };
}
