import Link from "next/link";
import { redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/data/dashboard";

type LeadsPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const [{ workspace, leads }, params] = await Promise.all([getDashboardContext(), searchParams]);
  if (!workspace) redirect("/dashboard/onboarding");

  const status = params.status;
  const visibleLeads = status ? leads.filter((lead) => lead.status === status) : leads;

  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#657064]">Lead inbox</p>
          <h1 className="mt-2 text-3xl font-semibold">Captured leads</h1>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Filter href="/dashboard/leads" label="All" active={!status} />
          <Filter href="/dashboard/leads?status=new" label="New" active={status === "new"} />
          <Filter href="/dashboard/leads?status=qualified" label="Qualified" active={status === "qualified"} />
          <Filter href="/dashboard/leads?status=contacted" label="Contacted" active={status === "contacted"} />
        </div>
      </div>

      <section className="overflow-hidden rounded-lg border border-[#d9ded2] bg-white">
        {visibleLeads.length === 0 ? (
          <div className="p-8 text-sm text-[#657064]">No leads match this filter yet.</div>
        ) : (
          <div className="divide-y divide-[#e5e9df]">
            {visibleLeads.map((lead) => (
              <Link className="block p-4 hover:bg-[#f7f9f4]" href={`/dashboard/leads/${lead.id}`} key={lead.id}>
                <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_120px_90px] md:items-center">
                  <div>
                    <p className="font-medium">{lead.name ?? "Unnamed lead"}</p>
                    <p className="text-sm text-[#657064]">{lead.email ?? lead.phone ?? "Contact pending"}</p>
                  </div>
                  <p className="text-sm capitalize text-[#657064]">{lead.intent} ? {lead.location ?? lead.property_address ?? "Area pending"}</p>
                  <span className="w-fit rounded-full bg-[#dfe9f7] px-2.5 py-1 text-xs font-medium capitalize text-[#204f8a]">{lead.status}</span>
                  <p className="font-mono text-sm text-[#657064]">Score {lead.score}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Filter({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link className={active ? "rounded-md bg-[#173f2f] px-3 py-2 font-semibold text-white" : "rounded-md border border-[#cbd5c7] bg-white px-3 py-2 font-semibold"} href={href}>
      {label}
    </Link>
  );
}
