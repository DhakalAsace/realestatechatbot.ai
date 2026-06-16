create or replace function public.enforce_lead_channel_workspace()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.bot_channel_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.bot_channels bc
    where bc.id = new.bot_channel_id
      and bc.workspace_id = new.workspace_id
      and bc.bot_id = new.bot_id
  ) then
    raise exception 'lead_channel_workspace_mismatch' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists leads_channel_workspace_integrity on public.leads;
create trigger leads_channel_workspace_integrity
before insert or update of workspace_id, bot_id, bot_channel_id on public.leads
for each row execute function public.enforce_lead_channel_workspace();

create or replace function public.record_chat_turn(
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
  p_summary text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_contact boolean := p_lead is not null and (coalesce(p_lead->>'email', '') <> '' or coalesce(p_lead->>'phone', '') <> '');
begin
  if p_workspace_id is null or p_bot_id is null or p_bot_channel_id is null or p_conversation_id is null then
    raise exception 'missing_required_ids' using errcode = '23502';
  end if;

  if coalesce(p_visitor_message, '') = '' or char_length(p_visitor_message) > 2000 then
    raise exception 'invalid_visitor_message' using errcode = '22001';
  end if;

  if coalesce(p_bot_reply, '') = '' or char_length(p_bot_reply) > 4000 then
    raise exception 'invalid_bot_reply' using errcode = '22001';
  end if;

  if p_score is not null and (p_score < 0 or p_score > 100) then
    raise exception 'invalid_lead_score' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.conversations c
    join public.bots b on b.id = c.bot_id and b.workspace_id = c.workspace_id
    join public.bot_channels bc on bc.id = c.bot_channel_id and bc.workspace_id = c.workspace_id and bc.bot_id = b.id
    where c.id = p_conversation_id
      and c.workspace_id = p_workspace_id
      and c.bot_id = p_bot_id
      and c.bot_channel_id = p_bot_channel_id
      and b.status = 'active'
      and bc.status = 'active'
  ) then
    raise exception 'invalid_conversation_channel' using errcode = '23514';
  end if;

  insert into public.messages (workspace_id, conversation_id, sender_type, content)
  values (p_workspace_id, p_conversation_id, 'visitor', p_visitor_message);

  insert into public.messages (workspace_id, conversation_id, sender_type, content, content_json)
  values (p_workspace_id, p_conversation_id, 'bot', p_bot_reply, coalesce(p_bot_message_json, '{}'::jsonb));

  update public.conversations
  set
    current_state = coalesce(p_current_state, '{}'::jsonb),
    flow_type = coalesce(p_flow_type, 'unknown'),
    status = coalesce(p_conversation_status, 'open'),
    last_message_at = now(),
    completed_at = p_completed_at
  where id = p_conversation_id
    and workspace_id = p_workspace_id
    and bot_id = p_bot_id
    and bot_channel_id = p_bot_channel_id;

  if not found then
    raise exception 'conversation_update_failed' using errcode = '23514';
  end if;

  if v_has_contact then
    insert into public.leads (
      workspace_id,
      conversation_id,
      bot_id,
      bot_channel_id,
      agent_profile_id,
      status,
      temperature,
      name,
      email,
      phone,
      intent,
      budget_min,
      budget_max,
      location,
      timeframe,
      property_type,
      property_address,
      pre_approved,
      wants_valuation,
      source_type,
      source_label,
      source,
      medium,
      campaign,
      content,
      term,
      source_url,
      referrer,
      score,
      consent,
      consent_at,
      summary,
      metadata
    )
    values (
      p_workspace_id,
      p_conversation_id,
      p_bot_id,
      p_bot_channel_id,
      p_agent_profile_id,
      coalesce(p_lead_status, 'new'),
      coalesce(p_lead_temperature, 'unknown'),
      nullif(p_lead->>'name', ''),
      nullif(p_lead->>'email', ''),
      nullif(p_lead->>'phone', ''),
      coalesce(nullif(p_lead->>'intent', '')::public.lead_intent, 'unknown'),
      nullif(p_lead->>'budgetMin', '')::integer,
      nullif(p_lead->>'budgetMax', '')::integer,
      nullif(p_lead->>'location', ''),
      nullif(p_lead->>'timeframe', ''),
      nullif(p_lead->>'propertyType', ''),
      nullif(p_lead->>'propertyAddress', ''),
      case when p_lead ? 'preApproved' then (p_lead->>'preApproved')::boolean else null end,
      case when p_lead ? 'wantsValuation' then (p_lead->>'wantsValuation')::boolean else null end,
      p_source_type,
      p_source_label,
      p_source,
      p_medium,
      p_campaign,
      p_content,
      p_term,
      p_source_url,
      p_referrer,
      coalesce(p_score, 0),
      true,
      now(),
      p_summary,
      jsonb_build_object(
        'phase', 2,
        'channel', jsonb_build_object('type', p_source_type, 'label', p_source_label),
        'attribution', jsonb_build_object(
          'source', p_source,
          'medium', p_medium,
          'campaign', p_campaign,
          'content', p_content,
          'term', p_term,
          'sourceUrl', p_source_url,
          'referrer', p_referrer
        )
      )
    )
    on conflict (workspace_id, conversation_id) do update
    set
      bot_channel_id = excluded.bot_channel_id,
      agent_profile_id = excluded.agent_profile_id,
      status = excluded.status,
      temperature = excluded.temperature,
      name = excluded.name,
      email = excluded.email,
      phone = excluded.phone,
      intent = excluded.intent,
      budget_min = excluded.budget_min,
      budget_max = excluded.budget_max,
      location = excluded.location,
      timeframe = excluded.timeframe,
      property_type = excluded.property_type,
      property_address = excluded.property_address,
      pre_approved = excluded.pre_approved,
      wants_valuation = excluded.wants_valuation,
      source_type = excluded.source_type,
      source_label = excluded.source_label,
      source = excluded.source,
      medium = excluded.medium,
      campaign = excluded.campaign,
      content = excluded.content,
      term = excluded.term,
      source_url = excluded.source_url,
      referrer = excluded.referrer,
      score = excluded.score,
      consent = excluded.consent,
      consent_at = coalesce(public.leads.consent_at, excluded.consent_at),
      summary = excluded.summary,
      metadata = excluded.metadata;
  end if;
end;
$$;

revoke execute on function public.record_chat_turn(
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
  text
) from public, anon, authenticated;

grant execute on function public.record_chat_turn(
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
  text
) to service_role;
