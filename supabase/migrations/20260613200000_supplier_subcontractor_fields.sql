-- ============================================================
-- JEET ERP — Subcontractor fields on the supplier registry
-- Distinguishes material suppliers from subcontractors and
-- captures trade + manpower day rate for subcontractors.
-- ============================================================

ALTER TABLE public.pricing_suppliers
  ADD COLUMN IF NOT EXISTS supplier_type TEXT NOT NULL DEFAULT 'SUPPLIER'
    CHECK (supplier_type IN ('SUPPLIER', 'SUBCONTRACTOR', 'BOTH')),
  ADD COLUMN IF NOT EXISTS trade TEXT,
  ADD COLUMN IF NOT EXISTS day_rate NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS manpower_notes TEXT;
