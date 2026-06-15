-- ============================================================
-- JEET ERP — Projects: RFI / SI / NCR register
-- Requests for Information, Site Instructions and Non-Conformance
-- Reports share one table with a doc_type discriminator and a
-- per-type, per-project running reference (RFI-001 / SI-001 / NCR-001).
-- Collaborative RLS (matches the rest of the app).
-- ============================================================

create table if not exists public.project_site_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  doc_type text not null default 'RFI',                -- RFI | SI | NCR
  ref_code text,                                       -- RFI-001 / SI-001 / NCR-001
  title text not null,
  description text,
  discipline text,                                     -- CCTV / MEP / Civil / ...
  raised_by_name text,
  directed_to text,                                    -- consultant / contractor / client party
  date_raised date default now(),
  date_required date,                                  -- response due date
  priority text not null default 'MEDIUM',             -- LOW | MEDIUM | HIGH
  status text not null default 'OPEN',                 -- OPEN | IN_PROGRESS | ANSWERED | CLOSED | VOID
  response text,
  response_date date,
  cost_impact numeric default 0,                       -- AED (SI / NCR)
  time_impact_days int default 0,
  document_ids text[] default '{}',
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_site_rec_project on public.project_site_records(project_id);
create index if not exists idx_site_rec_type on public.project_site_records(doc_type);
create index if not exists idx_site_rec_status on public.project_site_records(status);

alter table public.project_site_records enable row level security;

drop policy if exists "project_site_records_all" on public.project_site_records;
create policy "project_site_records_all" on public.project_site_records for all using (true) with check (true);

NOTIFY pgrst, 'reload schema';
