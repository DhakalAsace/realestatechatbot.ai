create or replace function public.prevent_last_owner_loss()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_owner_count integer;
begin
  if tg_op = 'UPDATE' and old.role::text = 'owner' and new.role::text = 'owner' then
    return new;
  end if;

  if old.role::text = 'owner' then
    select count(*) into v_owner_count
    from public.workspace_members
    where workspace_id = old.workspace_id
      and role::text = 'owner';

    if v_owner_count <= 1 then
      raise exception 'last_owner_required' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists workspace_members_prevent_last_owner_loss on public.workspace_members;
create trigger workspace_members_prevent_last_owner_loss
before update or delete on public.workspace_members
for each row execute function public.prevent_last_owner_loss();

drop policy if exists "owners and admins can insert audit events" on public.audit_events;

drop policy if exists "workspace creators can add first owner membership" on public.workspace_members;
create policy "workspace creators can add first owner membership" on public.workspace_members
for insert to authenticated with check (
  user_id = (select auth.uid())
  and role = 'owner'
  and exists (
    select 1 from public.workspaces w
    where w.id = workspace_id and w.created_by = (select auth.uid())
  )
);

drop policy if exists "owners and admins can update members" on public.workspace_members;
