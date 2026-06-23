-- ============================================================
-- AURA 0.2 — Intelligence Layer Schema
-- Reads ONLY from the event ledger (public.system_events).
-- Writes ONLY to these tables. Never mutates CORE/transactional data.
-- Multi-tenant (company_id), indexed, append-friendly.
-- ============================================================

DROP TABLE IF EXISTS public.intel_risk_alert CASCADE;
DROP TABLE IF EXISTS public.intel_recommendation CASCADE;
DROP TABLE IF EXISTS public.intel_insight CASCADE;

-- 1. RISK ALERTS — Risk Engine output
CREATE TABLE public.intel_risk_alert (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  engine TEXT NOT NULL DEFAULT 'RISK',
  source_event_id UUID,            -- soft ref to system_events.id (decoupled, replay-safe)
  source_event_type TEXT,
  entity_type TEXT,
  entity_id UUID,
  project_id UUID,
  severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  category TEXT NOT NULL DEFAULT 'GENERAL',
  title TEXT NOT NULL,
  detail TEXT,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.700,
  factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','ACKNOWLEDGED','RESOLVED','DISMISSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 2. RECOMMENDATIONS — Margin / Forecast engine output
CREATE TABLE public.intel_recommendation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  engine TEXT NOT NULL,
  source_event_id UUID,
  source_event_type TEXT,
  entity_type TEXT,
  entity_id UUID,
  project_id UUID,
  action_type TEXT NOT NULL DEFAULT 'REVIEW',
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW','MEDIUM','HIGH')),
  title TEXT NOT NULL,
  detail TEXT,
  rationale TEXT,
  expected_impact JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACCEPTED','DISMISSED','DONE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 3. INSIGHTS — analytics / observations from all engines
CREATE TABLE public.intel_insight (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  engine TEXT NOT NULL,
  source_event_id UUID,
  source_event_type TEXT,
  entity_type TEXT,
  entity_id UUID,
  project_id UUID,
  kind TEXT NOT NULL DEFAULT 'TREND',
  title TEXT NOT NULL,
  detail TEXT,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.700,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Row Level Security (mirrors system_events: authenticated read; service/authenticated write)
ALTER TABLE public.intel_risk_alert     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intel_recommendation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intel_insight        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intel_risk_read"  ON public.intel_risk_alert     FOR SELECT TO authenticated USING (true);
CREATE POLICY "intel_risk_write" ON public.intel_risk_alert     FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "intel_rec_read"   ON public.intel_recommendation FOR SELECT TO authenticated USING (true);
CREATE POLICY "intel_rec_write"  ON public.intel_recommendation FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "intel_ins_read"   ON public.intel_insight        FOR SELECT TO authenticated USING (true);
CREATE POLICY "intel_ins_write"  ON public.intel_insight        FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_intel_risk_company ON public.intel_risk_alert (company_id);
CREATE INDEX idx_intel_risk_project ON public.intel_risk_alert (project_id);
CREATE INDEX idx_intel_risk_status  ON public.intel_risk_alert (status);
CREATE INDEX idx_intel_risk_sev     ON public.intel_risk_alert (severity);
CREATE INDEX idx_intel_risk_created ON public.intel_risk_alert (created_at DESC);
CREATE INDEX idx_intel_risk_srcevt  ON public.intel_risk_alert (source_event_id);

CREATE INDEX idx_intel_rec_company  ON public.intel_recommendation (company_id);
CREATE INDEX idx_intel_rec_project  ON public.intel_recommendation (project_id);
CREATE INDEX idx_intel_rec_status   ON public.intel_recommendation (status);
CREATE INDEX idx_intel_rec_created  ON public.intel_recommendation (created_at DESC);
CREATE INDEX idx_intel_rec_srcevt   ON public.intel_recommendation (source_event_id);

CREATE INDEX idx_intel_ins_company  ON public.intel_insight (company_id);
CREATE INDEX idx_intel_ins_project  ON public.intel_insight (project_id);
CREATE INDEX idx_intel_ins_kind     ON public.intel_insight (kind);
CREATE INDEX idx_intel_ins_created  ON public.intel_insight (created_at DESC);
CREATE INDEX idx_intel_ins_srcevt   ON public.intel_insight (source_event_id);
