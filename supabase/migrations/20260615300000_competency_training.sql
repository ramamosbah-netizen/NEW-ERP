-- ============================================================
-- JEET ERP — HR: Training & Competency
-- A skill catalogue, an employee×skill competency matrix, and
-- training records. Collaborative RLS (matches the rest of the app).
-- ============================================================

create table if not exists public.competency_skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,                                  -- CCTV | ACCESS | MEP | SAFETY | IT | SOFT | ...
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.employee_competencies (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  skill_id uuid not null references public.competency_skills(id) on delete cascade,
  level int not null default 0,                  -- 0 none .. 4 expert
  notes text,
  assessed_date date default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, skill_id)
);

create table if not exists public.training_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  course_name text not null,
  provider text,
  completed_date date,
  expiry_date date,
  status text not null default 'COMPLETED',       -- PLANNED | IN_PROGRESS | COMPLETED | EXPIRED
  notes text,
  created_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists idx_comp_emp on public.employee_competencies(employee_id);
create index if not exists idx_comp_skill on public.employee_competencies(skill_id);
create index if not exists idx_training_emp on public.training_records(employee_id);

alter table public.competency_skills enable row level security;
alter table public.employee_competencies enable row level security;
alter table public.training_records enable row level security;

drop policy if exists "competency_skills_all" on public.competency_skills;
create policy "competency_skills_all" on public.competency_skills for all using (true) with check (true);
drop policy if exists "employee_competencies_all" on public.employee_competencies;
create policy "employee_competencies_all" on public.employee_competencies for all using (true) with check (true);
drop policy if exists "training_records_all" on public.training_records;
create policy "training_records_all" on public.training_records for all using (true) with check (true);

NOTIFY pgrst, 'reload schema';
