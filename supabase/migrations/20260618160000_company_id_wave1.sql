-- ============================================================
-- Aura ERP — Multi-Company  ·  Phase 0b: company_id wave 1 (ADDITIVE)
-- ------------------------------------------------------------
-- Adds a NULLABLE company_id to the first wave of top-level commercial entities
-- and backfills it to the default company. Still NON-BREAKING:
--   • columns are nullable (no NOT NULL yet)
--   • existing RLS is untouched (no company scoping yet)
--   • backfill assigns all current rows to JEET Construction so nothing is blank
--
-- Per-module RLS scoping (company_id IN (SELECT auth_company_ids())) and the
-- NOT NULL tightening come in a later phase, once the active-company context is
-- consumed across the affected pages.
-- ============================================================

ALTER TABLE public.projects   ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.clients    ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.tenders    ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

CREATE INDEX IF NOT EXISTS idx_projects_company   ON public.projects (company_id);
CREATE INDEX IF NOT EXISTS idx_clients_company    ON public.clients (company_id);
CREATE INDEX IF NOT EXISTS idx_tenders_company    ON public.tenders (company_id);
CREATE INDEX IF NOT EXISTS idx_quotations_company ON public.quotations (company_id);

-- Backfill to the default company (JEET Construction).
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
