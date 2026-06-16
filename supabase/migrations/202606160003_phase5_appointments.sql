do $$
begin
  create type public.appointment_type as enum ('buyer_consultation', 'seller_valuation', 'showing', 'general_followup');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.appointment_status as enum ('requested', 'acknowledged', 'confirmed', 'declined', 'cancelled', 'completed');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.notification_status as enum ('pending', 'sent', 'failed', 'skipped');
exception when duplicate_object then null;
end $$;

alter table public.agent_profiles add column if not exists calendar_url text;
alter table public.bots add column if not exists appointment_config jsonb not null default '{}'::jsonb;

do $$
begin
  alter table public.agent_profiles
    add constraint agent_profiles_calendar_url_check
    check (calendar_url is null or (char_length(calendar_url) <= 500 and calendar_url ~ '^https?://'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.bots
    add constraint bots_appointment_config_object_check
    check (jsonb_typeof(appointment_config) = 'object');
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.leads add constraint leads_id_workspace_unique unique (id, workspace_id);
exception when duplicate_object then null;
end $$;

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null,
  conversation_id uuid not null,
  bot_id uuid not null,
  bot_channel_id uuid not null,
  agent_profile_id uuid,
  property_id uuid references public.properties(id) on delete set null,
  request_type public.appointment_type not null,
  status public.appointment_status not null default 'requested',
  preferred_time_text text not null check (char_length(preferred_time_text) between 2 and 240),
  preferred_start_at timestamptz,
  preferred_end_at timestamptz,
  timezone text not null default 'America/Winnipeg' check (char_length(timezone) <= 80),
  visitor_notes text check (visitor_notes is null or char_length(visitor_notes) <= 1200),
  agent_notes text check (agent_notes is null or char_length(agent_notes) <= 2000),
  calendar_url text check (calendar_url is null or (char_length(calendar_url) <= 500 and calendar_url ~ '^https?://')),
  idempotency_key text not null check (char_length(idempotency_key) between 16 and 200),
  requested_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, idempotency_key),
  constraint appointments_lead_workspace_fk foreign key (lead_id, workspace_id)
    references public.leads(id, workspace_id) on delete cascade,
  constraint appointments_conversation_workspace_fk foreign key (conversation_id, workspace_id)
    references public.conversations(id, workspace_id) on delete cascade,
  constraint appointments_bot_workspace_fk foreign key (bot_id, workspace_id)
    references public.bots(id, workspace_id) on delete cascade,
  constraint appointments_channel_workspace_fk foreign key (bot_channel_id, workspace_id)
    references public.bot_channels(id, workspace_id) on delete cascade,
  constraint appointments_agent_profile_workspace_fk foreign key (agent_profile_id, workspace_id)
    references public.agent_profiles(id, workspace_id) on delete set null
);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  appointment_id uuid,
  lead_id uuid,
  event_type text not null check (event_type in ('appointment_requested')),
  channel text not null check (channel in ('email')),
  recipient_type text not null check (recipient_type in ('agent')),
  recipient_email text check (recipient_email is null or char_length(recipient_email) <= 320),
  status public.notification_status not null default 'pending',
  provider text not null default 'resend' check (char_length(provider) <= 80),
  provider_message_id text check (provider_message_id is null or char_length(provider_message_id) <= 200),
  idempotency_key text not null check (char_length(idempotency_key) between 16 and 240),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  error_code text check (error_code is null or char_length(error_code) <= 120),
  error_message text check (error_message is null or char_length(error_message) <= 500),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key),
  constraint notification_events_appointment_workspace_fk foreign key (appointment_id, workspace_id)
    references public.appointments(id, workspace_id) on delete cascade,
  constraint notification_events_lead_workspace_fk foreign key (lead_id, workspace_id)
    references public.leads(id, workspace_id) on delete cascade
);

create index if not exists appointments_workspace_requested_idx on public.appointments(workspace_id, requested_at desc);
create index if not exists appointments_lead_idx on public.appointments(lead_id, requested_at desc);
create index if not exists appointments_status_idx on public.appointments(workspace_id, status, requested_at desc);
create index if not exists notification_events_workspace_created_idx on public.notification_events(workspace_id, created_at desc);
create index if not exists notification_events_status_idx on public.notification_events(status, next_attempt_at, created_at);

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at before update on public.appointments
for each row execute function public.set_updated_at();

