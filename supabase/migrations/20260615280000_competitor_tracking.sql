-- ============================================================
-- JEET ERP — Pre-Sales: Competitor Tracking
-- A competitor register plus a per-tender competitive log that
-- captures who won the job, their estimated price, and why we lost.
-- Collaborative RLS (matches the rest of the app).
-- ============================================================

create table if not exists public.competitors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'CONTRACTOR',   -- CONTRACTOR | ELV_SPECIALIST | SUPPLIER | CONSULTANT | OTHER
  location text,
  strengths text,
  weaknesses text,
  notes text,
  is_active boolean not null default true,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_competitors_name on public.competitors(name);

create table if not exists public.tender_competitors (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders(id) on delete cascade,
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  estimated_price numeric not null default 0,   -- the competitor's (estimated) bid
  is_winner boolean not null default false,      -- did this competitor win the job?
  reason_for_loss text,                          -- why we lost to them
  notes text,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tcomp_tender on public.tender_competitors(tender_id);
create index if not exists idx_tcomp_competitor on public.tender_competitors(competitor_id);
create index if not exists idx_tcomp_winner on public.tender_competitors(is_winner);

alter table public.competitors enable row level security;
alter table public.tender_competitors enable row level security;

drop policy if exists "competitors_all" on public.competitors;
create policy "competitors_all" on public.competitors for all using (true) with check (true);

drop policy if exists "tender_competitors_all" on public.tender_competitors;
create policy "tender_competitors_all" on public.tender_competitors for all using (true) with check (true);

NOTIFY pgrst, 'reload schema';
