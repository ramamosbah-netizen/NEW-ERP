-- ============================================================
-- JEET ERP — HR: Attendance & GPS
-- Daily check-in / check-out with geolocation. One row per
-- employee per day. Collaborative RLS.
-- ============================================================

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null default current_date,
  check_in_at timestamptz,
  check_out_at timestamptz,
  check_in_lat numeric,
  check_in_lng numeric,
  check_out_lat numeric,
  check_out_lng numeric,
  location_label text,
  project_id uuid references public.projects(id) on delete set null,
  status text not null default 'PRESENT',     -- PRESENT | LATE | ABSENT | LEAVE | HALF_DAY
  hours numeric default 0,
  notes text,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, work_date)
);

create index if not exists idx_att_emp on public.attendance_records(employee_id);
create index if not exists idx_att_date on public.attendance_records(work_date);

alter table public.attendance_records enable row level security;
drop policy if exists "attendance_records_all" on public.attendance_records;
create policy "attendance_records_all" on public.attendance_records for all using (true) with check (true);

NOTIFY pgrst, 'reload schema';
