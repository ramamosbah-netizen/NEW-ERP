-- ============================================================
-- AURA 0.2 — Phase 2A: Risk Engine hardening (ADDITIVE, safe on populated DB)
-- Adds: dedup fingerprint, numeric scoring, risk-domain classification,
-- occurrence tracking, and lifecycle metadata to intel_risk_alert.
-- The 4 lifecycle states (OPEN/ACKNOWLEDGED/RESOLVED/DISMISSED) already exist
-- on the `status` column from the intelligence migration.
-- ============================================================

ALTER TABLE public.intel_risk_alert ADD COLUMN IF NOT EXISTS dedup_key        TEXT;
ALTER TABLE public.intel_risk_alert ADD COLUMN IF NOT EXISTS score            INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.intel_risk_alert ADD COLUMN IF NOT EXISTS risk_domain      TEXT NOT NULL DEFAULT 'GENERAL'
  CHECK (risk_domain IN ('FINANCE','PROCUREMENT','PROJECT','COMPLIANCE','SUPPLY','HR','GENERAL'));
ALTER TABLE public.intel_risk_alert ADD COLUMN IF NOT EXISTS occurrence_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.intel_risk_alert ADD COLUMN IF NOT EXISTS last_event_at    TIMESTAMPTZ;
ALTER TABLE public.intel_risk_alert ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now());
ALTER TABLE public.intel_risk_alert ADD COLUMN IF NOT EXISTS acknowledged_at  TIMESTAMPTZ;
ALTER TABLE public.intel_risk_alert ADD COLUMN IF NOT EXISTS resolved_at      TIMESTAMPTZ;
ALTER TABLE public.intel_risk_alert ADD COLUMN IF NOT EXISTS status_changed_by UUID;
ALTER TABLE public.intel_risk_alert ADD COLUMN IF NOT EXISTS resolution_note  TEXT;

-- One ACTIVE alert per fingerprint. RESOLVED/DISMISSED do NOT block a re-raise,
-- so a recurring problem opens a fresh alert after closure.
CREATE UNIQUE INDEX IF NOT EXISTS uq_intel_risk_active_dedup
  ON public.intel_risk_alert (dedup_key)
  WHERE status IN ('OPEN','ACKNOWLEDGED');

CREATE INDEX IF NOT EXISTS idx_intel_risk_company_status_sev
  ON public.intel_risk_alert (company_id, status, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intel_risk_domain
  ON public.intel_risk_alert (company_id, risk_domain);
