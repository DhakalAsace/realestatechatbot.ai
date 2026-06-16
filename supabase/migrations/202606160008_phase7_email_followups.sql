create table if not exists public.follow_up_sequences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  bot_id uuid not null,
  name text not null check (char_length(name) between 2 and 160),
  default_key text not null check (default_key in ('buyer_no_booking', 'seller_valuation', 'showing_request')),
  trigger_type text not null check (trigger_type in ('buyer_no_booking', 'seller_valuation', 'showing_request')),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  description text check (description is null or char_length(description) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, bot_id, default_key),
  constraint follow_up_sequences_bot_workspace_fk foreign key (bot_id, workspace_id)
    references public.bots(id, workspace_id) on delete cascade
);

create table if not exists public.follow_up_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sequence_id uuid not null,
  step_index integer not null check (step_index > 0),
  delay_minutes integer not null default 60 check (delay_minutes >= 0 and delay_minutes <= 43200),
  status text not null default 'active' check (status in ('draft', 'active', 'paused', 'archived')),
  subject_template text not null check (char_length(subject_template) between 2 and 200),
  body_template text not null check (char_length(body_template) between 10 and 4000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, sequence_id, step_index),
  constraint follow_up_messages_sequence_workspace_fk foreign key (sequence_id, workspace_id)
    references public.follow_up_sequences(id, workspace_id) on delete cascade
);

create table if not exists public.lead_email_preferences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid,
  email text not null check (char_length(email) between 3 and 320 and email = lower(email)),
  status text not null default 'pending' check (status in ('pending', 'opted_in', 'unsubscribed')),
  consent_source text check (consent_source is null or char_length(consent_source) <= 120),
  consent_text_version text check (consent_text_version is null or char_length(consent_text_version) <= 80),
  consented_at timestamptz,
  unsubscribe_token_hash text check (unsubscribe_token_hash is null or char_length(unsubscribe_token_hash) = 64),
  unsubscribed_at timestamptz,
  unsubscribe_reason text check (unsubscribe_reason is null or char_length(unsubscribe_reason) <= 200),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, email),
  constraint lead_email_preferences_lead_workspace_fk foreign key (lead_id, workspace_id)
    references public.leads(id, workspace_id) on delete set null,
  constraint lead_email_preferences_opt_in_requires_consent check (
    status <> 'opted_in' or (consented_at is not null and consent_source is not null and consent_text_version is not null)
  )
);

create unique index if not exists lead_email_preferences_token_hash_unique_idx
on public.lead_email_preferences(unsubscribe_token_hash)
where unsubscribe_token_hash is not null;

create table if not exists public.lead_follow_up_state (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null,
  sequence_id uuid not null,
  current_message_id uuid,
  status text not null default 'scheduled' check (status in ('scheduled', 'processing', 'paused', 'completed', 'skipped', 'failed', 'unsubscribed')),
  next_send_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  last_notification_event_id uuid,
  errors jsonb not null default '[]'::jsonb,
  idempotency_key text not null check (char_length(idempotency_key) between 16 and 240),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, lead_id, sequence_id),
  unique (workspace_id, idempotency_key),
  constraint lead_follow_up_state_lead_workspace_fk foreign key (lead_id, workspace_id)
    references public.leads(id, workspace_id) on delete cascade,
  constraint lead_follow_up_state_sequence_workspace_fk foreign key (sequence_id, workspace_id)
    references public.follow_up_sequences(id, workspace_id) on delete cascade,
  constraint lead_follow_up_state_message_workspace_fk foreign key (current_message_id, workspace_id)
    references public.follow_up_messages(id, workspace_id) on delete set null
);

do $$
begin
  alter table public.notification_events add column if not exists follow_up_state_id uuid;
  alter table public.notification_events add column if not exists follow_up_message_id uuid;
exception when undefined_table then null;
end $$;

do $$
begin
  alter table public.notification_events add constraint notification_events_id_workspace_unique unique (id, workspace_id);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.notification_events drop constraint if exists notification_events_event_type_check;
  alter table public.notification_events add constraint notification_events_event_type_check
    check (event_type in ('appointment_requested', 'follow_up_email'));
end $$;

do $$
begin
  alter table public.notification_events drop constraint if exists notification_events_recipient_type_check;
  alter table public.notification_events add constraint notification_events_recipient_type_check
    check (recipient_type in ('agent', 'lead'));
end $$;

do $$
begin
  alter table public.notification_events add constraint notification_events_follow_up_state_workspace_fk
    foreign key (follow_up_state_id, workspace_id)
    references public.lead_follow_up_state(id, workspace_id) on delete cascade;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.notification_events add constraint notification_events_follow_up_message_workspace_fk
    foreign key (follow_up_message_id, workspace_id)
    references public.follow_up_messages(id, workspace_id) on delete set null;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.lead_follow_up_state add constraint lead_follow_up_state_last_event_workspace_fk
    foreign key (last_notification_event_id, workspace_id)
    references public.notification_events(id, workspace_id) on delete set null;
