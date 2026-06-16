import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createAgentProfile,
  createWorkspaceInvitation,
  removeWorkspaceMember,
  revokeWorkspaceInvitation,
  updateWorkspaceMemberRole,
  updateWorkspaceSettings,
} from "@/app/dashboard/actions";
import { CopyButton } from "@/components/copy-button";
import { getTeamContext, type AgentProfileRow, type AuditEventRow, type WorkspaceInvitationRow, type WorkspaceMemberRow } from "@/lib/data/dashboard";
import { getAppUrl } from "@/lib/env";

type TeamPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

const fieldClass = "h-11 w-full rounded-md border border-[#cbd5c7] bg-white px-3 outline-none focus:border-[#2861a8]";
const managerRoles = new Set(["owner", "admin"]);
const editableRoles = ["owner", "admin", "agent", "viewer"];
const inviteRoles = ["admin", "agent", "viewer"];

const errorText: Record<string, string> = {
  permission: "Only owners and admins can manage team settings.",
  validation: "Check the workspace settings and try again.",
  settings: "Workspace settings could not be saved.",
  "invite-validation": "Enter a valid invite email and role.",
  invite: "Invitation could not be saved. A pending invite may already exist for that email.",
  member: "Member update could not be saved.",
  "last-owner": "A workspace must keep at least one owner.",
  "owner-permission": "Only owners can create, demote, or remove owner members.",
  profile: "Profile could not be saved. Check the fields and try again.",
};

