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

