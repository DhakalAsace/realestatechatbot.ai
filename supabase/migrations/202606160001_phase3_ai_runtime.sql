alter table public.bots
  add column if not exists ai_enabled boolean not null default false,
  add column if not exists ai_config jsonb not null default '{"model":"gpt-5.5","reasoningEffort":"low","verbosity":"low"}'::jsonb;

alter table public.bots
  alter column ai_enabled set default false,
  alter column ai_config set default '{"model":"gpt-5.5","reasoningEffort":"low","verbosity":"low"}'::jsonb;

update public.bots
set ai_config = '{"model":"gpt-5.5","reasoningEffort":"low","verbosity":"low"}'::jsonb
where ai_config is null;

update public.bots
set ai_enabled = false
where ai_enabled is null;

alter table public.bots
  alter column ai_enabled set not null,
  alter column ai_config set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bots_ai_config_object'
      and conrelid = 'public.bots'::regclass
  ) then
    alter table public.bots
      add constraint bots_ai_config_object check (jsonb_typeof(ai_config) = 'object');
  end if;
end;
$$;
