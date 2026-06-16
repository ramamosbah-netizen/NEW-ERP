-- ============================================================
-- JEET ERP — Stale meeting reaper
-- Closes meetings still marked live whose last activity is older
-- than p_minutes (e.g. everyone hard-closed their browser).
-- Called opportunistically from the app, and schedulable via pg_cron.
-- Additive. Idempotent.
-- ============================================================

create or replace function public.reap_stale_meetings(p_minutes integer default 15)
returns integer
language plpgsql
security definer
as $$
declare
  reaped uuid[];
begin
  with upd as (
    update public.comm_calls
    set status = 'completed',
        ended_at = now(),
        duration_seconds = greatest(0, extract(epoch from (now() - started_at))::int),
        participant_count = 0
    where status in ('ringing', 'ongoing', 'active')
      and coalesce(last_activity_at, started_at) < now() - make_interval(mins => p_minutes)
    returning id
  )
  select array_agg(id) into reaped from upd;

  if reaped is not null then
    update public.comm_call_participants
    set left_at = now(),
        duration_seconds = coalesce(duration_seconds, greatest(0, extract(epoch from (now() - joined_at))::int))
    where left_at is null and call_id = any (reaped);
  end if;

  return coalesce(array_length(reaped, 1), 0);
end;
$$;

-- Optional: run every 5 minutes server-side (requires the pg_cron extension).
-- Enable pg_cron in the Supabase dashboard (Database → Extensions), then:
--   select cron.schedule('reap-stale-meetings', '*/5 * * * *', $$ select public.reap_stale_meetings(15); $$);

notify pgrst, 'reload schema';