exception when duplicate_object then null;
end $$;

create index if not exists follow_up_sequences_workspace_bot_idx on public.follow_up_sequences(workspace_id, bot_id, status);
create index if not exists follow_up_messages_sequence_idx on public.follow_up_messages(sequence_id, step_index);
create index if not exists lead_email_preferences_workspace_status_idx on public.lead_email_preferences(workspace_id, status, updated_at desc);
create index if not exists lead_follow_up_state_due_idx on public.lead_follow_up_state(status, next_send_at, created_at);
create index if not exists lead_follow_up_state_workspace_lead_idx on public.lead_follow_up_state(workspace_id, lead_id, created_at desc);
create index if not exists notification_events_follow_up_state_idx on public.notification_events(follow_up_state_id, created_at desc);

drop trigger if exists follow_up_sequences_set_updated_at on public.follow_up_sequences;
create trigger follow_up_sequences_set_updated_at before update on public.follow_up_sequences
for each row execute function public.set_updated_at();

drop trigger if exists follow_up_messages_set_updated_at on public.follow_up_messages;
create trigger follow_up_messages_set_updated_at before update on public.follow_up_messages
for each row execute function public.set_updated_at();

drop trigger if exists lead_email_preferences_set_updated_at on public.lead_email_preferences;
create trigger lead_email_preferences_set_updated_at before update on public.lead_email_preferences
for each row execute function public.set_updated_at();

drop trigger if exists lead_follow_up_state_set_updated_at on public.lead_follow_up_state;
create trigger lead_follow_up_state_set_updated_at before update on public.lead_follow_up_state
for each row execute function public.set_updated_at();

alter table public.follow_up_sequences enable row level security;
alter table public.follow_up_messages enable row level security;
alter table public.lead_email_preferences enable row level security;
alter table public.lead_follow_up_state enable row level security;

drop policy if exists "members can read follow up sequences" on public.follow_up_sequences;
create policy "members can read follow up sequences" on public.follow_up_sequences
for select to authenticated using (private.is_workspace_member(workspace_id));

