-- ============================================================
-- JEET ERP — Finance: Treasury (Page 6)
-- Bank facilities: loans, overdrafts, bank guarantees and letters of
-- credit, with sanctioned limit vs utilization and maturity tracking.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.treasury_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('LOAN', 'OVERDRAFT', 'FACILITY', 'BANK_GUARANTEE', 'LC')),
  reference TEXT,
  bank_name TEXT NOT NULL,
  beneficiary TEXT,                                  -- for guarantees / LCs
  facility_limit NUMERIC(16,2) NOT NULL DEFAULT 0,   -- sanctioned amount
  utilized_amount NUMERIC(16,2) NOT NULL DEFAULT 0,
  interest_rate NUMERIC(6,3),                         -- for loans / overdrafts
  issue_date DATE,
  maturity_date DATE,                                -- expiry / maturity
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'CLOSED', 'RELEASED')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_treasury_type ON public.treasury_facilities (type);
CREATE INDEX IF NOT EXISTS idx_treasury_status ON public.treasury_facilities (status);
CREATE INDEX IF NOT EXISTS idx_treasury_maturity ON public.treasury_facilities (maturity_date);

ALTER TABLE public.treasury_facilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow auth read on treasury_facilities" ON public.treasury_facilities;
DROP POLICY IF EXISTS "Allow auth write on treasury_facilities" ON public.treasury_facilities;
CREATE POLICY "Allow auth read on treasury_facilities" ON public.treasury_facilities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on treasury_facilities" ON public.treasury_facilities FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
