-- ============================================================
-- JEET ERP — Projects: Work Breakdown Structure (WBS)
-- Hierarchical work packages per project (budget + weight). The
-- foundation that Schedule/Gantt and Progress/EVM hang off.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_wbs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES public.project_wbs(id) ON DELETE CASCADE,
  code TEXT,                                    -- e.g. 1.2.3
  name TEXT NOT NULL,
  system_name TEXT,
  budget_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  weight_pct NUMERIC(6,2) NOT NULL DEFAULT 0,   -- contribution to project completion
  progress_pct NUMERIC(6,2) NOT NULL DEFAULT 0, -- % complete (leaf entry; parents roll up)
  planned_start DATE,
  planned_end DATE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wbs_project ON public.project_wbs (project_id);
CREATE INDEX IF NOT EXISTS idx_wbs_parent ON public.project_wbs (parent_id);

ALTER TABLE public.project_wbs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow auth read on project_wbs" ON public.project_wbs;
DROP POLICY IF EXISTS "Allow auth write on project_wbs" ON public.project_wbs;
CREATE POLICY "Allow auth read on project_wbs" ON public.project_wbs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on project_wbs" ON public.project_wbs FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
