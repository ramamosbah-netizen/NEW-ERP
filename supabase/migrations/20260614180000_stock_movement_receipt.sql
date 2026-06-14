-- ============================================================
-- JEET ERP — Stock movement receipt (storekeeper ↔ receiver)
--
-- Every movement is a handover between the storekeeper (performed_by)
-- and a receiver. Capture the receiver's name so the goods log and
-- the movement receipt voucher can show who received the goods.
-- ============================================================

ALTER TABLE public.stock_transactions
  ADD COLUMN IF NOT EXISTS received_by_name TEXT;

NOTIFY pgrst, 'reload schema';
