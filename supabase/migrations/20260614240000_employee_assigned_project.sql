-- ============================================================
-- JEET ERP — Employee assigned/home project
--
-- Used as the fallback when allocating payroll labour cost: staff
-- with no timesheet project hours for the month are charged to their
-- assigned project (instead of Office overhead).
-- ============================================================

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS assigned_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
