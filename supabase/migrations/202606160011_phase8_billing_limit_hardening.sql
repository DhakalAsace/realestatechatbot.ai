create or replace function private.billing_current_subscription(target_workspace_id uuid)
returns table(plan_key text, status text, current_period_end timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(s.plan_key, 'free')::text as plan_key,
    coalesce(s.status, 'free')::text as status,
    s.current_period_end
  from (select 1) seed
  left join lateral (
    select plan_key, status, current_period_end
    from public.subscriptions
    where workspace_id = target_workspace_id
    order by updated_at desc
    limit 1
  ) s on true;
$$;

create or replace function private.billing_status_allows_new_usage(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from private.billing_current_subscription(target_workspace_id) s
    where s.status in ('free', 'active', 'trialing')
       or (s.status = 'canceled' and s.current_period_end is not null and s.current_period_end > now())
  );
$$;

create or replace function private.billing_limit_for_feature(target_workspace_id uuid, feature text)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan text;
begin
  select plan_key into v_plan
  from private.billing_current_subscription(target_workspace_id)
  limit 1;

  v_plan := coalesce(v_plan, 'free');

  return case feature
    when 'active_bots' then case v_plan when 'pro' then 25 when 'starter' then 5 else 2 end
    when 'channels' then case v_plan when 'pro' then 250 when 'starter' then 50 else 12 end
    when 'team_members' then case v_plan when 'pro' then 50 when 'starter' then 10 else 5 end
    when 'properties' then case v_plan when 'pro' then 1000 when 'starter' then 100 else 25 end
    when 'knowledge_documents' then case v_plan when 'pro' then 1000 when 'starter' then 100 else 25 end
    when 'monthly_chat_turns' then case v_plan when 'pro' then 20000 when 'starter' then 3000 else 500 end
    when 'monthly_ai_messages' then case v_plan when 'pro' then 10000 when 'starter' then 1000 else 100 end
    when 'monthly_follow_up_emails' then case v_plan when 'pro' then 10000 when 'starter' then 1000 else 100 end
    else 0
  end;
end;
$$;

create or replace function private.feature_for_usage_event(event_type text)
returns text
language sql
immutable
as $$
  select case event_type
    when 'chat_turn' then 'monthly_chat_turns'
    when 'ai_message' then 'monthly_ai_messages'
    when 'follow_up_email' then 'monthly_follow_up_emails'
    else null
  end;
$$;

create or replace function public.reserve_usage_event(
  p_workspace_id uuid,
  p_event_type text,
  p_quantity integer,
  p_source_type text,
  p_source_id uuid,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns table(allowed boolean, used integer, limit_value integer, idempotent boolean, usage_event_id uuid, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_feature text;
  v_period_start date := date_trunc('month', now())::date;
  v_used integer := 0;
  v_limit integer := 0;
  v_existing public.usage_events%rowtype;
  v_inserted_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid_usage_quantity' using errcode = '23514';
  end if;

  v_feature := private.feature_for_usage_event(p_event_type);
  if v_feature is null then
    raise exception 'unsupported_usage_event_type' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_workspace_id::text || ':' || p_event_type || ':' || v_period_start::text));

  select * into v_existing
  from public.usage_events
  where workspace_id = p_workspace_id
    and idempotency_key = p_idempotency_key
  limit 1;

  select coalesce(sum(quantity), 0)::integer into v_used
  from public.usage_events
  where workspace_id = p_workspace_id
    and event_type = p_event_type
    and period_start = v_period_start;

  v_limit := private.billing_limit_for_feature(p_workspace_id, v_feature);

  if v_existing.id is not null then
    return query select true, v_used, v_limit, true, v_existing.id, null::text;
    return;
  end if;

  if not private.billing_status_allows_new_usage(p_workspace_id) then
    return query select false, v_used, v_limit, false, null::uuid, 'subscription_inactive'::text;
    return;
  end if;

  if v_used + p_quantity > v_limit then
    return query select false, v_used, v_limit, false, null::uuid, 'limit_reached'::text;
    return;
  end if;

  insert into public.usage_events (
    workspace_id,
    event_type,
    quantity,
    source_type,
    source_id,
    idempotency_key,
    period_start,
    metadata
  ) values (
    p_workspace_id,
    p_event_type,
    p_quantity,
    p_source_type,
    p_source_id,
    p_idempotency_key,
    v_period_start,
    coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_inserted_id;

  insert into public.usage_rollups(workspace_id, event_type, period_start, quantity)
  values (p_workspace_id, p_event_type, v_period_start, p_quantity)
  on conflict (workspace_id, event_type, period_start)
  do update set quantity = public.usage_rollups.quantity + excluded.quantity, updated_at = now();

  return query select true, v_used + p_quantity, v_limit, false, v_inserted_id, null::text;
end;
$$;

revoke all on function public.reserve_usage_event(uuid, text, integer, text, uuid, text, jsonb) from public;
revoke all on function public.reserve_usage_event(uuid, text, integer, text, uuid, text, jsonb) from anon;
revoke all on function public.reserve_usage_event(uuid, text, integer, text, uuid, text, jsonb) from authenticated;
grant execute on function public.reserve_usage_event(uuid, text, integer, text, uuid, text, jsonb) to service_role;

create or replace function public.enforce_workspace_billing_resource_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_feature text;
  v_workspace_id uuid;
  v_limit integer;
  v_used integer;
begin
  if tg_table_name = 'bots' then
    if tg_op = 'UPDATE' and not (new.status::text = 'active' and old.status::text <> 'active') then
      return new;
    end if;
    if tg_op = 'INSERT' and new.status::text <> 'active' then
      return new;
    end if;
    v_feature := 'active_bots';
    v_workspace_id := new.workspace_id;
    perform pg_advisory_xact_lock(hashtext(v_workspace_id::text || ':' || v_feature));
    select count(*)::integer into v_used from public.bots where workspace_id = v_workspace_id and status::text = 'active' and id <> new.id;
  elsif tg_table_name = 'bot_channels' then
    if tg_op = 'UPDATE' and not (new.status::text = 'active' and old.status::text <> 'active') then
      return new;
    end if;
    if tg_op = 'INSERT' and new.status::text <> 'active' then
      return new;
    end if;
    v_feature := 'channels';
    v_workspace_id := new.workspace_id;
    perform pg_advisory_xact_lock(hashtext(v_workspace_id::text || ':' || v_feature));
    select count(*)::integer into v_used from public.bot_channels where workspace_id = v_workspace_id and status::text = 'active' and id <> new.id;
  elsif tg_table_name = 'workspace_members' then
    if tg_op <> 'INSERT' then
      return new;
    end if;
    v_feature := 'team_members';
    v_workspace_id := new.workspace_id;
    perform pg_advisory_xact_lock(hashtext(v_workspace_id::text || ':' || v_feature));
    select count(*)::integer into v_used from public.workspace_members where workspace_id = v_workspace_id and user_id <> new.user_id;
  elsif tg_table_name = 'properties' then
    if tg_op <> 'INSERT' then
      return new;
    end if;
    v_feature := 'properties';
    v_workspace_id := new.workspace_id;
    perform pg_advisory_xact_lock(hashtext(v_workspace_id::text || ':' || v_feature));
    select count(*)::integer into v_used from public.properties where workspace_id = v_workspace_id and id <> new.id;
  elsif tg_table_name = 'knowledge_documents' then
    if tg_op <> 'INSERT' then
      return new;
    end if;
    v_feature := 'knowledge_documents';
    v_workspace_id := new.workspace_id;
    perform pg_advisory_xact_lock(hashtext(v_workspace_id::text || ':' || v_feature));
    select count(*)::integer into v_used from public.knowledge_documents where workspace_id = v_workspace_id and id <> new.id;
  else
    return new;
  end if;

  if not private.billing_status_allows_new_usage(v_workspace_id) then
    raise exception 'billing_subscription_inactive' using errcode = '23514';
  end if;

  v_limit := private.billing_limit_for_feature(v_workspace_id, v_feature);
  if v_used + 1 > v_limit then
    raise exception 'billing_limit_%', v_feature using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists bots_enforce_billing_limit on public.bots;
create trigger bots_enforce_billing_limit
before insert or update on public.bots
for each row execute function public.enforce_workspace_billing_resource_limit();

drop trigger if exists bot_channels_enforce_billing_limit on public.bot_channels;
create trigger bot_channels_enforce_billing_limit
before insert or update on public.bot_channels
for each row execute function public.enforce_workspace_billing_resource_limit();

drop trigger if exists workspace_members_enforce_billing_limit on public.workspace_members;
create trigger workspace_members_enforce_billing_limit
before insert on public.workspace_members
for each row execute function public.enforce_workspace_billing_resource_limit();

drop trigger if exists properties_enforce_billing_limit on public.properties;
create trigger properties_enforce_billing_limit
before insert on public.properties
for each row execute function public.enforce_workspace_billing_resource_limit();

drop trigger if exists knowledge_documents_enforce_billing_limit on public.knowledge_documents;
create trigger knowledge_documents_enforce_billing_limit
before insert on public.knowledge_documents
for each row execute function public.enforce_workspace_billing_resource_limit();
