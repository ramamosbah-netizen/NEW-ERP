-- ============================================================
-- JEET ERP — Projects: Daily Site Report (DSR)
-- Per-day site log: manpower (by trade), weather, work done,
-- materials, equipment, delays, safety, visitors and photos.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.daily_site_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  weather TEXT,                                  -- SUNNY/CLOUDY/RAINY/WINDY/HOT
  temperature_c NUMERIC(5,1),
  manpower JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{ trade, count }]
  total_manpower INTEGER NOT NULL DEFAULT 0,
  work_done TEXT,
  materials_received TEXT,
  equipment_on_site TEXT,
  delays_issues TEXT,
  safety_notes TEXT,
  visitors TEXT,
  photo_document_ids TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED')),
  prepared_by_name TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dsr_project ON public.daily_site_reports (project_id);
CREATE INDEX IF NOT EXISTS idx_dsr_date ON public.daily_site_reports (report_date);

ALTER TABLE public.daily_site_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow auth read on daily_site_reports" ON public.daily_site_reports;
DROP POLICY IF EXISTS "Allow auth write on daily_site_reports" ON public.daily_site_reports;
CREATE POLICY "Allow auth read on daily_site_reports" ON public.daily_site_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on daily_site_reports" ON public.daily_site_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
