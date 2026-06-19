-- ============================================================
-- Aura ERP — System Health: scheduled-job run registry
-- ------------------------------------------------------------
-- Adds `system_jobs` — a structured log of edge-function / scheduled-job
-- runs (one row per invocation) so the Administration → System Health
-- console can show last-run status, duration, throughput and failures.
--
-- The event PIPELINE health (queue depth, dead-letter, throughput) is read
-- from the EXISTING `system_events` ledger — this migration does NOT
-- duplicate that; it only adds the job-run dimension that wasn't tracked.
--
-- Writers: edge functions (service-role, bypasses RLS) via _shared/jobRun.ts.
-- Readers: the admin console (authenticated; nav-gated to admins). No PII.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.system_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name        TEXT NOT NULL,                         -- edge function / job key, e.g. 'escalation-check'
  status          TEXT NOT NULL DEFAULT 'RUNNING'
                    CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED')),
  started_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  finished_at     TIMESTAMP WITH TIME ZONE,
  duration_ms     INTEGER,
  items_processed INTEGER,
  error           TEXT,
  details         JSONB,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_system_jobs_name_started ON public.system_jobs (job_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_jobs_started      ON public.system_jobs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_jobs_status       ON public.system_jobs (status);

ALTER TABLE public.system_jobs ENABLE ROW LEVEL SECURITY;

-- Read-only for the app (the System Health page is admin-gated in the nav).
-- Inserts/updates come from edge functions using the service-role key, which
-- bypasses RLS — so no write policy is defined (writes are blocked for anon
-- and authenticated clients by default).
DROP POLICY IF EXISTS "system_jobs read" ON public.system_jobs;
CREATE POLICY "system_jobs read" ON public.system_jobs
  FOR SELECT TO authenticated USING (true);

-- Optional housekeeping helper: prune run history older than N days.
CREATE OR REPLACE FUNCTION public.prune_system_jobs(p_days INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.system_jobs
   WHERE started_at < timezone('utc'::text, now()) - (p_days || ' days')::interval;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
