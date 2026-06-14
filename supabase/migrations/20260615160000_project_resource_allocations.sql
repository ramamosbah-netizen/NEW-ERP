-- ============================================================
-- JEET ERP — Projects: Resource / Manpower Planning
-- Allocate manpower, equipment and subcontractors to projects over
-- a date window, with daily rate → planned cost, and a cross-project
-- utilization view. Collaborative RLS (matches the rest of the app).
-- ============================================================

create table if not exists public.project_resource_allocations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  resource_type text not null default 'MANPOWER',     -- MANPOWER | EQUIPMENT | SUBCONTRACTOR
  resource_name text not null,                         -- "Electrician", "Crane 50T", "ABC Subcontract"
  trade text,                                          -- optional trade/discipline tag
  quantity numeric not null default 1,
  unit text not null default 'persons',                -- persons | units | crews
  start_date date,
  end_date date,
  daily_rate numeric not null default 0,               -- AED per unit per day
  status text not null default 'PLANNED',              -- PLANNED | ACTIVE | RELEASED
  notes text,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pra_project on public.project_resource_allocations(project_id);
create index if not exists idx_pra_type on public.project_resource_allocations(resource_type);
create index if not exists idx_pra_dates on public.project_resource_allocations(start_date, end_date);

alter table public.project_resource_allocations enable row level security;

drop policy if exists "pra_all" on public.project_resource_allocations;
drop policy if exists "project_resource_allocations_all" on public.project_resource_allocations;
create policy "project_resource_allocations_all" on public.project_resource_allocations
  for all using (true) with check (true);

NOTIFY pgrst, 'reload schema';
