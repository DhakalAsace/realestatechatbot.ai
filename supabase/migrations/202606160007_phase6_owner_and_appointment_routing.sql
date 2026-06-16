create or replace function public.prevent_last_owner_loss()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_owner_count integer;
  v_workspace_id uuid;
begin
  v_workspace_id := old.workspace_id;
  perform pg_advisory_xact_lock(hashtextextended(v_workspace_id::text, 0));

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
  v_assigned_agent_profile_id uuid;
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

  v_assigned_agent_profile_id := coalesce(v_lead.assigned_agent_profile_id, v_lead.agent_profile_id);

  select * into v_bot
  from public.bots
  where id = p_bot_id
    and workspace_id = p_workspace_id
    and status = 'active';

  if not found then
    raise exception 'appointment_requires_active_bot' using errcode = '23514';
  end if;

  if v_assigned_agent_profile_id is not null then
    select * into v_agent
    from public.agent_profiles
    where id = v_assigned_agent_profile_id
      and workspace_id = p_workspace_id
      and status = 'active';
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
    assigned_agent_profile_id,
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
    v_assigned_agent_profile_id,
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
