alter type public.workspace_role add value if not exists 'agent';
alter type public.workspace_role add value if not exists 'viewer';

create or replace function private.has_workspace_role_text(target_workspace_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role::text = any(allowed_roles)
  );
$$;

grant execute on function private.has_workspace_role_text(uuid, text[]) to authenticated;

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 320),
  role text not null check (role in ('admin', 'agent', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  token_hash text not null unique check (char_length(token_hash) between 32 and 128),
  invited_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 days'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, email, status)
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 2 and 120),
  subject_type text not null check (char_length(subject_type) between 2 and 80),
  subject_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workspace_invitations_workspace_created_idx on public.workspace_invitations(workspace_id, created_at desc);
create index if not exists workspace_invitations_email_status_idx on public.workspace_invitations(lower(email), status, expires_at);
create index if not exists audit_events_workspace_created_idx on public.audit_events(workspace_id, created_at desc);

drop trigger if exists workspace_invitations_set_updated_at on public.workspace_invitations;
create trigger workspace_invitations_set_updated_at before update on public.workspace_invitations
for each row execute function public.set_updated_at();

alter table public.workspace_invitations enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists "owners and admins can read invitations" on public.workspace_invitations;
create policy "owners and admins can read invitations" on public.workspace_invitations
for select to authenticated using (private.has_workspace_role_text(workspace_id, array['owner','admin']));

drop policy if exists "owners and admins can insert invitations" on public.workspace_invitations;
create policy "owners and admins can insert invitations" on public.workspace_invitations
for insert to authenticated with check (private.has_workspace_role_text(workspace_id, array['owner','admin']) and invited_by = (select auth.uid()));

drop policy if exists "owners and admins can update invitations" on public.workspace_invitations;
create policy "owners and admins can update invitations" on public.workspace_invitations
for update to authenticated using (private.has_workspace_role_text(workspace_id, array['owner','admin']))
with check (private.has_workspace_role_text(workspace_id, array['owner','admin']));

drop policy if exists "members can read audit events" on public.audit_events;
create policy "members can read audit events" on public.audit_events
for select to authenticated using (private.is_workspace_member(workspace_id));

drop policy if exists "owners and admins can insert audit events" on public.audit_events;
create policy "owners and admins can insert audit events" on public.audit_events
for insert to authenticated with check (private.has_workspace_role_text(workspace_id, array['owner','admin']));

drop policy if exists "owners and admins can update members" on public.workspace_members;
create policy "owners and admins can update members" on public.workspace_members
for update to authenticated using (private.has_workspace_role_text(workspace_id, array['owner','admin']))
with check (private.has_workspace_role_text(workspace_id, array['owner','admin']));

drop policy if exists "members can update conversations" on public.conversations;
create policy "agents and admins can update conversations" on public.conversations
for update to authenticated using (private.has_workspace_role_text(workspace_id, array['owner','admin','agent','member']))
with check (private.has_workspace_role_text(workspace_id, array['owner','admin','agent','member']));

drop policy if exists "members can update leads" on public.leads;
create policy "agents and admins can update leads" on public.leads
for update to authenticated using (private.has_workspace_role_text(workspace_id, array['owner','admin','agent','member']))
with check (private.has_workspace_role_text(workspace_id, array['owner','admin','agent','member']));

drop policy if exists "owners and admins can update appointments" on public.appointments;
create policy "agents and admins can update appointments" on public.appointments
for update to authenticated using (private.has_workspace_role_text(workspace_id, array['owner','admin','agent','member']))
with check (private.has_workspace_role_text(workspace_id, array['owner','admin','agent','member']));

drop policy if exists "owners and admins can insert agent profiles" on public.agent_profiles;
create policy "owners and admins can insert agent profiles" on public.agent_profiles
for insert to authenticated with check (private.has_workspace_role_text(workspace_id, array['owner','admin']));

drop policy if exists "owners and admins can update agent profiles" on public.agent_profiles;
create policy "owners admins and profile owners can update agent profiles" on public.agent_profiles
for update to authenticated using (
  private.has_workspace_role_text(workspace_id, array['owner','admin'])
  or (user_id = (select auth.uid()) and private.has_workspace_role_text(workspace_id, array['agent','member']))
)
with check (
  private.has_workspace_role_text(workspace_id, array['owner','admin'])
  or (user_id = (select auth.uid()) and private.has_workspace_role_text(workspace_id, array['agent','member']))
);

create or replace function public.accept_workspace_invitation(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
  v_invitation public.workspace_invitations%rowtype;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_invitation
  from public.workspace_invitations
  where token_hash = p_token_hash
    and status = 'pending'
    and expires_at > now()
  for update;

  if not found then
    raise exception 'invitation_not_found' using errcode = 'P0001';
  end if;

  if lower(v_invitation.email) <> v_email then
    raise exception 'invitation_email_mismatch' using errcode = 'P0001';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, invited_by)
  values (v_invitation.workspace_id, v_user_id, v_invitation.role::public.workspace_role, v_invitation.invited_by)
  on conflict (workspace_id, user_id) do update
  set role = excluded.role,
      invited_by = excluded.invited_by;

  update public.workspace_invitations
  set status = 'accepted', accepted_by = v_user_id, accepted_at = now()
  where id = v_invitation.id;

  insert into public.audit_events (workspace_id, actor_user_id, target_user_id, action, subject_type, subject_id, metadata)
  values (
    v_invitation.workspace_id,
    v_invitation.invited_by,
    v_user_id,
    'workspace_invitation_accepted',
    'workspace_member',
    v_user_id,
    jsonb_build_object('role', v_invitation.role, 'invitationId', v_invitation.id)
  );

  return v_invitation.workspace_id;
end;
$$;

revoke execute on function public.accept_workspace_invitation(text) from public, anon;
grant execute on function public.accept_workspace_invitation(text) to authenticated;
