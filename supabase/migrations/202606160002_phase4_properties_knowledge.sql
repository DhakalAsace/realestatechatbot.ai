create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  bot_id uuid not null,
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  title text not null check (char_length(title) between 2 and 160),
  property_type text check (property_type is null or char_length(property_type) <= 80),
  price integer check (price is null or price >= 0),
  address text check (address is null or char_length(address) <= 240),
  city text check (city is null or char_length(city) <= 120),
  area text check (area is null or char_length(area) <= 120),
  bedrooms integer check (bedrooms is null or bedrooms >= 0),
  bathrooms numeric(4, 1) check (bathrooms is null or bathrooms >= 0),
  description text check (description is null or char_length(description) <= 2000),
  highlights text[] not null default '{}'::text[],
  image_url text check (image_url is null or (char_length(image_url) <= 500 and image_url ~ '^https?://')),
  listing_url text check (listing_url is null or (char_length(listing_url) <= 500 and listing_url ~ '^https?://')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  constraint properties_bot_workspace_fk foreign key (bot_id, workspace_id)
    references public.bots(id, workspace_id) on delete cascade
);

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  bot_id uuid not null,
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  kind text not null default 'faq' check (kind in ('faq', 'note')),
  title text not null check (char_length(title) between 2 and 160),
  question text check (question is null or char_length(question) <= 300),
  body text not null check (char_length(body) between 2 and 3000),
  tags text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  constraint knowledge_documents_bot_workspace_fk foreign key (bot_id, workspace_id)
    references public.bots(id, workspace_id) on delete cascade
);

create index if not exists properties_workspace_bot_status_idx on public.properties(workspace_id, bot_id, status, updated_at desc);
create index if not exists properties_workspace_price_idx on public.properties(workspace_id, bot_id, price) where status = 'active';
create index if not exists knowledge_documents_workspace_bot_status_idx on public.knowledge_documents(workspace_id, bot_id, status, updated_at desc);

drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at before update on public.properties
for each row execute function public.set_updated_at();
drop trigger if exists knowledge_documents_set_updated_at on public.knowledge_documents;
create trigger knowledge_documents_set_updated_at before update on public.knowledge_documents
for each row execute function public.set_updated_at();

alter table public.properties enable row level security;
alter table public.knowledge_documents enable row level security;

create policy "members can read properties" on public.properties
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy "owners and admins can insert properties" on public.properties
for insert to authenticated with check (private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));
create policy "owners and admins can update properties" on public.properties
for update to authenticated using (private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

create policy "members can read knowledge documents" on public.knowledge_documents
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy "owners and admins can insert knowledge documents" on public.knowledge_documents
for insert to authenticated with check (private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));
create policy "owners and admins can update knowledge documents" on public.knowledge_documents
for update to authenticated using (private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));
