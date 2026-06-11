create or replace function public.complete_workspace_onboarding(
  p_workspace_name text,
  p_workspace_slug text,
  p_display_name text,
  p_brokerage_name text,
  p_email text,
  p_phone text,
  p_city text,
  p_service_areas text[],
  p_bot_slug text,
  p_brand_color text default '#163f2f'
)
returns table (
  workspace_id uuid,
  agent_profile_id uuid,
  bot_id uuid,
  channel_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_profile_id uuid;
  v_bot_id uuid;
  v_channel_id uuid;
  v_constraint text;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.workspace_members
    where user_id = v_user_id
  ) then
    raise exception 'already_onboarded' using errcode = 'P0001';
  end if;

  if coalesce(p_workspace_name, '') = ''
    or coalesce(p_display_name, '') = ''
    or coalesce(p_brokerage_name, '') = ''
    or coalesce(p_email, '') = ''
    or coalesce(p_phone, '') = ''
    or coalesce(p_city, '') = ''
  then
    raise exception 'missing_required_fields' using errcode = 'P0001';
  end if;

  if p_workspace_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'invalid_workspace_slug' using errcode = 'P0001';
  end if;

  if p_bot_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'invalid_bot_slug' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.bots
    where slug = p_bot_slug
  ) then
    raise exception 'duplicate_bot_slug' using errcode = 'P0001';
  end if;

  insert into public.workspaces (name, slug, created_by)
  values (p_workspace_name, p_workspace_slug, v_user_id)
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, v_user_id, 'owner');

  insert into public.agent_profiles (
    workspace_id,
    user_id,
    display_name,
    brokerage_name,
    email,
    phone,
    city,
    service_areas,
    brand_color
  )
  values (
    v_workspace_id,
    v_user_id,
    p_display_name,
    p_brokerage_name,
    p_email,
    p_phone,
    p_city,
    coalesce(p_service_areas, '{}'::text[]),
    p_brand_color
  )
  returning id into v_profile_id;

  insert into public.bots (
    workspace_id,
    agent_profile_id,
    name,
    slug,
    status,
    greeting,
    fallback_message,
    theme
  )
  values (
    v_workspace_id,
    v_profile_id,
    p_display_name || ' lead assistant',
    p_bot_slug,
    'active',
    'Hi, I am ' || p_display_name || '''s assistant. Are you looking to buy or sell?',
    'I can help with buying, selling, valuations, and showing requests. Are you looking to buy or sell?',
    jsonb_build_object('brandColor', p_brand_color)
  )
  returning id into v_bot_id;

  insert into public.bot_channels (workspace_id, bot_id, type, status)
  values (v_workspace_id, v_bot_id, 'hosted_link', 'active')
  returning id into v_channel_id;

  return query select v_workspace_id, v_profile_id, v_bot_id, v_channel_id;
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;

    if v_constraint = 'bots_slug_key' then
      raise exception 'duplicate_bot_slug' using errcode = 'P0001';
    elsif v_constraint = 'workspaces_slug_key' then
      raise exception 'duplicate_workspace_slug' using errcode = 'P0001';
    else
      raise;
    end if;
end;
$$;

revoke execute on function public.complete_workspace_onboarding(text, text, text, text, text, text, text, text[], text, text) from public;
revoke execute on function public.complete_workspace_onboarding(text, text, text, text, text, text, text, text[], text, text) from anon;
grant execute on function public.complete_workspace_onboarding(text, text, text, text, text, text, text, text[], text, text) to authenticated;
