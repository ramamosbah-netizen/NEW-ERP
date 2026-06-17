-- ============================================================
-- JEET ERP — DATA RESET (one-time, run BEFORE the portfolio seed)
-- ------------------------------------------------------------
-- Empties ALL operational/business data so only the real portfolio remains,
-- WITHOUT dropping the schema or re-applying 40 migration files.
--
-- Truncates every table in `public` EXCEPT the preserve-list below
-- (identity, access, settings, workflow CONFIG, numbering, forms, templates,
-- rules, pricing catalog). CASCADE empties children in the correct FK order
-- in a single pass, so no manual ordering is needed.
--
-- PRESERVED:
--   • auth.users (different schema — never touched here)
--   • profiles, roles, permissions, user_roles, user_*  (identity/access)
--   • settings, company_holidays, numbering_rules        (configuration)
--   • workflow_definitions / _statuses / _transitions    (workflow CONFIG)
--   • form_definitions, document_templates, business_rules
--   • pricing_items                                      (reference catalog)
--
-- WIPED: projects, clients, client_invoices, purchase_orders, GRNs, quotations,
--   tenders, boqs, snags, T&C, VO, fleet, inventory, assets, comms, tasks,
--   notifications, audit_log, workflow_instances, pricing_suppliers, …
--
-- After this runs, apply 20260617000000_seed_portfolio.sql.
-- Idempotent: re-running just re-empties (then re-seed).
-- ============================================================

DO $$
DECLARE
  r RECORD;
  preserve TEXT[] := ARRAY[
    'profiles','roles','permissions','user_roles','user_integrations',
    'user_notification_preferences','user_smtp_configs',
    'settings','company_holidays','numbering_rules',
    'workflow_definitions','workflow_statuses','workflow_transitions',
    'form_definitions','document_templates','business_rules','pricing_items'
  ];
BEGIN
  -- TRUNCATE empties tables without firing row CHECKs / DELETE triggers / FK
  -- SET-NULL actions, and CASCADE clears children in correct order — so no
  -- trigger-disabling is needed.
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> ALL (preserve)
    ORDER BY tablename
  LOOP
    EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', r.tablename);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