drop policy if exists "owners and admins manage follow up sequences" on public.follow_up_sequences;
create policy "owners and admins manage follow up sequences" on public.follow_up_sequences
for all to authenticated using (private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

drop policy if exists "members can read follow up messages" on public.follow_up_messages;
create policy "members can read follow up messages" on public.follow_up_messages
for select to authenticated using (private.is_workspace_member(workspace_id));

drop policy if exists "owners and admins manage follow up messages" on public.follow_up_messages;
create policy "owners and admins manage follow up messages" on public.follow_up_messages
for all to authenticated using (private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

drop policy if exists "members can read lead email preferences" on public.lead_email_preferences;
create policy "members can read lead email preferences" on public.lead_email_preferences
for select to authenticated using (private.is_workspace_member(workspace_id));

drop policy if exists "owners and admins manage lead email preferences" on public.lead_email_preferences;
create policy "owners and admins manage lead email preferences" on public.lead_email_preferences
for all to authenticated using (private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

drop policy if exists "members can read lead follow up state" on public.lead_follow_up_state;
create policy "members can read lead follow up state" on public.lead_follow_up_state
for select to authenticated using (private.is_workspace_member(workspace_id));

drop policy if exists "owners and admins update lead follow up state" on public.lead_follow_up_state;
create policy "owners and admins update lead follow up state" on public.lead_follow_up_state
for update to authenticated using (private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

create or replace function public.ensure_default_follow_up_sequences(target_workspace_id uuid, target_bot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sequence_id uuid;
begin
  if not exists (
    select 1
    from public.bots b
    where b.id = target_bot_id
      and b.workspace_id = target_workspace_id
  ) then
    raise exception 'follow_up_bot_workspace_mismatch' using errcode = '23514';
  end if;

  insert into public.follow_up_sequences (workspace_id, bot_id, name, default_key, trigger_type, status, description, metadata)
  values (
    target_workspace_id,
    target_bot_id,
    'Buyer follow-up when no appointment is booked',
    'buyer_no_booking',
    'buyer_no_booking',
    'active',
    'Sends a short next-step email to qualified buyer leads who did not request a consultation or showing.',
    '{"systemDefault":true}'::jsonb
  )
  on conflict (workspace_id, bot_id, default_key) do update
  set name = excluded.name,
      trigger_type = excluded.trigger_type,
      description = excluded.description
  returning id into v_sequence_id;

  insert into public.follow_up_messages (workspace_id, sequence_id, step_index, delay_minutes, status, subject_template, body_template, metadata)
  values (
    target_workspace_id,
    v_sequence_id,
    1,
    60,
    'active',
    'Next steps for your {{area}} home search',
    'Hi {{lead_name}},\n\nThanks for sharing your home search details. {{agent_name}} can help you review options in {{area}} and plan around your {{timeline}} timeline.\n\nReply to this email when you are ready to book a quick consultation.\n\nUnsubscribe: {{unsubscribe_url}}',
    '{"systemDefault":true}'::jsonb
  )
  on conflict (workspace_id, sequence_id, step_index) do update
  set subject_template = excluded.subject_template,
      body_template = excluded.body_template;

  insert into public.follow_up_sequences (workspace_id, bot_id, name, default_key, trigger_type, status, description, metadata)
  values (
    target_workspace_id,
    target_bot_id,
    'Seller valuation follow-up',
    'seller_valuation',
    'seller_valuation',
    'active',
    'Follows up with seller leads who asked about a valuation.',
    '{"systemDefault":true}'::jsonb
  )
  on conflict (workspace_id, bot_id, default_key) do update
  set name = excluded.name,
      trigger_type = excluded.trigger_type,
      description = excluded.description
  returning id into v_sequence_id;

  insert into public.follow_up_messages (workspace_id, sequence_id, step_index, delay_minutes, status, subject_template, body_template, metadata)
  values (
    target_workspace_id,
    v_sequence_id,
    1,
    60,
    'active',
    'A valuation next step for {{area}}',
    'Hi {{lead_name}},\n\nThanks for asking about your home value. {{agent_name}} can prepare a focused pricing conversation for {{area}} and your {{timeline}} timeline.\n\nReply to this email if you want to schedule the valuation step.\n\nUnsubscribe: {{unsubscribe_url}}',
    '{"systemDefault":true}'::jsonb
  )
  on conflict (workspace_id, sequence_id, step_index) do update
  set subject_template = excluded.subject_template,
      body_template = excluded.body_template;

  insert into public.follow_up_sequences (workspace_id, bot_id, name, default_key, trigger_type, status, description, metadata)
  values (
    target_workspace_id,
    target_bot_id,
    'Showing request follow-up',
    'showing_request',
    'showing_request',
    'active',
    'Follows up after a captured showing request.',
    '{"systemDefault":true}'::jsonb
  )
  on conflict (workspace_id, bot_id, default_key) do update
  set name = excluded.name,
      trigger_type = excluded.trigger_type,
      description = excluded.description
  returning id into v_sequence_id;

  insert into public.follow_up_messages (workspace_id, sequence_id, step_index, delay_minutes, status, subject_template, body_template, metadata)
  values (
    target_workspace_id,
    v_sequence_id,
    1,
    30,
    'active',
    'About your showing request',
    'Hi {{lead_name}},\n\nThanks for requesting a showing. {{agent_name}} can help confirm timing and next steps for {{area}}.\n\nReply to this email with any timing notes.\n\nUnsubscribe: {{unsubscribe_url}}',
    '{"systemDefault":true}'::jsonb
  )
  on conflict (workspace_id, sequence_id, step_index) do update
  set subject_template = excluded.subject_template,
      body_template = excluded.body_template;
end;
$$;

revoke all on function public.ensure_default_follow_up_sequences(uuid, uuid) from public;
revoke all on function public.ensure_default_follow_up_sequences(uuid, uuid) from anon;
revoke all on function public.ensure_default_follow_up_sequences(uuid, uuid) from authenticated;
grant execute on function public.ensure_default_follow_up_sequences(uuid, uuid) to service_role;

create or replace function public.seed_bot_followups_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_default_follow_up_sequences(new.workspace_id, new.id);
  return new;
end;
$$;

drop trigger if exists bots_seed_followups on public.bots;
create trigger bots_seed_followups
after insert on public.bots
for each row execute function public.seed_bot_followups_trigger();

select public.ensure_default_follow_up_sequences(workspace_id, id)
from public.bots;

create or replace function public.unsubscribe_email_follow_up(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_preference public.lead_email_preferences%rowtype;
begin
  if p_token_hash is null or char_length(p_token_hash) <> 64 then
    return jsonb_build_object('ok', true);
  end if;

  select * into v_preference
  from public.lead_email_preferences
  where unsubscribe_token_hash = p_token_hash
  limit 1;

  if not found then
    return jsonb_build_object('ok', true);
  end if;

  update public.lead_email_preferences
  set status = 'unsubscribed',
      unsubscribed_at = coalesce(unsubscribed_at, now()),
      unsubscribe_reason = coalesce(unsubscribe_reason, 'recipient_request')
  where id = v_preference.id;

  update public.lead_follow_up_state s
  set status = 'unsubscribed',
      errors = s.errors || jsonb_build_array(jsonb_build_object('code', 'recipient_unsubscribed', 'at', now()))
  from public.leads l
  where s.workspace_id = v_preference.workspace_id
    and s.lead_id = l.id
    and l.workspace_id = v_preference.workspace_id
    and lower(coalesce(l.email, '')) = v_preference.email
    and s.status in ('scheduled', 'processing', 'failed', 'paused');

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.unsubscribe_email_follow_up(text) to anon;
grant execute on function public.unsubscribe_email_follow_up(text) to authenticated;
grant execute on function public.unsubscribe_email_follow_up(text) to service_role;
