-- ============================================================
-- JEET ERP — Store the client's LPO / contract document on the
-- quotation when it is accepted. Lets estimators attach the
-- signed LPO/PO or contract PDF that confirms acceptance.
-- (Future: AI email/WhatsApp follow-up will populate these
-- automatically when a confirmation is detected.)
-- ============================================================

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS client_po_document_path TEXT,
  ADD COLUMN IF NOT EXISTS client_po_document_name TEXT;
