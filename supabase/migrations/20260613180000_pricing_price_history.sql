-- ============================================================
-- JEET ERP — Catalogue price history
-- Records every material-cost change on a pricing_items row with
-- its source (supplier invoice / proforma / PO / manual), so the
-- catalogue price can be auto-updated as real supplier prices
-- arrive and the trail is auditable (AI can mine this later).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pricing_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_item_id UUID REFERENCES public.pricing_items(id) ON DELETE CASCADE NOT NULL,
  old_material_cost NUMERIC(14,4),
  new_material_cost NUMERIC(14,4) NOT NULL,
  source TEXT NOT NULL,            -- SUPPLIER_INVOICE | PROFORMA | PO | MANUAL
  source_ref TEXT,                 -- invoice/PO number etc.
  supplier_id UUID REFERENCES public.pricing_suppliers(id) ON DELETE SET NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_price_history_item ON public.pricing_price_history (pricing_item_id, changed_at DESC);

ALTER TABLE public.pricing_price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "price_history_read" ON public.pricing_price_history;
CREATE POLICY "price_history_read" ON public.pricing_price_history
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "price_history_write" ON public.pricing_price_history;
CREATE POLICY "price_history_write" ON public.pricing_price_history
  FOR INSERT TO authenticated WITH CHECK (true);
