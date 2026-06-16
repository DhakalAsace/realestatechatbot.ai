import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContext, isWorkspaceAdminRole } from "@/lib/data/dashboard";

export default async function AuditPage() {
  const { workspace, membership, auditEvents, abuseEvents } = await getAdminContext();
  if (!workspace) redirect("/dashboard/onboarding");

  if (!isWorkspaceAdminRole(membership?.role)) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-8">
        <h1 className="text-3xl font-semibold">Audit access required</h1>
        <p className="mt-3 text-sm text-[#657064]">Only workspace owners and admins can review audit and abuse events.</p>
        <Link className="mt-5 inline-flex rounded-md bg-[#173f2f] px-4 py-2 text-sm font-semibold text-white" href="/dashboard">Back to dashboard</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#657064]">Audit log review</p>
          <h1 className="mt-2 text-3xl font-semibold">Workspace audit trail</h1>
        </div>
        <Link className="rounded-md border border-[#cbd5c7] bg-white px-3 py-2 text-sm font-semibold" href="/dashboard/admin">Launch readiness</Link>
      </div>

      <section className="overflow-hidden rounded-lg border border-[#d9ded2] bg-white">
        <div className="grid border-b border-[#e5e9df] bg-[#f7f9f4] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#657064] md:grid-cols-[170px_1fr_170px]">
          <span>When</span><span>Action</span><span>Subject</span>
        </div>
        <div className="divide-y divide-[#e5e9df]">
          {auditEvents.length === 0 ? <p className="p-4 text-sm text-[#657064]">No audit events yet.</p> : auditEvents.map((event) => (
            <div className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[170px_1fr_170px]" key={event.id}>
              <time className="text-[#657064]" dateTime={event.created_at}>{formatDate(event.created_at)}</time>
              <div>
                <p className="font-semibold">{event.action}</p>
                <p className="mt-1 break-words font-mono text-xs text-[#657064]">{JSON.stringify(event.metadata ?? {}).slice(0, 260)}</p>
              </div>
              <p className="text-[#657064]">{event.subject_type}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-[#d9ded2] bg-white">
        <div className="border-b border-[#e5e9df] bg-[#f7f9f4] px-4 py-3">
          <h2 className="font-semibold">Abuse blocks</h2>
        </div>
        <div className="divide-y divide-[#e5e9df]">
          {abuseEvents.length === 0 ? <p className="p-4 text-sm text-[#657064]">No abuse blocks recorded for this workspace.</p> : abuseEvents.map((event) => (
            <div className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[170px_1fr_170px]" key={event.id}>
              <time className="text-[#657064]" dateTime={event.created_at}>{formatDate(event.created_at)}</time>
              <p className="font-semibold">{event.reason}</p>
              <p className="text-[#657064]">{event.route}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
