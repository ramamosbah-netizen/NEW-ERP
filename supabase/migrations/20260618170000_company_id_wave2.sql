-- ============================================================
-- Aura ERP — Multi-Company  ·  wave 2: company_id (ADDITIVE)
-- ------------------------------------------------------------
-- Extends the tenancy column to the money + workforce modules:
--   procurement: purchase_requests, purchase_orders, grns
--   finance:     client_invoices (AR), supplier_invoices (AP)
--   HR:          employees
--
-- Same contract as wave 1 (20260618160000): NULLABLE column, indexed,
-- backfilled to the default company. No NOT NULL, no RLS change. Per-module
-- read/write scoping is wired in the app; RLS tightening is a later phase.
-- ============================================================

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

-- Backfill to the default company (JEET Construction).
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
