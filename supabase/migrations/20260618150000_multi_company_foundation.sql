-- ============================================================
-- Aura ERP — Multi-Company (Group) foundation  ·  Phase 0a (ADDITIVE)
-- ------------------------------------------------------------
-- Introduces the Group → Company → (Department → Project) tenancy backbone
-- needed for a holding group like JEET (Construction / Fitout / MEP / Trading /
-- Smart Solutions / FM) with CROSS-COMPANY collaboration.
--
-- This migration is deliberately NON-BREAKING:
--   • adds NEW tables only (groups, companies, company_members)
--   • does NOT add company_id to business tables yet
--   • does NOT change any existing RLS
--   • seeds the JEET group + companies and backfills every existing user as a
--     member of a default company, so nothing is orphaned
--
-- The `auth_company_ids()` helper is the future security boundary: later phases
-- add a nullable `company_id` to each module's tables and scope their RLS with
-- `company_id IN (SELECT auth_company_ids())`. The active company is a UI concern
-- (a switcher); membership is the access boundary.
-- ============================================================

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

-- ============================================================
-- Access boundary helper — companies the current user may see.
-- STABLE + SECURITY DEFINER so it resolves once per query and can be used in RLS.
-- Self-contained admin check (profiles.role) to avoid migration-order coupling.
-- ============================================================
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

-- ============================================================
-- RLS — org structure is readable by all authenticated users (needed for the
-- company switcher and dropdowns); writes are admin-only. Members see their own
-- memberships; admins see all.
-- ============================================================
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

-- ============================================================
-- Seed — JEET Holding group + operating companies.
-- ============================================================
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

-- ============================================================
-- Backfill — every existing user becomes a member of a default company
-- (JEET Construction) so no account is left without a company. Admins can
-- reassign / add memberships from Administration → Companies.
-- ============================================================
INSERT INTO public.company_members (user_id, company_id, is_default)
SELECT p.id, c.id, true
  FROM public.profiles p
  CROSS JOIN (SELECT id FROM public.companies WHERE code = 'JEET-CON' LIMIT 1) c
ON CONFLICT (user_id, company_id) DO NOTHING;
