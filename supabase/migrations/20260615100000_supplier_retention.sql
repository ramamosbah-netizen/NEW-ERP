-- ============================================================
-- JEET ERP — Finance: Retention Payable (subcontractor retention)
-- Retention we withhold from subcontractors (the payable counterpart
-- of project_retention_ledger, which is client-side receivable).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.supplier_retention_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.pricing_suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,
  supplier_invoice_id UUID REFERENCES public.supplier_invoices(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('HELD', 'RELEASED')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  expected_release_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_supplier_retention_supplier ON public.supplier_retention_ledger (supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_retention_project ON public.supplier_retention_ledger (project_id);

ALTER TABLE public.supplier_retention_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow auth read on supplier_retention_ledger" ON public.supplier_retention_ledger;
DROP POLICY IF EXISTS "Allow auth write on supplier_retention_ledger" ON public.supplier_retention_ledger;
CREATE POLICY "Allow auth read on supplier_retention_ledger" ON public.supplier_retention_ledger FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on supplier_retention_ledger" ON public.supplier_retention_ledger FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
