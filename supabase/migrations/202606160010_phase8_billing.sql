create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  stripe_customer_id text not null unique check (char_length(stripe_customer_id) between 3 and 120),
  email text check (email is null or char_length(email) <= 320),
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  billing_customer_id uuid,
  stripe_customer_id text not null check (char_length(stripe_customer_id) between 3 and 120),
  stripe_subscription_id text not null unique check (char_length(stripe_subscription_id) between 3 and 120),
  stripe_price_id text check (stripe_price_id is null or char_length(stripe_price_id) <= 120),
  stripe_product_id text check (stripe_product_id is null or char_length(stripe_product_id) <= 120),
  plan_key text not null default 'free' check (plan_key in ('free', 'starter', 'pro')),
  status text not null default 'incomplete' check (status in ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused', 'inactive')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  trial_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, stripe_subscription_id),
  constraint subscriptions_customer_workspace_fk foreign key (billing_customer_id, workspace_id)
    references public.billing_customers(id, workspace_id) on delete set null
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_type text not null check (event_type in ('chat_turn', 'ai_message', 'follow_up_email', 'bot_created', 'channel_created', 'team_member_added', 'property_created', 'knowledge_document_created')),
  quantity integer not null default 1 check (quantity > 0 and quantity <= 100000),
  source_type text check (source_type is null or char_length(source_type) <= 80),
  source_id uuid,
  idempotency_key text not null check (char_length(idempotency_key) between 16 and 240),
  occurred_at timestamptz not null default now(),
  period_start date not null default date_trunc('month', now())::date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create table if not exists public.usage_rollups (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_type text not null check (event_type in ('chat_turn', 'ai_message', 'follow_up_email', 'bot_created', 'channel_created', 'team_member_added', 'property_created', 'knowledge_document_created')),
  period_start date not null,
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, event_type, period_start)
);

create table if not exists public.stripe_webhook_events (
  stripe_event_id text primary key check (char_length(stripe_event_id) between 3 and 120),
  workspace_id uuid references public.workspaces(id) on delete set null,
  event_type text not null check (char_length(event_type) <= 160),
  api_version text check (api_version is null or char_length(api_version) <= 80),
  livemode boolean not null default false,
  status text not null default 'processing' check (status in ('processing', 'processed', 'ignored', 'failed')),
  processed_at timestamptz,
  error_message text check (error_message is null or char_length(error_message) <= 500),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_customers_workspace_idx on public.billing_customers(workspace_id);
create index if not exists subscriptions_workspace_status_idx on public.subscriptions(workspace_id, status, updated_at desc);
create index if not exists subscriptions_stripe_customer_idx on public.subscriptions(stripe_customer_id);
create index if not exists usage_events_workspace_period_idx on public.usage_events(workspace_id, event_type, period_start, occurred_at desc);
create index if not exists stripe_webhook_events_workspace_idx on public.stripe_webhook_events(workspace_id, created_at desc);

create or replace function public.prevent_usage_event_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'usage_events_are_immutable' using errcode = '42501';
end;
$$;

drop trigger if exists usage_events_prevent_mutation on public.usage_events;
create trigger usage_events_prevent_mutation
before update or delete on public.usage_events
for each row execute function public.prevent_usage_event_mutation();

drop trigger if exists billing_customers_set_updated_at on public.billing_customers;
create trigger billing_customers_set_updated_at before update on public.billing_customers
for each row execute function public.set_updated_at();

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at before update on public.subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists usage_rollups_set_updated_at on public.usage_rollups;
create trigger usage_rollups_set_updated_at before update on public.usage_rollups
for each row execute function public.set_updated_at();

drop trigger if exists stripe_webhook_events_set_updated_at on public.stripe_webhook_events;
create trigger stripe_webhook_events_set_updated_at before update on public.stripe_webhook_events
for each row execute function public.set_updated_at();

alter table public.billing_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_events enable row level security;
alter table public.usage_rollups enable row level security;
alter table public.stripe_webhook_events enable row level security;

drop policy if exists "members can read billing customers" on public.billing_customers;
create policy "members can read billing customers" on public.billing_customers
for select to authenticated using (private.is_workspace_member(workspace_id));

drop policy if exists "members can read subscriptions" on public.subscriptions;
create policy "members can read subscriptions" on public.subscriptions
for select to authenticated using (private.is_workspace_member(workspace_id));

drop policy if exists "members can read usage events" on public.usage_events;
create policy "members can read usage events" on public.usage_events
for select to authenticated using (private.is_workspace_member(workspace_id));

drop policy if exists "members can read usage rollups" on public.usage_rollups;
create policy "members can read usage rollups" on public.usage_rollups
for select to authenticated using (private.is_workspace_member(workspace_id));

-- No authenticated insert/update/delete policies are created for billing, subscription,
-- usage, or webhook tables. Server-side service-role paths own these writes.
