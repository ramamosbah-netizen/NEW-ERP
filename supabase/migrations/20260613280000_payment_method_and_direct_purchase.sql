-- ============================================================
-- JEET ERP — Mode of payment + direct (LPO-less) purchase
-- Adds payment_method to LPOs and PRs, and lets a small PR be
-- purchased directly without raising an LPO (threshold is
-- configurable in Admin → Settings → Procurement).
-- ============================================================

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

ALTER TABLE public.purchase_requests
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS is_direct_purchase BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS direct_purchased_at TIMESTAMP WITH TIME ZONE;

-- Allow the PR status to record a direct purchase
ALTER TABLE public.purchase_requests
  DROP CONSTRAINT IF EXISTS purchase_requests_status_check;
ALTER TABLE public.purchase_requests
  ADD CONSTRAINT purchase_requests_status_check
  CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CONVERTED', 'CANCELLED', 'DIRECT_PURCHASED'));

-- Seed the configurable direct-purchase threshold (AED)
INSERT INTO public.settings (key, value, category, data_type, description)
VALUES ('procurement.direct_purchase_threshold', '10000', 'PROCUREMENT', 'NUMBER',
        'Max AED value a Purchase Request may be purchased directly without raising an LPO')
ON CONFLICT (key) DO NOTHING;
