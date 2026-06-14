-- ============================================================
-- JEET ERP — Attach a supplier proforma invoice to each LPO/PO.
-- The proforma invoice (PI) the supplier issues against the LPO
-- is uploaded and stored on the purchase order so it travels
-- with the document and can be exported/reviewed.
-- ============================================================

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS proforma_invoice_path TEXT,
  ADD COLUMN IF NOT EXISTS proforma_invoice_name TEXT,
  ADD COLUMN IF NOT EXISTS proforma_invoice_uploaded_at TIMESTAMP WITH TIME ZONE;
