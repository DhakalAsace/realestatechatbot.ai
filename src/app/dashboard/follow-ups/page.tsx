import Link from "next/link";
import { redirect } from "next/navigation";
import { updateFollowUpMessage, updateFollowUpSequenceStatus } from "@/app/dashboard/actions";
import {
  getFollowUpsContext,
  type FollowUpMessageRow,
  type FollowUpSequenceRow,
  type LeadEmailPreferenceRow,
  type LeadFollowUpStateRow,
  type NotificationEventRow,
} from "@/lib/data/dashboard";

type FollowUpsPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

const fieldClass = "h-11 w-full rounded-md border border-[#cbd5c7] bg-white px-3 outline-none focus:border-[#2861a8]";
const textareaClass = "w-full rounded-md border border-[#cbd5c7] bg-white px-3 py-3 outline-none focus:border-[#2861a8]";
const managerRoles = new Set(["owner", "admin"]);
const errorText: Record<string, string> = {
  permission: "Only owners and admins can manage follow-up workflows.",
  sequence: "The workflow status could not be saved.",
  message: "The message template could not be saved.",
};

export default async function FollowUpsPage({ searchParams }: FollowUpsPageProps) {
  const [{ workspace, membership, bots, followUpSequences, followUpMessages, leadEmailPreferences, followUpStates, followUpEvents, leads }, params] = await Promise.all([getFollowUpsContext(), searchParams]);

  if (!workspace || !membership) redirect("/dashboard/onboarding");

  const canManage = managerRoles.has(membership.role);
  const deliveryStatus = followUpDeliveryStatus();
  const deliveryEnabled = deliveryStatus.kind === "ready";
  const error = params.error ? errorText[params.error] ?? "That follow-up change could not be completed." : null;
  const optedIn = leadEmailPreferences.filter((preference) => preference.status === "opted_in").length;
  const pendingConsent = leadEmailPreferences.filter((preference) => preference.status === "pending").length;
  const sent = followUpEvents.filter((event) => event.status === "sent").length;
  const skipped = followUpEvents.filter((event) => event.status === "skipped").length;

  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#657064]">Follow-ups</p>
          <h1 className="mt-2 text-3xl font-semibold">Email follow-up workflows</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#657064]">
            Manage deterministic post-lead email sequences. Messages are only sent after explicit lead email consent is recorded.
          </p>
        </div>
        {!canManage ? <ReadOnlyBadge /> : null}
      </div>

      {!deliveryEnabled ? (
        <section className="mb-4 rounded-lg border border-[#efc7b8] bg-[#fff7f3] p-4 text-sm leading-6 text-[#8a3518]">
          {deliveryStatus.message} Scheduler runs will record skipped attempts unless delivery is ready.
        </section>
      ) : null}
      {error ? <p className="mb-4 rounded-md bg-[#fff1eb] px-4 py-3 text-sm font-medium text-[#8a3518]">{error}</p> : null}
      {params.saved ? <p className="mb-4 rounded-md bg-[#eaf5ec] px-4 py-3 text-sm font-medium text-[#173f2f]">Follow-up settings saved.</p> : null}

      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="Workflows" value={followUpSequences.length} />
        <Metric label="Opted in" value={optedIn} />
        <Metric label="Pending consent" value={pendingConsent} />
        <Metric label="Sent / skipped" value={`${sent} / ${skipped}`} />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {followUpSequences.length === 0 ? (
            <div className="rounded-lg border border-[#d9ded2] bg-white p-6 text-sm text-[#657064]">No follow-up workflows exist yet. New bots seed default workflows automatically.</div>
          ) : (
            followUpSequences.map((sequence) => (
              <SequencePanel
                botName={bots.find((bot) => bot.id === sequence.bot_id)?.name ?? "Bot"}
                canManage={canManage}
                key={sequence.id}
                messages={followUpMessages.filter((message) => message.sequence_id === sequence.id)}
                sequence={sequence}
              />
            ))
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-[#d9ded2] bg-white p-4">
            <h2 className="font-semibold">Lead consent queue</h2>
            <p className="mt-1 text-sm text-[#657064]">Open a lead to record explicit email consent or suppress follow-up.</p>
            <div className="mt-4 space-y-3">
              {leadEmailPreferences.length === 0 ? (
                <p className="text-sm text-[#657064]">No email preferences have been created yet.</p>
              ) : (
                leadEmailPreferences.slice(0, 8).map((preference) => <PreferenceRow key={preference.id} leads={leads} preference={preference} />)
              )}
            </div>
          </section>

          <section className="rounded-lg border border-[#d9ded2] bg-white p-4">
            <h2 className="font-semibold">Recent follow-up states</h2>
            <div className="mt-4 space-y-3">
              {followUpStates.length === 0 ? (
                <p className="text-sm text-[#657064]">No follow-up states yet.</p>
              ) : (
                followUpStates.slice(0, 8).map((state) => <StateRow key={state.id} leads={leads} state={state} />)
              )}
            </div>
          </section>

          <section className="rounded-lg border border-[#d9ded2] bg-white p-4">
            <h2 className="font-semibold">Delivery log</h2>
            <div className="mt-4 space-y-3">
              {followUpEvents.length === 0 ? (
                <p className="text-sm text-[#657064]">No follow-up delivery attempts yet.</p>
              ) : (
                followUpEvents.slice(0, 8).map((event) => <EventRow event={event} key={event.id} />)
              )}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

function SequencePanel({ botName, canManage, sequence, messages }: { botName: string; canManage: boolean; sequence: FollowUpSequenceRow; messages: FollowUpMessageRow[] }) {
  return (
    <section className="rounded-lg border border-[#d9ded2] bg-white p-5">
      <div className="flex flex-col gap-3 border-b border-[#e5e9df] pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-[#657064]">{botName}</p>
          <h2 className="mt-2 text-xl font-semibold">{sequence.name}</h2>
          <p className="mt-1 text-sm leading-6 text-[#657064]">{sequence.description}</p>
        </div>
        <form action={updateFollowUpSequenceStatus} className="flex gap-2">
          <input name="sequenceId" type="hidden" value={sequence.id} />
          <select className={fieldClass} defaultValue={sequence.status} disabled={!canManage} name="status">
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
          <button className="rounded-md border border-[#cbd5c7] bg-white px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50" disabled={!canManage} type="submit">
            Save
          </button>
        </form>
      </div>

      <div className="mt-4 space-y-4">
        {messages.map((message) => (
          <form action={updateFollowUpMessage} className="rounded-md border border-[#e5e9df] bg-[#f8faf6] p-4" key={message.id}>
            <input name="messageId" type="hidden" value={message.id} />
            <div className="grid gap-3 md:grid-cols-[140px_160px_1fr]">
              <Field label="Delay minutes">
                <input className={fieldClass} defaultValue={message.delay_minutes} disabled={!canManage} min={0} max={43200} name="delayMinutes" type="number" />
              </Field>
              <Field label="Step status">
                <select className={fieldClass} defaultValue={message.status} disabled={!canManage} name="status">
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </Field>
              <Field label="Subject">
                <input className={fieldClass} defaultValue={message.subject_template} disabled={!canManage} maxLength={200} name="subjectTemplate" />
              </Field>
            </div>
            <Field className="mt-3" label="Body">
              <textarea className={`${textareaClass} min-h-40`} defaultValue={message.body_template} disabled={!canManage} maxLength={4000} name="bodyTemplate" />
            </Field>
            <button className="mt-3 h-10 rounded-md bg-[#173f2f] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!canManage} type="submit">
              Save message
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}

function PreferenceRow({ preference, leads }: { preference: LeadEmailPreferenceRow; leads: Array<{ id: string; email: string | null; name: string | null }> }) {
  const lead = leads.find((candidate) => candidate.email?.toLowerCase() === preference.email);
  return (
    <div className="rounded-md border border-[#e5e9df] bg-[#f8faf6] p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="break-all font-medium">{preference.email}</p>
        <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold capitalize">{preference.status.replace("_", " ")}</span>
      </div>
      {lead ? <Link className="mt-2 inline-block font-semibold text-[#2861a8]" href={`/dashboard/leads/${lead.id}`}>Open {lead.name ?? "lead"}</Link> : null}
    </div>
  );
}

function StateRow({ state, leads }: { state: LeadFollowUpStateRow; leads: Array<{ id: string; name: string | null; email: string | null }> }) {
  const lead = leads.find((candidate) => candidate.id === state.lead_id);
  return (
    <div className="rounded-md border border-[#e5e9df] bg-[#f8faf6] p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{lead?.name ?? lead?.email ?? "Lead"}</p>
        <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold capitalize">{state.status.replace("_", " ")}</span>
      </div>
      <p className="mt-1 text-xs text-[#657064]">Attempts {state.attempt_count}/{state.max_attempts}</p>
      {state.next_send_at ? <p className="mt-1 text-xs text-[#657064]">Next {formatDate(state.next_send_at)}</p> : null}
    </div>
  );
}

function EventRow({ event }: { event: NotificationEventRow }) {
  return (
    <div className="rounded-md border border-[#e5e9df] bg-[#f8faf6] p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="break-all font-medium">{event.recipient_email ?? "Recipient pending"}</p>
        <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold capitalize">{event.status}</span>
      </div>
      {event.error_code ? <p className="mt-1 text-xs text-[#8a3518]">{event.error_code.replaceAll("_", " ")}</p> : null}
      <p className="mt-1 text-xs text-[#657064]">{formatDate(event.created_at)}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-[#d9ded2] bg-white p-4">
      <p className="text-sm text-[#657064]">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function ReadOnlyBadge() {
  return <span className="rounded-full bg-[#f2f5ee] px-2.5 py-1 text-xs font-semibold text-[#657064]">Read only</span>;
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={className ? `block text-sm font-medium ${className}` : "block text-sm font-medium"}>
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function followUpDeliveryStatus() {
  if (process.env.FOLLOW_UP_EMAIL_ENABLED !== "true") {
    return {
      kind: "disabled" as const,
      message: "Follow-up email delivery is disabled in this environment. To send real follow-ups, set FOLLOW_UP_EMAIL_ENABLED=true plus RESEND_API_KEY and RESEND_FROM_EMAIL.",
    };
  }

  if (!process.env.RESEND_API_KEY) {
    return { kind: "missing_provider" as const, message: "Follow-up email delivery is enabled but RESEND_API_KEY is missing." };
  }

  if (!process.env.RESEND_FROM_EMAIL) {
    return { kind: "missing_from" as const, message: "Follow-up email delivery is enabled but RESEND_FROM_EMAIL is missing." };
  }

  return { kind: "ready" as const, message: "Follow-up email delivery is ready for configured workflows." };
}
