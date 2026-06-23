-- ============================================================================
-- APPLY: Multi-Company Foundation (3 migrations, IN ORDER, ONE PASTE)
-- ----------------------------------------------------------------------------
-- WHY: this database is missing the multi-company base — `company_id` does not
-- exist on quotations / projects / tenders / purchase_orders / clients / etc.,
-- and the `companies` / `company_members` tables are absent. That is why saving
-- a quotation fails with:
--     PGRST204  "Could not find the 'company_id' column of 'quotations'..."
--
-- These 3 migrations already live in supabase/migrations/ but were never applied
-- to this DB. They are FULLY ADDITIVE and IDEMPOTENT (CREATE/ADD ... IF NOT
-- EXISTS, ON CONFLICT DO NOTHING, guarded backfills) — safe to run, safe to
-- re-run. No DROP TABLE / DROP COLUMN anywhere. Existing RLS is untouched.
--
-- ORDER IS MANDATORY: §1 creates `companies` (+ seeds JEET-CON); §2/§3 add the
-- company_id columns that FK-reference it and backfill from it.
--
-- HOW: Supabase Dashboard → SQL Editor → paste ALL of this → Run.
-- AFTER: reload the app; the quotation/PO save works, the company switcher
-- populates, and the intelligence board's company scoping + the secure event
-- emit path (server-side company resolution) work end-to-end.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- §1 — 20260618150000_multi_company_foundation.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ---------- groups (holding level) ----------
CREATE TABLE IF NOT EXISTS public.groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  code        TEXT UNIQUE,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ---------- companies (operating companies in a group) ----------
CREATE TABLE IF NOT EXISTS public.companies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID REFERENCES public.groups(id) ON DELETE RESTRICT,
  name        TEXT NOT NULL,
  code        TEXT UNIQUE,
  legal_name  TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_companies_group ON public.companies (group_id);

-- ---------- company_members (user ↔ company) ----------
CREATE TABLE IF NOT EXISTS public.company_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (user_id, company_id)
);
CREATE INDEX IF NOT EXISTS idx_company_members_user    ON public.company_members (user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company ON public.company_members (company_id);

-- Access boundary helper — companies the current user may see.
CREATE OR REPLACE FUNCTION public.auth_company_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cm.company_id
    FROM public.company_members cm
   WHERE cm.user_id = auth.uid()
  UNION
  SELECT c.id
    FROM public.companies c
   WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin');
$$;

-- RLS — org structure readable by all authenticated users; writes admin-only.
ALTER TABLE public.groups          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "groups read"  ON public.groups;
DROP POLICY IF EXISTS "groups write" ON public.groups;
CREATE POLICY "groups read"  ON public.groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "groups write" ON public.groups FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "companies read"  ON public.companies;
DROP POLICY IF EXISTS "companies write" ON public.companies;
CREATE POLICY "companies read"  ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "companies write" ON public.companies FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "company_members read"  ON public.company_members;
DROP POLICY IF EXISTS "company_members write" ON public.company_members;
CREATE POLICY "company_members read" ON public.company_members FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE POLICY "company_members write" ON public.company_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Seed — JEET Holding group + operating companies.
INSERT INTO public.groups (name, code)
VALUES ('JEET Holding', 'JEET')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.companies (group_id, name, code)
SELECT g.id, x.name, x.code
  FROM public.groups g
  CROSS JOIN (VALUES
    ('JEET Construction',            'JEET-CON'),
    ('JEET Fitout',                  'JEET-FIT'),
    ('JEET MEP',                     'JEET-MEP'),
    ('JEET Trading',                 'JEET-TRD'),
    ('JEET Smart Solutions',         'JEET-SMT'),
    ('JEET Facilities Management',   'JEET-FM')
  ) AS x(name, code)
 WHERE g.code = 'JEET'
ON CONFLICT (code) DO NOTHING;

-- Backfill — every existing user becomes a member of a default company (JEET-CON).
INSERT INTO public.company_members (user_id, company_id, is_default)
SELECT p.id, c.id, true
  FROM public.profiles p
  CROSS JOIN (SELECT id FROM public.companies WHERE code = 'JEET-CON' LIMIT 1) c
ON CONFLICT (user_id, company_id) DO NOTHING;


-- ════════════════════════════════════════════════════════════════════════════
-- §2 — 20260618160000_company_id_wave1.sql   (projects, clients, tenders, quotations)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.projects   ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.clients    ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.tenders    ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

CREATE INDEX IF NOT EXISTS idx_projects_company   ON public.projects (company_id);
CREATE INDEX IF NOT EXISTS idx_clients_company    ON public.clients (company_id);
CREATE INDEX IF NOT EXISTS idx_tenders_company    ON public.tenders (company_id);
CREATE INDEX IF NOT EXISTS idx_quotations_company ON public.quotations (company_id);

DO $$
DECLARE
  v_default UUID;
BEGIN
  SELECT id INTO v_default FROM public.companies WHERE code = 'JEET-CON' LIMIT 1;
  IF v_default IS NOT NULL THEN
    UPDATE public.projects   SET company_id = v_default WHERE company_id IS NULL;
    UPDATE public.clients    SET company_id = v_default WHERE company_id IS NULL;
    UPDATE public.tenders    SET company_id = v_default WHERE company_id IS NULL;
    UPDATE public.quotations SET company_id = v_default WHERE company_id IS NULL;
  END IF;
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- §3 — 20260618170000_company_id_wave2.sql   (PR, PO, GRN, AR/AP invoices, employees)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.purchase_requests ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.purchase_orders   ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.grns              ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.client_invoices   ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.supplier_invoices ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.employees         ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_company ON public.purchase_requests (company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_company   ON public.purchase_orders (company_id);
CREATE INDEX IF NOT EXISTS idx_grns_company              ON public.grns (company_id);
CREATE INDEX IF NOT EXISTS idx_client_invoices_company   ON public.client_invoices (company_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_company ON public.supplier_invoices (company_id);
CREATE INDEX IF NOT EXISTS idx_employees_company         ON public.employees (company_id);

DO $$
DECLARE
  v_default UUID;
BEGIN
  SELECT id INTO v_default FROM public.companies WHERE code = 'JEET-CON' LIMIT 1;
  IF v_default IS NOT NULL THEN
    UPDATE public.purchase_requests SET company_id = v_default WHERE company_id IS NULL;
    UPDATE public.purchase_orders   SET company_id = v_default WHERE company_id IS NULL;
    UPDATE public.grns              SET company_id = v_default WHERE company_id IS NULL;
    UPDATE public.client_invoices   SET company_id = v_default WHERE company_id IS NULL;
    UPDATE public.supplier_invoices SET company_id = v_default WHERE company_id IS NULL;
    UPDATE public.employees         SET company_id = v_default WHERE company_id IS NULL;
  END IF;
END $$;

-- ============================================================================
-- DONE. Verify quickly (optional):
--   select code, name from public.companies order by code;
--   select count(*) from public.company_members;
--   select company_id from public.quotations limit 1;   -- column now exists
-- ============================================================================
