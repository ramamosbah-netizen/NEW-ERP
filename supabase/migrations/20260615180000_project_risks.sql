-- ============================================================
-- JEET ERP — Projects: Risk Register
-- Per-project risks scored on a 5x5 likelihood x impact matrix,
-- with mitigation, owner, category and status. Collaborative RLS.
-- ============================================================

create table if not exists public.project_risks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  ref_code text,                                       -- e.g. RISK-001
  title text not null,
  description text,
  category text not null default 'TECHNICAL',          -- TECHNICAL | COMMERCIAL | SCHEDULE | SAFETY | EXTERNAL | RESOURCE
  likelihood int not null default 3,                   -- 1..5
  impact int not null default 3,                       -- 1..5
  mitigation text,
  owner_name text,
  status text not null default 'OPEN',                 -- OPEN | MITIGATING | CLOSED
  due_date date,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_risks_project on public.project_risks(project_id);
create index if not exists idx_risks_status on public.project_risks(status);

alter table public.project_risks enable row level security;

drop policy if exists "project_risks_all" on public.project_risks;
create policy "project_risks_all" on public.project_risks
  for all using (true) with check (true);

NOTIFY pgrst, 'reload schema';
