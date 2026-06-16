alter table public.agent_profiles add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.agent_profiles add column if not exists profile_type text not null default 'agent' check (profile_type in ('agent', 'team'));
alter table public.agent_profiles add column if not exists status text not null default 'active' check (status in ('active', 'archived'));

alter table public.leads add column if not exists assigned_agent_profile_id uuid;
alter table public.leads add column if not exists assigned_at timestamptz;
alter table public.leads add column if not exists assigned_by uuid references auth.users(id) on delete set null;

alter table public.appointments add column if not exists assigned_agent_profile_id uuid;

do $$
begin
  alter table public.leads
    add constraint leads_assigned_agent_profile_workspace_fk foreign key (assigned_agent_profile_id, workspace_id)
    references public.agent_profiles(id, workspace_id) on delete set null;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.appointments
    add constraint appointments_assigned_agent_profile_workspace_fk foreign key (assigned_agent_profile_id, workspace_id)
    references public.agent_profiles(id, workspace_id) on delete set null;
exception when duplicate_object then null;
end $$;

create index if not exists agent_profiles_workspace_status_idx on public.agent_profiles(workspace_id, status, profile_type);
create index if not exists leads_assigned_profile_idx on public.leads(workspace_id, assigned_agent_profile_id, created_at desc);
create index if not exists appointments_assigned_profile_idx on public.appointments(workspace_id, assigned_agent_profile_id, requested_at desc);

create or replace function public.default_lead_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.assigned_agent_profile_id is null then
    new.assigned_agent_profile_id := new.agent_profile_id;
  end if;

  if new.assigned_agent_profile_id is not null and (
    tg_op = 'INSERT'
    or old.assigned_agent_profile_id is distinct from new.assigned_agent_profile_id
  ) then
    new.assigned_at := coalesce(new.assigned_at, now());
  end if;

  if new.assigned_agent_profile_id is not null and not exists (
    select 1
    from public.agent_profiles ap
    where ap.id = new.assigned_agent_profile_id
      and ap.workspace_id = new.workspace_id
      and ap.status = 'active'
  ) then
    raise exception 'lead_assignment_profile_mismatch' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists leads_default_assignment on public.leads;
create trigger leads_default_assignment
before insert or update of assigned_agent_profile_id, agent_profile_id, workspace_id on public.leads
for each row execute function public.default_lead_assignment();

create or replace function public.default_appointment_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.assigned_agent_profile_id is null then
    new.assigned_agent_profile_id := new.agent_profile_id;
  end if;

  if new.assigned_agent_profile_id is not null and not exists (
    select 1
    from public.agent_profiles ap
    where ap.id = new.assigned_agent_profile_id
      and ap.workspace_id = new.workspace_id
      and ap.status = 'active'
  ) then
    raise exception 'appointment_assignment_profile_mismatch' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_default_assignment on public.appointments;
create trigger appointments_default_assignment
before insert or update of assigned_agent_profile_id, agent_profile_id, workspace_id on public.appointments
for each row execute function public.default_appointment_assignment();

create or replace function private.can_update_lead(target_workspace_id uuid, target_assigned_profile_id uuid)
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
      and (
        wm.role::text = any(array['owner','admin','member'])
        or (
          wm.role::text = 'agent'
          and exists (
            select 1 from public.agent_profiles ap
            where ap.workspace_id = target_workspace_id
              and ap.id = target_assigned_profile_id
              and ap.user_id = wm.user_id
          )
        )
      )
  );
$$;

grant execute on function private.can_update_lead(uuid, uuid) to authenticated;

drop policy if exists "agents and admins can update leads" on public.leads;
create policy "agents and admins can update leads" on public.leads
for update to authenticated using (private.can_update_lead(workspace_id, assigned_agent_profile_id))
with check (private.can_update_lead(workspace_id, assigned_agent_profile_id));

drop policy if exists "agents and admins can update appointments" on public.appointments;
create policy "agents and admins can update appointments" on public.appointments
for update to authenticated using (private.can_update_lead(workspace_id, assigned_agent_profile_id))
with check (private.can_update_lead(workspace_id, assigned_agent_profile_id));

update public.agent_profiles set status = 'active' where status is null;
update public.leads set assigned_agent_profile_id = agent_profile_id, assigned_at = coalesce(assigned_at, created_at) where assigned_agent_profile_id is null and agent_profile_id is not null;
update public.appointments set assigned_agent_profile_id = agent_profile_id where assigned_agent_profile_id is null and agent_profile_id is not null;
