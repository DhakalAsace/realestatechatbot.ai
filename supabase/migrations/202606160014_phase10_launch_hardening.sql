-- Phase 10 launch hardening: durable public endpoint rate limits.

create table if not exists public.public_rate_limits (
  bucket_key text primary key,
  count integer not null default 0 check (count >= 0),
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.public_rate_limits enable row level security;

revoke all on public.public_rate_limits from anon, authenticated;

create or replace function public.reserve_public_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_count integer;
  v_reset_at timestamptz;
begin
  if p_bucket_key is null or length(trim(p_bucket_key)) < 8 or length(p_bucket_key) > 240 then
    raise exception 'invalid rate limit bucket';
  end if;

  if p_limit < 1 or p_limit > 10000 then
    raise exception 'invalid rate limit size';
  end if;

  if p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit window';
  end if;

  insert into public.public_rate_limits (bucket_key, count, reset_at, updated_at)
  values (p_bucket_key, 1, v_now + make_interval(secs => p_window_seconds), v_now)
  on conflict (bucket_key) do update
    set count = case
        when public.public_rate_limits.reset_at <= v_now then 1
        else public.public_rate_limits.count + 1
      end,
      reset_at = case
        when public.public_rate_limits.reset_at <= v_now then v_now + make_interval(secs => p_window_seconds)
        else public.public_rate_limits.reset_at
      end,
      updated_at = v_now
  returning public.public_rate_limits.count, public.public_rate_limits.reset_at
  into v_count, v_reset_at;

  allowed := v_count <= p_limit;
  remaining := greatest(p_limit - v_count, 0);
  reset_at := v_reset_at;
  return next;
end;
$$;

revoke all on function public.reserve_public_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_public_rate_limit(text, integer, integer) to service_role;

create table if not exists public.abuse_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  bot_id uuid references public.bots(id) on delete cascade,
  bot_channel_id uuid references public.bot_channels(id) on delete cascade,
  route text not null,
  reason text not null,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists abuse_events_workspace_created_idx on public.abuse_events(workspace_id, created_at desc);
create index if not exists abuse_events_reason_created_idx on public.abuse_events(reason, created_at desc);

alter table public.abuse_events enable row level security;

revoke all on public.abuse_events from anon, authenticated;
grant select on public.abuse_events to authenticated;

drop policy if exists "owners and admins can read abuse events" on public.abuse_events;
create policy "owners and admins can read abuse events" on public.abuse_events
for select to authenticated using (
  workspace_id is not null
  and private.has_workspace_role_text(workspace_id, array['owner','admin'])
);

drop policy if exists "members can read audit events" on public.audit_events;
drop policy if exists "owners and admins can read audit events" on public.audit_events;
create policy "owners and admins can read audit events" on public.audit_events
for select to authenticated using (private.has_workspace_role_text(workspace_id, array['owner','admin']));
