-- ============================================================
-- JEET ERP — Projects: DLP & Warranty Tracking
-- Extends the existing handover/DLP flow (projects.dlp_start_date/
-- dlp_end_date, status='DLP') with:
--   * project_warranties — DLP / manufacturer / supplier warranties
--     per system/equipment, with expiry reminders.
--   * project_dlp_defects — defects raised during the DLP/warranty
--     period (separate from construction snags).
-- Collaborative RLS (matches the rest of the app).
-- ============================================================

create table if not exists public.project_warranties (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  item_name text not null,                              -- system / equipment covered
  warranty_type text not null default 'DLP',           -- DLP | MANUFACTURER | SUPPLIER | CONTRACTOR
  provider text,                                        -- who honours the warranty
  start_date date,
  end_date date,
  duration_months int,
  document_id text,                                     -- certificate in document store
  notes text,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_warranty_project on public.project_warranties(project_id);
create index if not exists idx_warranty_end on public.project_warranties(end_date);

create table if not exists public.project_dlp_defects (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  warranty_id uuid references public.project_warranties(id) on delete set null,
  ref_code text,                                        -- DEF-001
  title text not null,
  description text,
  severity text not null default 'MINOR',               -- MINOR | MAJOR | CRITICAL
  reported_date date default now(),
  status text not null default 'OPEN',                  -- OPEN | IN_PROGRESS | RESOLVED | CLOSED
  assigned_to_name text,
  resolved_date date,
  notes text,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dlp_defect_project on public.project_dlp_defects(project_id);
create index if not exists idx_dlp_defect_status on public.project_dlp_defects(status);

alter table public.project_warranties enable row level security;
alter table public.project_dlp_defects enable row level security;

drop policy if exists "project_warranties_all" on public.project_warranties;
create policy "project_warranties_all" on public.project_warranties for all using (true) with check (true);

drop policy if exists "project_dlp_defects_all" on public.project_dlp_defects;
create policy "project_dlp_defects_all" on public.project_dlp_defects for all using (true) with check (true);

NOTIFY pgrst, 'reload schema';
