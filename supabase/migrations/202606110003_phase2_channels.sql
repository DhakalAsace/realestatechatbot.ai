alter type public.channel_type add value if not exists 'qr_code';
alter type public.channel_type add value if not exists 'social_link';
alter type public.channel_type add value if not exists 'campaign';

alter table public.bot_channels
  add column if not exists label text,
  add column if not exists source text,
  add column if not exists medium text,
  add column if not exists campaign text,
  add column if not exists content text;

update public.bot_channels
set
  label = coalesce(label, case type::text
    when 'hosted_link' then 'Hosted link'
    when 'web_embed' then 'Website widget'
    when 'qr_code' then 'QR code'
    when 'social_link' then 'Social link'
    when 'campaign' then 'Campaign link'
    else 'Channel'
  end),
  source = coalesce(source, case type::text
    when 'hosted_link' then 'hosted'
    when 'web_embed' then 'website'
    when 'qr_code' then 'qr'
    when 'social_link' then 'social'
    when 'campaign' then 'campaign'
    else 'direct'
  end),
  medium = coalesce(medium, case type::text
    when 'hosted_link' then 'link'
    when 'web_embed' then 'widget'
    when 'qr_code' then 'qr'
    when 'social_link' then 'social'
    when 'campaign' then 'campaign'
    else 'chat'
  end);

alter table public.bot_channels
  alter column label set not null,
  alter column source set not null,
  alter column medium set not null;

alter table public.bot_channels
  add constraint bot_channels_label_length check (char_length(label) between 2 and 120),
  add constraint bot_channels_source_length check (char_length(source) between 1 and 80),
  add constraint bot_channels_medium_length check (char_length(medium) between 1 and 80),
  add constraint bot_channels_campaign_length check (campaign is null or char_length(campaign) <= 120),
  add constraint bot_channels_content_length check (content is null or char_length(content) <= 120);

alter table public.conversations
  add column if not exists source text,
  add column if not exists medium text,
  add column if not exists campaign text,
  add column if not exists content text,
  add column if not exists term text;

alter table public.leads
  add column if not exists bot_channel_id uuid references public.bot_channels(id) on delete set null,
  add column if not exists source_type public.channel_type,
  add column if not exists source_label text,
  add column if not exists source text,
  add column if not exists medium text,
  add column if not exists campaign text,
  add column if not exists content text,
  add column if not exists term text,
  add column if not exists source_url text,
  add column if not exists referrer text;

update public.conversations c
set
  source = coalesce(c.source, bc.source),
  medium = coalesce(c.medium, bc.medium),
  campaign = coalesce(c.campaign, bc.campaign),
  content = coalesce(c.content, bc.content),
  metadata = coalesce(c.metadata, '{}'::jsonb) || jsonb_build_object(
    'channel', jsonb_build_object(
      'id', bc.id,
      'publicKey', bc.public_key,
      'label', bc.label,
      'type', bc.type
    )
  )
from public.bot_channels bc
where c.bot_channel_id = bc.id;

update public.leads l
set
  bot_channel_id = coalesce(l.bot_channel_id, c.bot_channel_id),
  source_type = coalesce(l.source_type, bc.type),
  source_label = coalesce(l.source_label, bc.label),
  source = coalesce(l.source, c.source, bc.source),
  medium = coalesce(l.medium, c.medium, bc.medium),
  campaign = coalesce(l.campaign, c.campaign, bc.campaign),
  content = coalesce(l.content, c.content, bc.content),
  term = coalesce(l.term, c.term),
  source_url = coalesce(l.source_url, c.source_url),
  referrer = coalesce(l.referrer, c.referrer)
from public.conversations c
join public.bot_channels bc on bc.id = c.bot_channel_id
where l.conversation_id = c.id
  and l.workspace_id = c.workspace_id;

create index if not exists bot_channels_public_key_idx on public.bot_channels(public_key);
create index if not exists bot_channels_workspace_type_idx on public.bot_channels(workspace_id, type, status);
create index if not exists conversations_workspace_channel_idx on public.conversations(workspace_id, bot_channel_id, created_at desc);
create index if not exists leads_workspace_channel_idx on public.leads(workspace_id, bot_channel_id, created_at desc);
create index if not exists leads_workspace_source_idx on public.leads(workspace_id, source_type, created_at desc);

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

  insert into public.bot_channels (
    workspace_id,
    bot_id,
    type,
    status,
    label,
    source,
    medium
  )
  values (
    v_workspace_id,
    v_bot_id,
    'hosted_link',
    'active',
    'Default hosted link',
    'hosted',
    'link'
  )
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
