import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContext, isWorkspaceAdminRole, type AuditEventRow, type NotificationEventRow, type UsageEventRow, type AbuseEventRow } from "@/lib/data/dashboard";
import { launchReadinessSections, statusLabel } from "@/lib/launch-readiness";

export default async function DashboardAdminPage() {
  const { workspace, membership, auditEvents, usageEvents, notificationEvents, abuseEvents } = await getAdminContext();
  if (!workspace) redirect("/dashboard/onboarding");

  if (!isWorkspaceAdminRole(membership?.role)) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-8">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#657064]">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold">Admin access required</h1>
        <p className="mt-3 text-sm leading-6 text-[#657064]">Only workspace owners and admins can review launch readiness, audit logs, abuse events, usage events, and export history.</p>
        <Link className="mt-5 inline-flex rounded-md bg-[#173f2f] px-4 py-2 text-sm font-semibold text-white" href="/dashboard">Back to dashboard</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#657064]">Internal admin</p>
          <h1 className="mt-2 text-3xl font-semibold">Launch readiness</h1>
          <p className="mt-2 text-sm text-[#657064]">Workspace-scoped review surface for security, observability, audit events, and launch gates.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link className="rounded-md border border-[#cbd5c7] bg-white px-3 py-2 font-semibold" href="/dashboard/audit">Audit log</Link>
          <Link className="rounded-md border border-[#cbd5c7] bg-white px-3 py-2 font-semibold" href="/dashboard/leads/export">Export leads</Link>
          <Link className="rounded-md border border-[#cbd5c7] bg-white px-3 py-2 font-semibold" href="/privacy">Privacy</Link>
          <Link className="rounded-md border border-[#cbd5c7] bg-white px-3 py-2 font-semibold" href="/ai-disclaimer">AI disclaimer</Link>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        {launchReadinessSections.map((section) => (
          <article className="rounded-lg border border-[#d9ded2] bg-white p-5" key={section.title}>
            <h2 className="text-xl font-semibold">{section.title}</h2>
            <div className="mt-4 space-y-3">
              {section.items.map((item) => (
                <div className="rounded-md bg-[#f7f9f4] p-3" key={item.label}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold">{item.label}</p>
                    <span className={statusClass(item.status)}>{statusLabel(item.status)}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#657064]">{item.detail}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <AuditTable title="Audit log review" events={auditEvents} />
        <AbuseTable events={abuseEvents} />
        <UsageTable events={usageEvents} />
        <NotificationTable events={notificationEvents} />
      </section>
    </main>
  );
}

function AuditTable({ title, events }: { title: string; events: AuditEventRow[] }) {
  return (
    <article className="rounded-lg border border-[#d9ded2] bg-white p-5">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-4 divide-y divide-[#e5e9df] text-sm">
        {events.length === 0 ? <p className="text-[#657064]">No audit events yet.</p> : events.slice(0, 12).map((event) => (
          <div className="py-3" key={event.id}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{event.action}</p>
              <time className="text-xs text-[#657064]" dateTime={event.created_at}>{formatDate(event.created_at)}</time>
            </div>
            <p className="mt-1 text-xs text-[#657064]">{event.subject_type}{event.subject_id ? ` ? ${event.subject_id}` : ""}</p>
            <p className="mt-1 line-clamp-2 break-words font-mono text-xs text-[#657064]">{jsonSummary(event.metadata)}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function AbuseTable({ events }: { events: AbuseEventRow[] }) {
  return (
    <article className="rounded-lg border border-[#d9ded2] bg-white p-5">
      <h2 className="text-xl font-semibold">Abuse blocks</h2>
      <div className="mt-4 divide-y divide-[#e5e9df] text-sm">
        {events.length === 0 ? <p className="text-[#657064]">No abuse blocks recorded for this workspace.</p> : events.slice(0, 12).map((event) => (
          <div className="py-3" key={event.id}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{event.reason}</p>
              <time className="text-xs text-[#657064]" dateTime={event.created_at}>{formatDate(event.created_at)}</time>
            </div>
            <p className="mt-1 text-xs text-[#657064]">{event.route}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function UsageTable({ events }: { events: UsageEventRow[] }) {
  return (
    <article className="rounded-lg border border-[#d9ded2] bg-white p-5">
      <h2 className="text-xl font-semibold">Usage events</h2>
      <div className="mt-4 divide-y divide-[#e5e9df] text-sm">
        {events.length === 0 ? <p className="text-[#657064]">No usage events yet.</p> : events.slice(0, 12).map((event) => (
          <div className="flex items-center justify-between gap-3 py-3" key={event.id}>
            <div>
              <p className="font-semibold">{event.event_type}</p>
              <p className="text-xs text-[#657064]">{event.source_type ?? "workspace"}</p>
            </div>
            <p className="font-mono text-sm">{event.quantity}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function NotificationTable({ events }: { events: NotificationEventRow[] }) {
  return (
    <article className="rounded-lg border border-[#d9ded2] bg-white p-5">
      <h2 className="text-xl font-semibold">Notification health</h2>
      <div className="mt-4 divide-y divide-[#e5e9df] text-sm">
        {events.length === 0 ? <p className="text-[#657064]">No notification events yet.</p> : events.slice(0, 12).map((event) => (
          <div className="py-3" key={event.id}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold capitalize">{event.status}</p>
              <time className="text-xs text-[#657064]" dateTime={event.created_at}>{formatDate(event.created_at)}</time>
            </div>
            <p className="text-xs text-[#657064]">{event.event_type ?? "appointment"} via {event.provider}</p>
            {event.error_message ? <p className="mt-1 text-xs text-[#8a3518]">{event.error_message}</p> : null}
          </div>
        ))}
      </div>
    </article>
  );
}

function statusClass(status: string) {
  if (status === "ready") return "rounded-full bg-[#dfe9f7] px-2.5 py-1 text-xs font-semibold text-[#204f8a]";
  if (status === "review") return "rounded-full bg-[#fff3d6] px-2.5 py-1 text-xs font-semibold text-[#7a4f00]";
  return "rounded-full bg-[#f5e2df] px-2.5 py-1 text-xs font-semibold text-[#8a3518]";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function jsonSummary(value: unknown) {
  return JSON.stringify(value ?? {}).slice(0, 220);
}
