-- ============================================================================
-- AURA 0.2 — Intelligence Layer · consolidated apply script
-- Paste into the Supabase SQL Editor and run ONCE, top to bottom.
-- Equivalent to applying these migrations in order:
--   20260622100000_events_upgrade.sql        (event spine: company_id + taxonomy)
--   20260622110000_intelligence_layer.sql    (intel_risk_alert / recommendation / insight)
--   20260622120000_risk_engine_phase2a.sql   (risk lifecycle columns + dedup index)
--
-- ⚠️  SECTION 2 STARTS WITH `DROP TABLE ... CASCADE` on the three intel_* tables.
--     First apply: correct (clean create). Re-running: DESTROYS existing intel
--     data (risk alerts / recommendations / insights). Sections 1 and 3 are
--     fully idempotent. If intel_* already hold data you want, DELETE section 2's
--     DROP lines before running.
--
-- Prereqs (already in your base schema): public.system_events, public.event_types.
-- Also ensure SUPABASE_SERVICE_ROLE_KEY is set in the app env.
-- ============================================================================


-- ████████████████████████████████████████████████████████████████████████████
-- SECTION 1 — Event spine upgrade  (20260622100000)  · ADDITIVE, idempotent
-- ████████████████████████████████████████████████████████████████████████████

-- 1. Multi-tenant + versioning columns on the ledger ---------------------------
ALTER TABLE public.system_events ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE public.system_events ADD COLUMN IF NOT EXISTS event_version INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_se_company ON public.system_events (company_id);
CREATE INDEX IF NOT EXISTS idx_se_company_type ON public.system_events (company_id, event_type, created_at DESC);

-- 2. Canonical event taxonomy --------------------------------------------------
-- (existing quotation/comparison/project/document/task/meeting/approval rows are
--  left intact; ON CONFLICT keeps this idempotent.)
INSERT INTO public.event_types (event_type, module, description, default_severity) VALUES
  -- FINANCE
  ('invoice.created',           'FINANCE',     'AP/AR invoice created',                         'INFO'),
  ('invoice.approved',          'FINANCE',     'Invoice approved for payment',                  'INFO'),
  ('invoice.overdue',           'FINANCE',     'Invoice past due date, unpaid',                 'ACTION_REQUIRED'),
  ('payment.recorded',          'FINANCE',     'Payment posted against an invoice',             'INFO'),
  ('journal.posted',            'FINANCE',     'Journal entry posted to the GL',                'INFO'),
  ('budget.exceeded',           'FINANCE',     'Project/cost-center budget exceeded',           'CRITICAL'),
  -- PROCUREMENT
  ('pr.created',                'PROCUREMENT', 'Purchase requisition raised',                   'INFO'),
  ('pr.approved',              'PROCUREMENT', 'Purchase requisition approved',                 'INFO'),
  ('rfq.issued',               'PROCUREMENT', 'Request for quotation issued to suppliers',     'INFO'),
  ('comparison.completed',     'PROCUREMENT', 'Supplier comparison finalised',                 'INFO'),
  ('po.created',               'PROCUREMENT', 'Purchase order created',                         'INFO'),
  ('po.approved',              'PROCUREMENT', 'Purchase order approved',                        'INFO'),
  ('po.high_value',            'PROCUREMENT', 'High-value PO requires elevated authority',      'ACTION_REQUIRED'),
  ('grn.received',             'PROCUREMENT', 'Goods received against a PO',                    'INFO'),
  ('three_way_match.exception','PROCUREMENT', 'PO/GRN/Invoice 3-way match discrepancy',        'ACTION_REQUIRED'),
  -- PROJECTS
  ('project.progress_updated', 'PROJECTS',    'Project progress / EVM updated',                'INFO'),
  ('project.milestone_due',    'PROJECTS',    'Project milestone due soon',                    'ACTION_REQUIRED'),
  ('project.budget_overrun',   'PROJECTS',    'Project cost exceeding budget (CPI < 1)',       'CRITICAL'),
  ('project.risk_raised',      'PROJECTS',    'Risk added to the project risk register',       'ACTION_REQUIRED'),
  ('project.completed',        'PROJECTS',    'Project moved to completed/handover',           'INFO'),
  -- PRE-CONTRACT (deal chain)
  ('tender.received',          'TENDER',      'New tender intake',                             'INFO'),
  ('tender.bid_decided',       'TENDER',      'Bid / No-bid decision recorded',                'INFO'),
  ('estimation.submitted',     'TENDER',      'Estimation submitted for review',               'ACTION_REQUIRED'),
  ('pricing.run_completed',    'PRICING',     'Pricing run calculated',                        'INFO'),
  ('pricing.low_margin',       'PRICING',     'Pricing run below the margin guardrail',        'ACTION_REQUIRED'),
  ('quote.created',            'SALES',       'Quotation created from a pricing run',          'INFO'),
  ('quote.sent',              'SALES',       'Quotation sent to client',                      'INFO'),
  ('quote.won',               'SALES',       'Quotation won',                                 'INFO'),
  ('quote.lost',              'SALES',       'Quotation lost',                                'ACTION_REQUIRED'),
  ('contract.signed',         'SALES',       'Sales contract signed → project handoff',       'INFO'),
  -- INVENTORY
  ('stock.low',               'INVENTORY',   'Stock item below reorder level',                'ACTION_REQUIRED'),
  ('stock.movement',          'INVENTORY',   'Goods movement posted',                          'INFO'),
  ('stock.dead',              'INVENTORY',   'Item flagged as dead stock',                     'INFO'),
  ('material.shortage',       'INVENTORY',   'Material shortage detected for project demand',  'CRITICAL'),
  -- HR
  ('leave.requested',         'HR',          'Employee leave requested',                       'INFO'),
  ('employee.visa_expiring',  'HR',          'Employee visa / work permit nearing expiry',     'CRITICAL'),
  ('payroll.run',             'HR',          'Payroll run executed',                           'INFO'),
  -- RISK / AI
  ('risk.identified',         'RISK',        'New risk identified',                            'ACTION_REQUIRED'),
  ('risk.escalated',          'RISK',        'Risk severity escalated',                        'CRITICAL'),
  ('ai.insight_generated',    'INTELLIGENCE','Intelligence engine produced an insight',        'INFO'),
  ('autonomy.action_proposed','INTELLIGENCE','Autonomy engine proposed an action',             'ACTION_REQUIRED')
ON CONFLICT (event_type) DO UPDATE SET
  module = EXCLUDED.module,
  description = EXCLUDED.description,
  default_severity = EXCLUDED.default_severity;


-- ████████████████████████████████████████████████████████████████████████████
-- SECTION 2 — Intelligence Layer schema  (20260622110000)
-- ⚠️ DROP-then-CREATE. First apply only — re-running wipes intel_* data.
-- ████████████████████████████████████████████████████████████████████████████

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


-- ████████████████████████████████████████████████████████████████████████████
-- SECTION 3 — Risk Engine Phase 2A hardening  (20260622120000)  · ADDITIVE, idempotent
-- ████████████████████████████████████████████████████████████████████████████

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

-- ============================================================================
-- DONE. Next: hit "Run analysis" on /intelligence (POST /api/intelligence/process)
-- to backfill alerts from existing system_events, then reload the board.
-- ============================================================================