drop trigger if exists notification_events_set_updated_at on public.notification_events;
create trigger notification_events_set_updated_at before update on public.notification_events
for each row execute function public.set_updated_at();

create or replace function public.enforce_appointment_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.leads l
    join public.conversations c on c.id = l.conversation_id and c.workspace_id = l.workspace_id
    join public.bots b on b.id = l.bot_id and b.workspace_id = l.workspace_id
    join public.bot_channels bc on bc.id = coalesce(l.bot_channel_id, new.bot_channel_id) and bc.workspace_id = l.workspace_id and bc.bot_id = b.id
    where l.id = new.lead_id
      and l.workspace_id = new.workspace_id
      and l.conversation_id = new.conversation_id
      and l.bot_id = new.bot_id
      and coalesce(l.bot_channel_id, new.bot_channel_id) = new.bot_channel_id
      and (coalesce(l.email, '') <> '' or coalesce(l.phone, '') <> '')
      and c.id = new.conversation_id
      and b.id = new.bot_id
      and bc.id = new.bot_channel_id
  ) then
    raise exception 'appointment_lead_workspace_mismatch' using errcode = '23514';
  end if;

  if new.property_id is not null and not exists (
    select 1
    from public.properties p
    where p.id = new.property_id
      and p.workspace_id = new.workspace_id
      and p.bot_id = new.bot_id
      and p.status = 'active'
  ) then
    raise exception 'appointment_property_workspace_mismatch' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_workspace_integrity on public.appointments;
create trigger appointments_workspace_integrity
before insert or update of workspace_id, lead_id, conversation_id, bot_id, bot_channel_id, property_id on public.appointments
for each row execute function public.enforce_appointment_integrity();

alter table public.appointments enable row level security;
alter table public.notification_events enable row level security;

drop policy if exists "members can read appointments" on public.appointments;
create policy "members can read appointments" on public.appointments
for select to authenticated using (private.is_workspace_member(workspace_id));

