import Link from "next/link";
import { redirect } from "next/navigation";
import { updateAppointmentStatus } from "@/app/dashboard/actions";
import { appointmentTypeLabel } from "@/lib/appointments";
import { getAppointmentsContext, type AgentProfileRow, type AppointmentRow } from "@/lib/data/dashboard";

type AppointmentsPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function AppointmentsPage({ searchParams }: AppointmentsPageProps) {
  const [{ user, workspace, membership, appointments, agentProfiles }, params] = await Promise.all([getAppointmentsContext(), searchParams]);
  if (!workspace) redirect("/dashboard/onboarding");

  const status = params.status;
  const type = params.type;
  const visibleAppointments = appointments.filter((appointment) => {
    const statusMatches = status ? appointment.status === status : true;
    const typeMatches = type ? appointment.request_type === type : true;
    return statusMatches && typeMatches;
  });

  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#657064]">Appointments</p>
          <h1 className="mt-2 text-3xl font-semibold">Appointment requests</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#657064]">
            Buyer consultations, seller valuations, and showing requests captured after lead qualification. Notification attempts are logged without blocking the saved request.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm md:items-end">
          <div className="flex flex-wrap gap-2">
            <Filter href={filterHref({ type })} label="All" active={!status} />
            <Filter href={filterHref({ status: "requested", type })} label="Requested" active={status === "requested"} />
            <Filter href={filterHref({ status: "acknowledged", type })} label="Acknowledged" active={status === "acknowledged"} />
            <Filter href={filterHref({ status: "confirmed", type })} label="Confirmed" active={status === "confirmed"} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Filter href={filterHref({ status })} label="All types" active={!type} />
            <Filter href={filterHref({ status, type: "buyer_consultation" })} label="Buyer" active={type === "buyer_consultation"} />
            <Filter href={filterHref({ status, type: "seller_valuation" })} label="Valuation" active={type === "seller_valuation"} />
            <Filter href={filterHref({ status, type: "showing" })} label="Showing" active={type === "showing"} />
          </div>
        </div>
      </div>

      {params.saved ? <div className="mb-4 rounded-lg border border-[#bcd7c8] bg-[#edf7f1] p-4 text-sm text-[#173f2f]">Appointment saved.</div> : null}
      {params.error ? <div className="mb-4 rounded-lg border border-[#f0c0aa] bg-[#fff1eb] p-4 text-sm text-[#8a3518]">Could not update appointment.</div> : null}

      <section className="grid gap-4">
        {visibleAppointments.length === 0 ? (
          <div className="rounded-lg border border-[#d9ded2] bg-white p-8 text-sm text-[#657064]">No appointment requests match this filter yet.</div>
        ) : (
          visibleAppointments.map((appointment) => {
            const assignedProfile = agentProfiles.find((agentProfile) => agentProfile.id === appointment.assigned_agent_profile_id);
            const canUpdate = canMutateAssignedRecord(membership?.role, user.id, assignedProfile?.user_id);

            return <AppointmentCard appointment={appointment} assignedProfile={assignedProfile ?? null} canUpdate={canUpdate} key={appointment.id} />;
          })
        )}
      </section>
    </main>
  );
}

