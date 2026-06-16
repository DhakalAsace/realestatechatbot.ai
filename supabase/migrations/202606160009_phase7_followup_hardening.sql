do $$
begin
  alter table public.lead_follow_up_state drop constraint if exists lead_follow_up_state_status_check;
  alter table public.lead_follow_up_state add constraint lead_follow_up_state_status_check
    check (status in ('scheduled', 'processing', 'pending_consent', 'paused', 'completed', 'skipped', 'failed', 'unsubscribed'));
end $$;

update public.lead_follow_up_state
set status = 'pending_consent'
where status = 'paused'
  and errors::text like '%missing_explicit_email_consent%';