drop policy if exists "owners and admins can update appointments" on public.appointments;
create policy "owners and admins can update appointments" on public.appointments
for update to authenticated using (private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

drop policy if exists "members can read notification events" on public.notification_events;
create policy "members can read notification events" on public.notification_events
for select to authenticated using (private.is_workspace_member(workspace_id));

create or replace function public.record_chat_turn_with_appointment(
  p_workspace_id uuid,
  p_bot_id uuid,
  p_bot_channel_id uuid,
  p_conversation_id uuid,
  p_visitor_message text,
  p_bot_reply text,
  p_bot_message_json jsonb,
  p_current_state jsonb,
  p_flow_type public.lead_intent,
  p_conversation_status public.conversation_status,
  p_completed_at timestamptz,
  p_agent_profile_id uuid,
  p_lead jsonb,
  p_lead_status public.lead_status,
  p_lead_temperature public.lead_temperature,
  p_score integer,
  p_source_type public.channel_type,
  p_source_label text,
  p_source text,
  p_medium text,
  p_campaign text,
  p_content text,
  p_term text,
  p_source_url text,
  p_referrer text,
  p_summary text,
  p_appointment_request_type public.appointment_type default null,
  p_appointment_preferred_time_text text default null,
  p_appointment_notes text default null,
  p_appointment_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
  v_agent public.agent_profiles%rowtype;
  v_bot public.bots%rowtype;
  v_calendar_url text;
  v_recipient_email text;
  v_appointment_id uuid;
  v_notification_event_id uuid;
  v_notification_status public.notification_status := 'pending';
  v_notification_key text;
begin
  perform public.record_chat_turn(
    p_workspace_id,
    p_bot_id,
    p_bot_channel_id,
    p_conversation_id,
    p_visitor_message,
    p_bot_reply,
    p_bot_message_json,
    p_current_state,
    p_flow_type,
    p_conversation_status,
    p_completed_at,
    p_agent_profile_id,
    p_lead,
    p_lead_status,
    p_lead_temperature,
    p_score,
    p_source_type,
    p_source_label,
    p_source,
    p_medium,
    p_campaign,
    p_content,
    p_term,
    p_source_url,
    p_referrer,
    p_summary
  );

  if p_appointment_request_type is null then
    return jsonb_build_object('appointmentId', null, 'notificationEventId', null, 'recipientEmail', null, 'calendarUrl', null);
  end if;

  if coalesce(p_appointment_preferred_time_text, '') = '' or char_length(p_appointment_preferred_time_text) > 240 then
    raise exception 'invalid_appointment_time' using errcode = '22001';
  end if;

  if coalesce(p_appointment_idempotency_key, '') = '' or char_length(p_appointment_idempotency_key) > 200 then
    raise exception 'invalid_appointment_idempotency_key' using errcode = '22001';
  end if;

  select * into v_lead
  from public.leads
  where workspace_id = p_workspace_id
    and conversation_id = p_conversation_id
    and bot_id = p_bot_id;

  if not found or (coalesce(v_lead.email, '') = '' and coalesce(v_lead.phone, '') = '') then
    raise exception 'appointment_requires_contact_lead' using errcode = '23514';
  end if;

  select * into v_bot
  from public.bots
  where id = p_bot_id
    and workspace_id = p_workspace_id
    and status = 'active';

  if not found then
    raise exception 'appointment_requires_active_bot' using errcode = '23514';
  end if;

  if v_lead.agent_profile_id is not null then
    select * into v_agent
    from public.agent_profiles
    where id = v_lead.agent_profile_id
      and workspace_id = p_workspace_id;
  end if;

  v_recipient_email := nullif(v_agent.email, '');
  v_calendar_url := coalesce(nullif(v_bot.appointment_config->>'calendarUrl', ''), nullif(v_agent.calendar_url, ''));

  if v_calendar_url is not null and v_calendar_url !~ '^https?://' then
    v_calendar_url := null;
  end if;

  insert into public.appointments (
    workspace_id,
    lead_id,
    conversation_id,
    bot_id,
    bot_channel_id,
    agent_profile_id,
    request_type,
    status,
    preferred_time_text,
    timezone,
    visitor_notes,
    calendar_url,
    idempotency_key,
    metadata
  )
  values (
    p_workspace_id,
    v_lead.id,
    p_conversation_id,
    p_bot_id,
    p_bot_channel_id,
    v_lead.agent_profile_id,
    p_appointment_request_type,
    'requested',
    p_appointment_preferred_time_text,
    coalesce(nullif(v_agent.timezone, ''), 'America/Winnipeg'),
    nullif(p_appointment_notes, ''),
    v_calendar_url,
    p_appointment_idempotency_key,
    jsonb_build_object(
      'source', 'chat',
      'leadStatus', p_lead_status,
      'score', p_score,
      'channel', jsonb_build_object('type', p_source_type, 'label', p_source_label)
    )
  )
  on conflict (workspace_id, idempotency_key) do update
  set updated_at = public.appointments.updated_at
  returning id into v_appointment_id;

  v_notification_key := p_appointment_idempotency_key || ':agent-email';
  if v_recipient_email is null then
    v_notification_status := 'skipped';
  end if;

  insert into public.notification_events (
    workspace_id,
    appointment_id,
    lead_id,
    event_type,
    channel,
    recipient_type,
    recipient_email,
    status,
    provider,
    idempotency_key,
    payload
  )
  values (
    p_workspace_id,
    v_appointment_id,
    v_lead.id,
    'appointment_requested',
    'email',
    'agent',
    v_recipient_email,
    v_notification_status,
    'resend',
    v_notification_key,
    jsonb_build_object(
      'appointmentType', p_appointment_request_type,
      'preferredTimeText', p_appointment_preferred_time_text,
      'leadName', v_lead.name,
      'leadEmail', v_lead.email,
      'leadPhone', v_lead.phone,
      'calendarUrl', v_calendar_url
    )
  )
  on conflict (workspace_id, idempotency_key) do update
  set updated_at = public.notification_events.updated_at
  returning id into v_notification_event_id;

  return jsonb_build_object(
    'appointmentId', v_appointment_id,
    'notificationEventId', v_notification_event_id,
    'recipientEmail', v_recipient_email,
    'calendarUrl', v_calendar_url
  );
end;
$$;

revoke execute on function public.record_chat_turn_with_appointment(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  jsonb,
  jsonb,
  public.lead_intent,
  public.conversation_status,
  timestamptz,
  uuid,
  jsonb,
  public.lead_status,
  public.lead_temperature,
  integer,
  public.channel_type,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  public.appointment_type,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.record_chat_turn_with_appointment(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  jsonb,
  jsonb,
  public.lead_intent,
  public.conversation_status,
  timestamptz,
  uuid,
  jsonb,
  public.lead_status,
  public.lead_temperature,
  integer,
  public.channel_type,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  public.appointment_type,
  text,
  text,
  text
) to service_role;
