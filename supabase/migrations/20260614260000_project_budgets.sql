-- ============================================================
-- JEET ERP — Finance: Budget & Cost Control (Page 1)
--
-- Project budgets (revisioned, frozen on approval) and budget lines
-- by cost category / system, seeded from the BOQ. Committed and actual
-- cost are computed live from commitments (LPOs) and supplier bills;
-- planned/forecast are stored.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  revision_no INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'SUPERSEDED')),
  approved_date DATE,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  total_budget NUMERIC(14,2) NOT NULL DEFAULT 0,
  contingency NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (project_id, revision_no)
);

CREATE TABLE IF NOT EXISTS public.project_budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID REFERENCES public.project_budgets(id) ON DELETE CASCADE NOT NULL,
  cost_category TEXT NOT NULL DEFAULT 'MATERIAL',
  system_name TEXT,
  boq_item_id TEXT,
  planned_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  committed_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  actual_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  forecast_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  variance_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  variance_percent NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_budgets_project ON public.project_budgets (project_id);
CREATE INDEX IF NOT EXISTS idx_project_budget_lines_budget ON public.project_budget_lines (budget_id);

ALTER TABLE public.project_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_budget_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow auth read on project_budgets" ON public.project_budgets;
DROP POLICY IF EXISTS "Allow auth write on project_budgets" ON public.project_budgets;
DROP POLICY IF EXISTS "Allow auth read on project_budget_lines" ON public.project_budget_lines;
DROP POLICY IF EXISTS "Allow auth write on project_budget_lines" ON public.project_budget_lines;
CREATE POLICY "Allow auth read on project_budgets" ON public.project_budgets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on project_budgets" ON public.project_budgets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow auth read on project_budget_lines" ON public.project_budget_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on project_budget_lines" ON public.project_budget_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
