-- ============================================================================
-- AURA 0.2 — Multi-Company REPAIR (idempotent, safe to re-run)
-- Symptom: REST 404 on groups/companies/company_members for the authenticated
-- role, and the 3 tables are EMPTY — i.e. the foundation migration's policies +
-- grants + seed never took effect on this DB (tables exist without them).
--
-- This re-applies: RLS policies, the auth_company_ids() helper, explicit GRANTs,
-- the JEET group + 6 companies seed, member backfill, and a PostgREST reload.
-- Paste into the Supabase SQL Editor and run once. Then make sure you are LOGGED
-- IN (policies are TO authenticated) and reload /intelligence.
-- ============================================================================

-- ---------- tables (no-op if they already exist) ----------
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  legal_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_companies_group ON public.companies (group_id);
CREATE TABLE IF NOT EXISTS public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (user_id, company_id)
);
CREATE INDEX IF NOT EXISTS idx_company_members_user    ON public.company_members (user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company ON public.company_members (company_id);

-- ---------- access-boundary helper ----------
CREATE OR REPLACE FUNCTION public.auth_company_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  UNION
  SELECT c.id FROM public.companies c
   WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin');
$$;

-- ---------- RLS: org structure readable by all authenticated; writes admin-only ----------
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

-- ---------- explicit GRANTs (the likely 404 cause: role had no table privilege) ----------
GRANT SELECT ON public.groups          TO authenticated;
GRANT SELECT ON public.companies        TO authenticated;
GRANT SELECT ON public.company_members  TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.groups, public.companies, public.company_members TO authenticated; -- rows still gated by the admin-only write policies

-- ---------- seed: JEET group + operating companies ----------
INSERT INTO public.groups (name, code) VALUES ('JEET Holding', 'JEET')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.companies (group_id, name, code)
SELECT g.id, x.name, x.code
  FROM public.groups g
  CROSS JOIN (VALUES
    ('JEET Construction',          'JEET-CON'),
    ('JEET Fitout',                'JEET-FIT'),
    ('JEET MEP',                   'JEET-MEP'),
    ('JEET Trading',               'JEET-TRD'),
    ('JEET Smart Solutions',       'JEET-SMT'),
    ('JEET Facilities Management', 'JEET-FM')
  ) AS x(name, code)
 WHERE g.code = 'JEET'
ON CONFLICT (code) DO NOTHING;

-- ---------- backfill: every existing user → member of JEET Construction ----------
INSERT INTO public.company_members (user_id, company_id, is_default)
SELECT p.id, c.id, true
  FROM public.profiles p
  CROSS JOIN (SELECT id FROM public.companies WHERE code = 'JEET-CON' LIMIT 1) c
ON CONFLICT (user_id, company_id) DO NOTHING;

-- ---------- force PostgREST to refresh its schema/permission cache ----------
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Verify:  SELECT code, name FROM public.companies ORDER BY code;   → 6 rows
-- Then reload /intelligence; the company switcher should list the JEET companies.
-- ============================================================================
