-- ============================================================
-- JEET ERP — Meeting (Jitsi) lifecycle: status, activity, attendance
-- Additive. Idempotent. Extends comm_calls + adds attendance log.
-- ============================================================

-- comm_calls: richer lifecycle fields
alter table public.comm_calls add column if not exists participant_count integer not null default 0;
alter table public.comm_calls add column if not exists last_activity_at timestamptz default now();
alter table public.comm_calls add column if not exists duration_seconds integer;
alter table public.comm_calls add column if not exists peak_participants integer not null default 0;

-- widen the status vocabulary (ringing/ongoing/active -> live; ended/completed/cancelled -> closed)
do $$
declare cname text;
begin
  select conname into cname from pg_constraint
  where conrelid = 'public.comm_calls'::regclass and contype = 'c' and conname like '%status%';
  if cname is not null then execute format('alter table public.comm_calls drop constraint %I', cname); end if;
exception when undefined_table then null;
end $$;
alter table public.comm_calls
  add constraint comm_calls_status_check
  check (status in ('ringing','ongoing','active','ended','completed','cancelled'));

create index if not exists idx_comm_calls_status on public.comm_calls(status, started_at desc);

-- Per-user attendance log
create table if not exists public.comm_call_participants (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.comm_calls(id) on delete cascade,
  user_id uuid,
  display_name text,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  duration_seconds integer,
  unique (call_id, user_id)
);
create index if not exists idx_call_participants_call on public.comm_call_participants(call_id);

-- RLS (collaborative — internal team)
do $$
begin
  execute 'alter table public.comm_call_participants enable row level security';
  execute 'drop policy if exists comm_call_participants_all on public.comm_call_participants';
  execute 'create policy comm_call_participants_all on public.comm_call_participants for all using (true) with check (true)';
end $$;

-- realtime
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.comm_call_participants'; exception when duplicate_object then null; when undefined_object then null; end;
end $$;

notify pgrst, 'reload schema';
