-- ============================================================
-- JEET ERP — Finance: Commitments ledger (Page 2)
--
-- Manual commitments (subcontracts, recurring expenses, etc.). Live
-- commitments from approved LPOs and payroll payables are derived in
-- the service, so existing flows are untouched. This table captures
-- what isn't already represented by a PO/payroll record.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cost_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL DEFAULT 'OTHER' CHECK (source_type IN ('PR', 'PO', 'SUBCONTRACT', 'PAYROLL', 'RECURRING', 'OTHER')),
  source_id UUID,
  category TEXT,
  vendor_name TEXT,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  committed_date DATE,
  expected_payment_date DATE,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'PARTIAL', 'SETTLED', 'CANCELLED')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cost_commitments_project ON public.cost_commitments (project_id);
CREATE INDEX IF NOT EXISTS idx_cost_commitments_status ON public.cost_commitments (status);

ALTER TABLE public.cost_commitments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow auth read on cost_commitments" ON public.cost_commitments;
DROP POLICY IF EXISTS "Allow auth write on cost_commitments" ON public.cost_commitments;
CREATE POLICY "Allow auth read on cost_commitments" ON public.cost_commitments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on cost_commitments" ON public.cost_commitments FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