function AppointmentCard({ appointment, assignedProfile, canUpdate }: { appointment: AppointmentRow; assignedProfile: AgentProfileRow | null; canUpdate: boolean }) {
  const lead = Array.isArray(appointment.lead) ? appointment.lead[0] : appointment.lead;
  const notification = appointment.notification_events?.[0];
  const leadName = lead?.name ?? "Unnamed lead";

  return (
    <article className="rounded-lg border border-[#d9ded2] bg-white p-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-[#657064]">{appointmentTypeLabel(appointment.request_type)}</p>
              <h2 className="mt-2 text-xl font-semibold">{leadName}</h2>
              <p className="mt-1 text-sm text-[#657064]">{appointment.preferred_time_text}</p>
            </div>
            <span className="rounded-full bg-[#f2f5ee] px-2.5 py-1 text-xs font-semibold capitalize text-[#455247]">{appointment.status}</span>
          </div>

          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <Row label="Contact" value={lead?.email ?? lead?.phone ?? "Pending"} />
            <Row label="Area" value={lead?.location ?? lead?.property_address ?? "Pending"} />
            <Row label="Calendar" value={appointment.calendar_url ?? "Not configured"} />
            <Row label="Assigned" value={assignedProfile?.display_name ?? "Unassigned"} />
            <Row label="Notification" value={notification ? notificationStatusLabel(notification.status, notification.error_code) : "Pending"} />
          </dl>

          {appointment.visitor_notes ? <p className="mt-4 rounded-md bg-[#f7f9f4] p-3 text-sm leading-6 text-[#455247]">{appointment.visitor_notes}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link className="rounded-md border border-[#cbd5c7] bg-white px-3 py-2 font-semibold" href={`/dashboard/leads/${appointment.lead_id}`}>
              Open lead transcript
            </Link>
            {appointment.calendar_url ? (
              <Link className="rounded-md bg-[#173f2f] px-3 py-2 font-semibold text-white" href={appointment.calendar_url} target="_blank">
                Open calendar
              </Link>
            ) : null}
          </div>
        </div>

        {canUpdate ? (
          <form action={updateAppointmentStatus} className="rounded-md border border-[#e5e9df] bg-[#f8faf6] p-4">
            <input name="appointmentId" type="hidden" value={appointment.id} />
            <input name="redirectTo" type="hidden" value="/dashboard/appointments" />
            <label className="block text-sm font-medium" htmlFor={`status-${appointment.id}`}>Status</label>
            <select className="mt-1 h-11 w-full rounded-md border border-[#cdd5c8] bg-white px-3" defaultValue={appointment.status} id={`status-${appointment.id}`} name="status">
              <option value="requested">Requested</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="confirmed">Confirmed</option>
              <option value="declined">Declined</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
            </select>
            <label className="mt-3 block text-sm font-medium" htmlFor={`notes-${appointment.id}`}>Agent notes</label>
            <textarea className="mt-1 min-h-24 w-full rounded-md border border-[#cdd5c8] p-3" defaultValue={appointment.agent_notes ?? ""} id={`notes-${appointment.id}`} maxLength={2000} name="agentNotes" />
            <button className="mt-3 h-11 w-full rounded-md bg-[#173f2f] px-4 text-sm font-semibold text-white" type="submit">
              Save appointment
            </button>
          </form>
        ) : (
          <div className="rounded-md border border-[#e5e9df] bg-[#f8faf6] p-4 text-sm leading-6 text-[#657064]">
            Read-only access. Appointment updates are available to owners, admins, and assigned agents.
          </div>
        )}
      </div>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[#657064]">{label}</dt>
      <dd className="mt-1 break-words font-medium">{value}</dd>
    </div>
  );
}

function notificationStatusLabel(status: string, errorCode?: string | null) {
  if (status === "skipped" && errorCode) return `Skipped: ${errorCode.replaceAll("_", " ")}`;
  if (status === "failed" && errorCode) return `Failed: ${errorCode}`;
  return status;
}

function filterHref({ status, type }: { status?: string; type?: string }) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (type) params.set("type", type);
  const query = params.toString();
  return query ? `/dashboard/appointments?${query}` : "/dashboard/appointments";
}

function Filter({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link className={active ? "rounded-md bg-[#173f2f] px-3 py-2 font-semibold text-white" : "rounded-md border border-[#cbd5c7] bg-white px-3 py-2 font-semibold"} href={href}>
      {label}
    </Link>
  );
}

function canMutateAssignedRecord(role: string | undefined, userId: string, assignedUserId?: string | null) {
  if (role === "owner" || role === "admin" || role === "member") return true;
  return role === "agent" && Boolean(assignedUserId) && assignedUserId === userId;
}
