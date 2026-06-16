create extension if not exists pgcrypto;

create type public.workspace_role as enum ('owner', 'admin', 'member');
create type public.bot_status as enum ('draft', 'active', 'paused', 'archived');
create type public.channel_type as enum ('hosted_link', 'web_embed');
create type public.channel_status as enum ('active', 'disabled');
create type public.conversation_status as enum ('open', 'needs_followup', 'closed', 'spam');
create type public.message_sender as enum ('visitor', 'bot', 'agent', 'system');
create type public.lead_status as enum ('new', 'qualified', 'contacted', 'converted', 'lost', 'spam');
create type public.lead_intent as enum ('buyer', 'seller', 'unknown');
create type public.lead_temperature as enum ('hot', 'warm', 'cold', 'unknown');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'member',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.agent_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  brokerage_name text not null,
  email text,
  phone text,
  license_number text,
  bio text,
  avatar_url text,
  city text,
  service_areas text[] not null default '{}'::text[],
  timezone text not null default 'America/Winnipeg',
  brand_color text not null default '#163f2f',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table public.bots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_profile_id uuid,
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status public.bot_status not null default 'draft',
  greeting text not null default 'Hi, I can help you buy or sell a home. Are you looking to buy or sell?',
  fallback_message text not null default 'I can help with buying, selling, valuations, and showing requests. Are you looking to buy or sell?',
  tone text not null default 'professional',
  lead_capture_config jsonb not null default '{"buyer":true,"seller":true}'::jsonb,
  theme jsonb not null default '{"brandColor":"#163f2f"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  constraint bots_agent_profile_workspace_fk foreign key (agent_profile_id, workspace_id)
    references public.agent_profiles(id, workspace_id) on delete set null
);

create table public.bot_channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  bot_id uuid not null,
  type public.channel_type not null default 'hosted_link',
  status public.channel_status not null default 'active',
  public_key text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  allowed_origins text[] not null default '{}'::text[],
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  constraint bot_channels_bot_workspace_fk foreign key (bot_id, workspace_id)
    references public.bots(id, workspace_id) on delete cascade
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  bot_id uuid not null,
  bot_channel_id uuid not null,
  status public.conversation_status not null default 'open',
  visitor_id text not null,
  client_token_hash text not null,
  source_url text,
  referrer text,
  visitor_ip_hash text,
  user_agent text,
  flow_type public.lead_intent not null default 'unknown',
  current_state jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (id, workspace_id),
  constraint conversations_bot_workspace_fk foreign key (bot_id, workspace_id)
    references public.bots(id, workspace_id) on delete cascade,
  constraint conversations_channel_workspace_fk foreign key (bot_channel_id, workspace_id)
    references public.bot_channels(id, workspace_id) on delete cascade
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null,
  sender_type public.message_sender not null,
  sender_user_id uuid references auth.users(id) on delete set null,
  content text not null check (char_length(content) <= 4000),
  content_json jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint messages_conversation_workspace_fk foreign key (conversation_id, workspace_id)
    references public.conversations(id, workspace_id) on delete cascade
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null,
  bot_id uuid not null,
  agent_profile_id uuid,
  status public.lead_status not null default 'new',
  temperature public.lead_temperature not null default 'unknown',
  name text,
  email text,
  phone text,
  intent public.lead_intent not null default 'unknown',
  budget_min integer,
  budget_max integer,
  location text,
  timeframe text,
  property_type text,
  bedrooms integer,
  bathrooms numeric(4, 1),
  pre_approved boolean,
  property_address text,
  wants_valuation boolean,
  score integer not null default 0 check (score >= 0 and score <= 100),
  consent boolean not null default false,
  consent_at timestamptz,
  notes text,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, conversation_id),
  constraint leads_conversation_workspace_fk foreign key (conversation_id, workspace_id)
    references public.conversations(id, workspace_id) on delete cascade,
  constraint leads_bot_workspace_fk foreign key (bot_id, workspace_id)
    references public.bots(id, workspace_id) on delete cascade,
  constraint leads_agent_profile_workspace_fk foreign key (agent_profile_id, workspace_id)
    references public.agent_profiles(id, workspace_id) on delete set null
);

