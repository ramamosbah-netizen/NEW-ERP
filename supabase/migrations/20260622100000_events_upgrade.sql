-- ============================================================
-- AURA 0.2 — Phase 1 Foundation: Event spine upgrade
-- Additive ONLY. Safe to run on a populated database.
--   1. system_events gains company_id (multi-tenant) + event_version
--   2. event_types gains the canonical core-module catalog so every
--      core mutation has a registered type to emit (FK requirement).
-- Keep the catalog in sync with src/lib/events/event-catalog.ts.
-- ============================================================

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