export default async function TeamPage({ searchParams }: TeamPageProps) {
  const [{ user, workspace, membership, members, invitations, auditEvents, agentProfiles }, params] = await Promise.all([getTeamContext(), searchParams]);

  if (!workspace || !membership) redirect("/dashboard/onboarding");

  const canManage = managerRoles.has(membership.role);
  const appUrl = getAppUrl();
  const inviteLink = params.invite ? `${appUrl}/invite/${encodeURIComponent(params.invite)}` : null;
  const error = params.error ? errorText[params.error] ?? "That team change could not be completed." : null;

  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#657064]">Team</p>
          <h1 className="mt-2 text-3xl font-semibold">Workspace settings and routing</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#657064]">
            Manage workspace access, invite links, agent profiles, team profiles, and assignment audit events.
          </p>
        </div>
        <Link className="rounded-md border border-[#cbd5c7] bg-white px-4 py-2 text-sm font-semibold" href="/dashboard/leads">
          Open team inbox
        </Link>
      </div>

      {error ? <p className="mb-4 rounded-md bg-[#fff1eb] px-4 py-3 text-sm font-medium text-[#8a3518]">{error}</p> : null}
      {params.saved ? <p className="mb-4 rounded-md bg-[#eaf5ec] px-4 py-3 text-sm font-medium text-[#173f2f]">Team change saved.</p> : null}
      {inviteLink ? (
        <section className="mb-4 rounded-lg border border-[#bcd7c8] bg-[#edf7f1] p-4">
          <p className="text-sm font-semibold text-[#173f2f]">Invite link ready</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input className={`${fieldClass} font-mono text-xs`} readOnly value={inviteLink} />
            <CopyButton label="Copy invite" value={inviteLink} />
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <section className="space-y-6">
          <WorkspaceSettings canManage={canManage} name={workspace.name} role={membership.role} workspaceId={workspace.id} />
          <MembersPanel canManage={canManage} currentRole={membership.role} currentUserId={user.id} members={members} workspaceId={workspace.id} />
          <ProfilesPanel canManage={canManage} profiles={agentProfiles} workspaceId={workspace.id} />
        </section>

        <aside className="space-y-6">
          <InvitesPanel canManage={canManage} invitations={invitations} workspaceId={workspace.id} />
          <AuditPanel events={auditEvents} />
        </aside>
      </div>
    </main>
  );
}

function WorkspaceSettings({ canManage, name, role, workspaceId }: { canManage: boolean; name: string; role: string; workspaceId: string }) {
  return (
    <section className="rounded-lg border border-[#d9ded2] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Workspace</h2>
          <p className="mt-1 text-sm text-[#657064]">Your role: <span className="font-semibold capitalize text-[#162018]">{role}</span></p>
        </div>
        {!canManage ? <ReadOnlyBadge /> : null}
      </div>
      <form action={updateWorkspaceSettings} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input name="workspaceId" type="hidden" value={workspaceId} />
        <Field label="Workspace name">
          <input className={fieldClass} defaultValue={name} disabled={!canManage} name="name" required />
        </Field>
        <div className="flex items-end">
          <button className="h-11 rounded-md bg-[#173f2f] px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!canManage} type="submit">
            Save settings
          </button>
        </div>
      </form>
    </section>
  );
}

function InvitesPanel({ canManage, invitations, workspaceId }: { canManage: boolean; invitations: WorkspaceInvitationRow[]; workspaceId: string }) {
  return (
    <section className="rounded-lg border border-[#d9ded2] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Invitations</h2>
          <p className="mt-1 text-sm text-[#657064]">Create expiring, email-bound links for teammates.</p>
        </div>
        {!canManage ? <ReadOnlyBadge /> : null}
      </div>

      <form action={createWorkspaceInvitation} className="mt-4 grid gap-3">
        <input name="workspaceId" type="hidden" value={workspaceId} />
        <Field label="Email">
          <input className={fieldClass} disabled={!canManage} name="email" placeholder="agent@example.com" required type="email" />
        </Field>
        <Field label="Role">
          <select className={fieldClass} defaultValue="agent" disabled={!canManage} name="role">
            {inviteRoles.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </Field>
        <button className="h-11 rounded-md bg-[#173f2f] px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!canManage} type="submit">
          Create invite link
        </button>
      </form>

      <div className="mt-5 space-y-3">
        {invitations.length === 0 ? (
          <p className="text-sm text-[#657064]">No invitations yet.</p>
        ) : (
          invitations.map((invite) => (
            <div className="rounded-md border border-[#e5e9df] bg-[#f8faf6] p-3" key={invite.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{invite.email}</p>
                  <p className="mt-1 text-xs capitalize text-[#657064]">{invite.role} / {invite.status}</p>
                </div>
                {invite.status === "pending" && canManage ? (
                  <form action={revokeWorkspaceInvitation}>
                    <input name="invitationId" type="hidden" value={invite.id} />
                    <button className="rounded-md border border-[#efc7b8] bg-[#fff7f3] px-3 py-1.5 text-xs font-semibold text-[#8a3518]" type="submit">
                      Revoke
                    </button>
                  </form>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-[#657064]">Expires {formatDate(invite.expires_at)}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function MembersPanel({ canManage, currentRole, currentUserId, members, workspaceId }: { canManage: boolean; currentRole: string; currentUserId: string; members: WorkspaceMemberRow[]; workspaceId: string }) {
  return (
    <section className="rounded-lg border border-[#d9ded2] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Members</h2>
          <p className="mt-1 text-sm text-[#657064]">Owners and admins can change roles. The final owner is protected.</p>
        </div>
        {!canManage ? <ReadOnlyBadge /> : null}
      </div>
      <div className="mt-4 divide-y divide-[#e5e9df]">
        {members.map((member) => {
          const canEditThisMember = canManage && canManageMemberRole(currentRole, member.role);
          const roleOptions = memberRoleOptions(currentRole, member.role);

          return (
            <div className="grid gap-3 py-4 lg:grid-cols-[1fr_220px_auto] lg:items-center" key={member.user_id}>
              <div>
                <p className="font-mono text-sm">{shortId(member.user_id)}{member.user_id === currentUserId ? " (you)" : ""}</p>
                <p className="mt-1 text-xs capitalize text-[#657064]">{member.role} / joined {formatDate(member.created_at)}</p>
              </div>
              <form action={updateWorkspaceMemberRole} className="flex gap-2">
                <input name="workspaceId" type="hidden" value={workspaceId} />
                <input name="targetUserId" type="hidden" value={member.user_id} />
                <select className={fieldClass} defaultValue={member.role} disabled={!canEditThisMember} name="role">
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
                <button className="rounded-md border border-[#cbd5c7] bg-white px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50" disabled={!canEditThisMember} type="submit">
                  Save
                </button>
              </form>
              <form action={removeWorkspaceMember}>
                <input name="workspaceId" type="hidden" value={workspaceId} />
                <input name="targetUserId" type="hidden" value={member.user_id} />
                <button className="h-11 rounded-md border border-[#efc7b8] bg-[#fff7f3] px-3 text-sm font-semibold text-[#8a3518] disabled:cursor-not-allowed disabled:opacity-50" disabled={!canEditThisMember} type="submit">
                  Remove
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ProfilesPanel({ canManage, profiles, workspaceId }: { canManage: boolean; profiles: AgentProfileRow[]; workspaceId: string }) {
  return (
    <section className="rounded-lg border border-[#d9ded2] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Agent and team profiles</h2>
          <p className="mt-1 text-sm text-[#657064]">Bots and leads can route to an individual or team profile.</p>
        </div>
        {!canManage ? <ReadOnlyBadge /> : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {profiles.map((profile) => (
          <article className="rounded-md border border-[#e5e9df] bg-[#f8faf6] p-4" key={profile.id}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{profile.display_name}</h3>
              <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold capitalize text-[#455247]">{profile.profile_type}</span>
              <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold capitalize text-[#455247]">{profile.status}</span>
            </div>
            <p className="mt-2 text-sm text-[#657064]">{profile.brokerage_name}</p>
            <p className="mt-2 text-sm text-[#657064]">{profile.email ?? "No email"} / {profile.phone ?? "No phone"}</p>
            <p className="mt-2 text-xs text-[#657064]">Linked user: {profile.user_id ? shortId(profile.user_id) : "Not linked"}</p>
          </article>
        ))}
      </div>

      <form action={createAgentProfile} className="mt-5 grid gap-4 border-t border-[#e5e9df] pt-5 md:grid-cols-2">
        <input name="workspaceId" type="hidden" value={workspaceId} />
        <Field label="Profile type">
          <select className={fieldClass} defaultValue="agent" disabled={!canManage} name="profileType">
            <option value="agent">Agent</option>
            <option value="team">Team</option>
          </select>
        </Field>
        <Field label="Linked user ID">
          <input className={fieldClass} disabled={!canManage} name="userId" placeholder="Optional auth user id" />
        </Field>
        <Field label="Display name">
          <input className={fieldClass} disabled={!canManage} name="displayName" placeholder="Sarah Patel" required />
        </Field>
        <Field label="Brokerage/team name">
          <input className={fieldClass} disabled={!canManage} name="brokerageName" placeholder="Northline Realty" required />
        </Field>
        <Field label="Email">
          <input className={fieldClass} disabled={!canManage} name="email" placeholder="agent@example.com" type="email" />
        </Field>
        <Field label="Phone">
          <input className={fieldClass} disabled={!canManage} name="phone" placeholder="+1 204 555 0134" />
        </Field>
        <Field label="City">
          <input className={fieldClass} disabled={!canManage} name="city" placeholder="Winnipeg" />
        </Field>
        <Field label="Service areas">
          <input className={fieldClass} disabled={!canManage} name="serviceAreas" placeholder="Winnipeg, River Heights" />
        </Field>
        <div className="md:col-span-2">
          <button className="h-11 rounded-md bg-[#173f2f] px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!canManage} type="submit">
            Create profile
          </button>
        </div>
      </form>
    </section>
  );
}

function AuditPanel({ events }: { events: AuditEventRow[] }) {
  return (
    <section className="rounded-lg border border-[#d9ded2] bg-white p-5">
      <h2 className="text-lg font-semibold">Audit events</h2>
      <p className="mt-1 text-sm text-[#657064]">Recent membership, profile, assignment, and settings changes.</p>
      <div className="mt-4 space-y-3">
        {events.length === 0 ? (
          <p className="text-sm text-[#657064]">No audit events yet.</p>
        ) : (
          events.map((event) => (
            <div className="rounded-md border border-[#e5e9df] bg-[#f8faf6] p-3" key={event.id}>
              <p className="text-sm font-semibold">{event.action.replaceAll("_", " ")}</p>
              <p className="mt-1 text-xs text-[#657064]">{event.subject_type} / {event.subject_id ? shortId(event.subject_id) : "workspace"}</p>
              <p className="mt-1 text-xs text-[#657064]">{formatDate(event.created_at)}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function ReadOnlyBadge() {
  return <span className="rounded-full bg-[#eef2e8] px-2.5 py-1 text-xs font-semibold text-[#4c5a49]">Read only</span>;
}

function shortId(value: string) {
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function canManageMemberRole(actorRole: string, targetRole: string) {
  if (actorRole === "owner") return true;
  return actorRole === "admin" && targetRole !== "owner";
}

function memberRoleOptions(actorRole: string, targetRole: string) {
  if (actorRole === "owner") return editableRoles;
  if (targetRole === "owner") return ["owner"];
  return editableRoles.filter((role) => role !== "owner");
}
