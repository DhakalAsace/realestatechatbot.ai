import Link from "next/link";
import { redirect } from "next/navigation";
import { sourceDisplayLabel } from "@/lib/channels";
import { getDashboardContext } from "@/lib/data/dashboard";

type LeadsPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const [{ workspace, leads, channels, agentProfiles }, params] = await Promise.all([getDashboardContext(), searchParams]);
  if (!workspace) redirect("/dashboard/onboarding");

  const status = params.status;
  const channelId = params.channel;
  const assignee = params.assignee;
  const exportUrl = exportHref({ status, channelId, assignee });
  const visibleLeads = leads.filter((lead) => {
    const statusMatches = status ? lead.status === status : true;
    const channelMatches = channelId ? lead.bot_channel_id === channelId : true;
    const assigneeMatches = assignee ? lead.assigned_agent_profile_id === assignee : true;
    return statusMatches && channelMatches && assigneeMatches;
  });

  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#657064]">Lead inbox</p>
          <h1 className="mt-2 text-3xl font-semibold">Captured leads</h1>
        </div>
        <div className="flex flex-col gap-2 text-sm md:items-end">
          <Link className="rounded-md bg-[#173f2f] px-3 py-2 font-semibold text-white" href={exportUrl}>
            Export CSV
          </Link>
          <div className="flex flex-wrap gap-2">
            <Filter href={filterHref({ channelId, assignee })} label="All" active={!status} />
            <Filter href={filterHref({ status: "new", channelId, assignee })} label="New" active={status === "new"} />
            <Filter href={filterHref({ status: "qualified", channelId, assignee })} label="Qualified" active={status === "qualified"} />
            <Filter href={filterHref({ status: "contacted", channelId, assignee })} label="Contacted" active={status === "contacted"} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Filter href={filterHref({ status, assignee })} label="All channels" active={!channelId} />
            {channels.map((channel) => (
              <Filter href={filterHref({ status, channelId: channel.id, assignee })} label={channel.label} active={channelId === channel.id} key={channel.id} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Filter href={filterHref({ status, channelId })} label="All assignees" active={!assignee} />
            {agentProfiles.map((agentProfile) => (
              <Filter href={filterHref({ status, channelId, assignee: agentProfile.id })} label={agentProfile.display_name} active={assignee === agentProfile.id} key={agentProfile.id} />
            ))}
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-lg border border-[#d9ded2] bg-white">
        {visibleLeads.length === 0 ? (
          <div className="p-8 text-sm text-[#657064]">No leads match this filter yet.</div>
        ) : (
          <div className="divide-y divide-[#e5e9df]">
            {visibleLeads.map((lead) => {
              const assignedProfile = agentProfiles.find((agentProfile) => agentProfile.id === lead.assigned_agent_profile_id);

              return (
              <Link className="block p-4 hover:bg-[#f7f9f4]" href={`/dashboard/leads/${lead.id}`} key={lead.id}>
                <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_120px_90px] md:items-center">
                  <div>
                    <p className="font-medium">{lead.name ?? "Unnamed lead"}</p>
                    <p className="text-sm text-[#657064]">{lead.email ?? lead.phone ?? "Contact pending"}</p>
                    <p className="mt-1 text-xs text-[#657064]">{sourceDisplayLabel(lead)}</p>
                    <p className="mt-1 text-xs text-[#657064]">Assigned to {assignedProfile?.display_name ?? "Unassigned"}</p>
                  </div>
                  <p className="text-sm capitalize text-[#657064]">{lead.intent} in {lead.location ?? lead.property_address ?? "Area pending"}</p>
                  <span className="w-fit rounded-full bg-[#dfe9f7] px-2.5 py-1 text-xs font-medium capitalize text-[#204f8a]">{lead.status}</span>
                  <p className="font-mono text-sm text-[#657064]">Score {lead.score}</p>
                </div>
              </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function filterHref({ status, channelId, assignee }: { status?: string; channelId?: string; assignee?: string }) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (channelId) params.set("channel", channelId);
  if (assignee) params.set("assignee", assignee);
  const query = params.toString();
  return query ? `/dashboard/leads?${query}` : "/dashboard/leads";
}

function exportHref({ status, channelId, assignee }: { status?: string; channelId?: string; assignee?: string }) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (channelId) params.set("channel", channelId);
  if (assignee) params.set("assignee", assignee);
  const query = params.toString();
  return query ? `/dashboard/leads/export?${query}` : "/dashboard/leads/export";
}

function Filter({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link className={active ? "rounded-md bg-[#173f2f] px-3 py-2 font-semibold text-white" : "rounded-md border border-[#cbd5c7] bg-white px-3 py-2 font-semibold"} href={href}>
      {label}
    </Link>
  );
}
