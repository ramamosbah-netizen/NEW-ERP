-- ============================================================
-- JEET ERP — Per-line status on Purchase Request items
-- Lets an individual requested item be cancelled or marked
-- received from the GRN Receivables view. When every line of a
-- PR is cancelled, the PR itself is cancelled.
-- ============================================================

ALTER TABLE public.purchase_request_items
  ADD COLUMN IF NOT EXISTS line_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (line_status IN ('PENDING', 'RECEIVED', 'CANCELLED')),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
