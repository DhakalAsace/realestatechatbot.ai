import Link from "next/link";
import { redirect } from "next/navigation";
import { buildChannelUrl, sourceDisplayLabel } from "@/lib/channels";
import { getDashboardContext } from "@/lib/data/dashboard";
import { getAppUrl } from "@/lib/env";

function scoreBand(score: number) {
  if (score >= 75) return "Hot";
  if (score >= 45) return "Warm";
  return "Cold";
}

export default async function DashboardPage() {
  const { workspace, profile, bots, leads, channels, appointments } = await getDashboardContext();

  if (!workspace || !profile || bots.length === 0) {
    redirect("/dashboard/onboarding");
  }

  const activeBot = bots.find((bot) => bot.status === "active") ?? bots[0];
  const activeBotChannels = channels.filter((channel) => channel.bot_id === activeBot.id);
  const defaultChannel = activeBotChannels.find((channel) => channel.type === "hosted_link" && channel.status === "active") ?? activeBotChannels[0];
  const hostedUrl = defaultChannel ? buildChannelUrl(getAppUrl(), activeBot.slug, defaultChannel.public_key) : `/c/${activeBot.slug}`;
  const hotLeads = leads.filter((lead) => lead.score >= 75).length;
  const qualified = leads.filter((lead) => lead.status === "qualified").length;
  const requestedAppointments = appointments.filter((appointment) => appointment.status === "requested").length;
  const sourceCounts = activeBotChannels
    .map((channel) => ({
      channel,
      count: leads.filter((lead) => lead.bot_channel_id === channel.id).length,
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#657064]">Dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold">{workspace.name}</h1>
          <p className="mt-2 text-sm text-[#657064]">{profile.display_name} in {profile.service_areas.join(", ")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-md bg-[#173f2f] px-4 py-2 text-sm font-semibold text-white" href={hostedUrl} target="_blank">
            Open hosted bot
          </Link>
          <Link className="rounded-md border border-[#cbd5c7] bg-white px-4 py-2 text-sm font-semibold" href="/dashboard/channels">
            Manage channels
          </Link>
          <Link className="rounded-md border border-[#cbd5c7] bg-white px-4 py-2 text-sm font-semibold" href={`/dashboard/bots/${activeBot.id}`}>
            Edit bot
          </Link>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-[#d9ded2] bg-white p-4">
          <p className="text-sm text-[#657064]">Total leads</p>
          <p className="mt-2 text-3xl font-semibold">{leads.length}</p>
        </div>
        <div className="rounded-lg border border-[#d9ded2] bg-white p-4">
          <p className="text-sm text-[#657064]">Qualified</p>
          <p className="mt-2 text-3xl font-semibold">{qualified}</p>
        </div>
        <div className="rounded-lg border border-[#d9ded2] bg-white p-4">
          <p className="text-sm text-[#657064]">Hot</p>
          <p className="mt-2 text-3xl font-semibold">{hotLeads}</p>
        </div>
        <div className="rounded-lg border border-[#d9ded2] bg-white p-4">
          <p className="text-sm text-[#657064]">Appointments</p>
          <p className="mt-2 text-3xl font-semibold">{requestedAppointments}</p>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-[#d9ded2] bg-white">
          <div className="flex items-center justify-between border-b border-[#e5e9df] p-4">
            <div>
              <h2 className="font-semibold">Recent leads</h2>
              <p className="text-sm text-[#657064]">Latest captured conversations</p>
            </div>
            <Link className="text-sm font-semibold text-[#2861a8]" href="/dashboard/leads">View all</Link>
          </div>
          <div className="divide-y divide-[#e5e9df]">
            {leads.length === 0 ? (
              <div className="p-6 text-sm text-[#657064]">No leads yet. Open the hosted bot and complete a buyer or seller flow.</div>
            ) : (
              leads.slice(0, 6).map((lead) => (
                <Link className="block p-4 hover:bg-[#f7f9f4]" href={`/dashboard/leads/${lead.id}`} key={lead.id}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium">{lead.name ?? "Unnamed lead"}</p>
                      <p className="text-sm text-[#657064] capitalize">{lead.intent} in {lead.location ?? lead.property_address ?? "Area pending"}</p>
                      <p className="mt-1 text-xs text-[#657064]">{sourceDisplayLabel(lead)}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="rounded-full bg-[#dfe9f7] px-2.5 py-1 font-medium text-[#204f8a]">{scoreBand(lead.score)}</span>
                      <span className="font-mono text-[#657064]">{lead.score}</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <aside className="rounded-lg border border-[#d9ded2] bg-white p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#657064]">Default share link</p>
          <p className="mt-3 break-all rounded-md bg-[#f2f5ee] p-3 font-mono text-sm">{hostedUrl}</p>
          <p className="mt-4 text-sm leading-6 text-[#657064]">Phase 5 stores appointment, showing, and valuation requests after lead capture.</p>

          <div className="mt-5 border-t border-[#e5e9df] pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Lead sources</p>
              <Link className="text-sm font-semibold text-[#2861a8]" href="/dashboard/appointments">Appointments</Link>
            </div>
            {sourceCounts.length === 0 ? (
              <p className="mt-3 text-sm text-[#657064]">No source data yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {sourceCounts.slice(0, 5).map(({ channel, count }) => (
                  <div className="flex items-center justify-between rounded-md bg-[#f7f9f4] px-3 py-2 text-sm" key={channel.id}>
                    <span>{channel.label}</span>
                    <span className="font-mono text-[#657064]">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}