create index workspace_members_user_id_idx on public.workspace_members(user_id, workspace_id);
create index agent_profiles_workspace_id_idx on public.agent_profiles(workspace_id);
create index bots_workspace_id_idx on public.bots(workspace_id);
create index bots_status_slug_idx on public.bots(status, slug);
create index bot_channels_workspace_id_idx on public.bot_channels(workspace_id);
create index bot_channels_bot_id_idx on public.bot_channels(bot_id);
create index conversations_workspace_last_message_idx on public.conversations(workspace_id, last_message_at desc);
create index conversations_bot_visitor_idx on public.conversations(bot_id, visitor_id);
create index messages_conversation_created_idx on public.messages(conversation_id, created_at);
create index leads_workspace_created_idx on public.leads(workspace_id, created_at desc);
create index leads_bot_status_idx on public.leads(bot_id, status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workspaces_set_updated_at before update on public.workspaces
for each row execute function public.set_updated_at();
create trigger workspace_members_set_updated_at before update on public.workspace_members
for each row execute function public.set_updated_at();
create trigger agent_profiles_set_updated_at before update on public.agent_profiles
for each row execute function public.set_updated_at();
create trigger bots_set_updated_at before update on public.bots
for each row execute function public.set_updated_at();
create trigger bot_channels_set_updated_at before update on public.bot_channels
for each row execute function public.set_updated_at();
create trigger conversations_set_updated_at before update on public.conversations
for each row execute function public.set_updated_at();
create trigger leads_set_updated_at before update on public.leads
for each row execute function public.set_updated_at();

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
  );
$$;

create or replace function private.has_workspace_role(target_workspace_id uuid, allowed_roles public.workspace_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = any(allowed_roles)
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.has_workspace_role(uuid, public.workspace_role[]) to authenticated;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.agent_profiles enable row level security;
alter table public.bots enable row level security;
alter table public.bot_channels enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.leads enable row level security;

create policy "members can read workspaces" on public.workspaces
for select to authenticated using (private.is_workspace_member(id));
create policy "users can create owned workspaces" on public.workspaces
for insert to authenticated with check (created_by = (select auth.uid()));
create policy "owners and admins can update workspaces" on public.workspaces
for update to authenticated using (private.has_workspace_role(id, array['owner','admin']::public.workspace_role[]))
with check (private.has_workspace_role(id, array['owner','admin']::public.workspace_role[]));

create policy "members can read workspace members" on public.workspace_members
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy "workspace creators can add first owner membership" on public.workspace_members
for insert to authenticated with check (
  private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[])
  or (
    user_id = (select auth.uid())
    and role = 'owner'
    and exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.created_by = (select auth.uid())
    )
  )
);
create policy "owners and admins can update members" on public.workspace_members
for update to authenticated using (private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

create policy "members can read agent profiles" on public.agent_profiles
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy "owners and admins can insert agent profiles" on public.agent_profiles
for insert to authenticated with check (private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));
create policy "owners and admins can update agent profiles" on public.agent_profiles
for update to authenticated using (private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

create policy "members can read bots" on public.bots
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy "owners and admins can insert bots" on public.bots
for insert to authenticated with check (private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));
create policy "owners and admins can update bots" on public.bots
for update to authenticated using (private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

create policy "members can read bot channels" on public.bot_channels
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy "owners and admins can insert bot channels" on public.bot_channels
for insert to authenticated with check (private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));
create policy "owners and admins can update bot channels" on public.bot_channels
for update to authenticated using (private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

create policy "members can read conversations" on public.conversations
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy "members can update conversations" on public.conversations
for update to authenticated using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));

create policy "members can read messages" on public.messages
for select to authenticated using (private.is_workspace_member(workspace_id));

create policy "members can read leads" on public.leads
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy "members can update leads" on public.leads
for update to authenticated using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));
