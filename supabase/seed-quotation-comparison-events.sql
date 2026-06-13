-- ============================================================
-- JEET ERP — Register missing quotation & comparison event types
--
-- quotation-service.ts and comparison-service.ts emit these
-- events, but they were never added to the event_types catalog.
-- Because system_events.event_type has a FK to event_types,
-- every emit failed with 23503 (foreign key violation) and the
-- approval flows logged "Failed to insert system event".
-- ============================================================

INSERT INTO public.event_types (event_type, module, description, default_severity) VALUES
  ('quotation.commercial_approved', 'QUOTATION', 'Quotation approved at the commercial stage; awaiting GM approval', 'ACTION_REQUIRED'),
  ('quotation.sent_to_client',      'QUOTATION', 'Quotation issued/sent to the client', 'INFO'),
  ('comparison.commercial_approved','COMPARISON', 'Supplier comparison approved at the commercial stage; awaiting next approval', 'ACTION_REQUIRED'),
  ('comparison.rejected',           'COMPARISON', 'Supplier comparison returned or rejected during review', 'INFO')
ON CONFLICT (event_type) DO UPDATE SET
  module = EXCLUDED.module,
  description = EXCLUDED.description,
  default_severity = EXCLUDED.default_severity,
  is_active = true;
