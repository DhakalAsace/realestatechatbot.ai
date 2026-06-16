import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { assignLead, updateAppointmentStatus, updateLeadEmailPreference, updateLeadStatus } from "@/app/dashboard/actions";
import { appointmentTypeLabel } from "@/lib/appointments";
import { sourceDisplayLabel } from "@/lib/channels";
import { getLeadDetail } from "@/lib/data/dashboard";

type LeadDetailPageProps = {
  params: Promise<{ leadId: string }>;
};

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { leadId } = await params;
  const { user, workspace, membership, lead, messages, appointments, agentProfiles, emailPreference, followUpStates } = await getLeadDetail(leadId);

  if (!workspace) redirect("/dashboard/onboarding");
  if (!lead) notFound();

  const assignedProfile = agentProfiles.find((agentProfile) => agentProfile.id === lead.assigned_agent_profile_id);
  const canAssign = membership?.role === "owner" || membership?.role === "admin";
  const canUpdateLead = canMutateAssignedRecord(membership?.role, user.id, assignedProfile?.user_id);

  return (
    <main className="mx-auto max-w-6xl px-5 py-6">
      <div className="mb-5">
        <Link className="text-sm font-semibold text-[#2861a8]" href="/dashboard/leads">Back to leads</Link>
        <h1 className="mt-3 text-3xl font-semibold">{lead.name ?? "Unnamed lead"}</h1>
        <p className="mt-2 text-sm capitalize text-[#657064]">{lead.intent} lead, {lead.temperature}, score {lead.score}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <aside className="rounded-lg border border-[#d9ded2] bg-white p-4">
          <h2 className="font-semibold">Contact</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Email" value={lead.email} />
            <Row label="Phone" value={lead.phone} />
            <Row label="Area" value={lead.location ?? lead.property_address} />
            <Row label="Timeline" value={lead.timeframe} />
            <Row label="Budget" value={lead.budget_max ? `$${lead.budget_max.toLocaleString()}` : null} />
            <Row label="Property" value={lead.property_type} />
          </dl>

          <div className="mt-5 border-t border-[#e5e9df] pt-4">
            <h2 className="font-semibold">Source</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Channel" value={sourceDisplayLabel(lead)} />
              <Row label="Source / medium" value={lead.source && lead.medium ? `${lead.source} / ${lead.medium}` : null} />
              <Row label="Campaign" value={lead.campaign} />
              <Row label="Content" value={lead.content} />
              <Row label="Term" value={lead.term} />
              <Row label="Source URL" value={lead.source_url} />
              <Row label="Referrer" value={lead.referrer} />
            </dl>
          </div>

          <div className="mt-5 border-t border-[#e5e9df] pt-4">
            <h2 className="font-semibold">Assignment</h2>
            <p className="mt-2 text-sm text-[#657064]">Assigned to <span className="font-semibold text-[#162018]">{assignedProfile?.display_name ?? "Unassigned"}</span></p>
            {canAssign ? (
              <form action={assignLead} className="mt-3 grid gap-2">
                <input name="leadId" type="hidden" value={lead.id} />
                <select className="h-11 rounded-md border border-[#cdd5c8] bg-white px-3" defaultValue={lead.assigned_agent_profile_id ?? lead.agent_profile_id ?? ""} name="agentProfileId">
                  {agentProfiles.filter((agentProfile) => agentProfile.status === "active").map((agentProfile) => (
                    <option key={agentProfile.id} value={agentProfile.id}>
                      {agentProfile.display_name} ({agentProfile.profile_type})
                    </option>
                  ))}
                </select>
                <button className="h-11 rounded-md border border-[#cbd5c7] bg-white px-4 font-semibold" type="submit">
                  Assign lead
                </button>
              </form>
            ) : null}
          </div>

          <div className="mt-5 border-t border-[#e5e9df] pt-4">
            {canUpdateLead ? (
              <form action={updateLeadStatus}>
                <input name="leadId" type="hidden" value={lead.id} />
                <label className="block text-sm font-medium" htmlFor="status">Status</label>
                <select className="mt-1 h-11 w-full rounded-md border border-[#cdd5c8] bg-white px-3" defaultValue={lead.status} id="status" name="status">
                  <option value="new">New</option>
                  <option value="qualified">Qualified</option>
                  <option value="contacted">Contacted</option>
                  <option value="converted">Converted</option>
                  <option value="lost">Lost</option>
                  <option value="spam">Spam</option>
                </select>
                <button className="mt-3 h-11 w-full rounded-md bg-[#173f2f] px-4 font-semibold text-white" type="submit">
                  Update status
                </button>
              </form>
            ) : (
              <p className="rounded-md bg-[#f7f9f4] px-3 py-2 text-sm text-[#657064]">Read-only access. Lead updates are available to owners, admins, and assigned agents.</p>
            )}
          </div>

          <div className="mt-5 border-t border-[#e5e9df] pt-4">
            <h2 className="font-semibold">Email follow-up</h2>
            <p className="mt-2 text-sm text-[#657064]">
              Consent status <span className="font-semibold capitalize text-[#162018]">{emailPreference?.status.replace("_", " ") ?? "pending"}</span>
            </p>
            {emailPreference?.consent_source ? (
              <p className="mt-2 rounded-md bg-[#f7f9f4] px-3 py-2 text-xs leading-5 text-[#657064]">
                Consent source: {emailPreference.consent_source}. Version: {emailPreference.consent_text_version ?? "unknown"}. {emailPreference.consented_at ? `Recorded ${formatDate(emailPreference.consented_at)}.` : ""}
              </p>
            ) : null}
            {canAssign ? (
              <div className="mt-3 grid gap-2">
                <p className="rounded-md bg-[#fff5df] px-3 py-2 text-xs leading-5 text-[#6c4b0b]">
                  Only record consent after confirming the lead permitted email follow-up about this real estate inquiry.
                </p>
                <form action={updateLeadEmailPreference}>
                  <input name="leadId" type="hidden" value={lead.id} />
                  <input name="status" type="hidden" value="opted_in" />
                  <button className="h-11 w-full rounded-md bg-[#173f2f] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!lead.email} type="submit">
                    Record consent attestation
                  </button>
                </form>
                <form action={updateLeadEmailPreference}>
                  <input name="leadId" type="hidden" value={lead.id} />
                  <input name="status" type="hidden" value="unsubscribed" />
                  <button className="h-11 w-full rounded-md border border-[#efc7b8] bg-[#fff7f3] px-4 text-sm font-semibold text-[#8a3518] disabled:cursor-not-allowed disabled:opacity-50" disabled={!lead.email} type="submit">
                    Suppress follow-up
                  </button>
                </form>
              </div>
            ) : (
              <p className="mt-3 rounded-md bg-[#f7f9f4] px-3 py-2 text-sm text-[#657064]">Only owners and admins can record email consent or suppress follow-up.</p>
            )}
            <div className="mt-4 space-y-2">
              {followUpStates.length === 0 ? (
                <p className="text-sm text-[#657064]">No follow-up workflow has been queued yet.</p>
              ) : (
                followUpStates.map((state) => (
                  <div className="rounded-md bg-[#f7f9f4] px-3 py-2 text-sm" key={state.id}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium capitalize">{state.status.replace("_", " ")}</span>
                      <span className="font-mono text-xs text-[#657064]">{state.attempt_count}/{state.max_attempts}</span>
                    </div>
                    {state.next_send_at ? <p className="mt-1 text-xs text-[#657064]">Next {formatDate(state.next_send_at)}</p> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>



        <section className="rounded-lg border border-[#d9ded2] bg-white">
          <div className="border-b border-[#e5e9df] p-4">
            <h2 className="font-semibold">Appointments</h2>
            <p className="text-sm text-[#657064]">Requests tied to this conversation.</p>
          </div>
          <div className="space-y-3 p-4">
            {appointments.length === 0 ? (
              <p className="text-sm text-[#657064]">No appointment requests yet.</p>
            ) : (
              appointments.map((appointment) => (
                <div className="rounded-md border border-[#e5e9df] bg-[#f8faf6] p-3" key={appointment.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold capitalize">{appointmentTypeLabel(appointment.request_type)}</p>
                      <p className="mt-1 text-sm text-[#657064]">{appointment.preferred_time_text}</p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold capitalize text-[#455247]">{appointment.status}</span>
                  </div>
                  <dl className="mt-3 space-y-2 text-sm">
                    <Row label="Calendar" value={appointment.calendar_url} />
                    <Row label="Notification" value={appointment.notification_events?.[0]?.status ?? "Pending"} />
                  </dl>
                  {canUpdateLead ? (
                    <form action={updateAppointmentStatus} className="mt-3 grid gap-2">
                      <input name="appointmentId" type="hidden" value={appointment.id} />
                      <input name="redirectTo" type="hidden" value={`/dashboard/leads/${lead.id}`} />
                      <select className="h-10 rounded-md border border-[#cdd5c8] bg-white px-3 text-sm" defaultValue={appointment.status} name="status">
                        <option value="requested">Requested</option>
                        <option value="acknowledged">Acknowledged</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="declined">Declined</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="completed">Completed</option>
                      </select>
                      <textarea className="min-h-20 rounded-md border border-[#cdd5c8] p-2 text-sm" defaultValue={appointment.agent_notes ?? ""} maxLength={2000} name="agentNotes" placeholder="Agent notes" />
                      <button className="h-10 rounded-md bg-[#173f2f] px-3 text-sm font-semibold text-white" type="submit">Save appointment</button>
                    </form>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-lg border border-[#d9ded2] bg-white">
          <div className="border-b border-[#e5e9df] p-4">
            <h2 className="font-semibold">Transcript</h2>
            <p className="text-sm text-[#657064]">{lead.summary}</p>
          </div>
          <div className="space-y-3 p-4">
            {messages.length === 0 ? (
              <p className="text-sm text-[#657064]">No messages stored yet.</p>
            ) : (
              messages.map((message) => (
                <div className={message.sender_type === "bot" ? "ml-auto max-w-[82%] rounded-lg bg-[#173f2f] px-4 py-3 text-white" : "max-w-[82%] rounded-lg border border-[#d9ded2] bg-[#f7f9f4] px-4 py-3"} key={message.id}>
                  <p className="mb-1 font-mono text-xs uppercase opacity-70">{message.sender_type}</p>
                  <p className="text-sm leading-6">{message.content}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-[#657064]">{label}</dt>
      <dd className="mt-1 font-medium">{value || "Pending"}</dd>
    </div>
  );
}

function canMutateAssignedRecord(role: string | undefined, userId: string, assignedUserId?: string | null) {
  if (role === "owner" || role === "admin" || role === "member") return true;
  return role === "agent" && Boolean(assignedUserId) && assignedUserId === userId;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
