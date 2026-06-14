-- ============================================================
-- JEET ERP — Fix stock RLS (403s) + enable manual movements
--
-- Problem: creating a store location or recording a stock movement
-- from the app returned 403 (RLS). The stock_* write policies were
-- gated to roles ('storekeeper','procurement','admin'), but most
-- users are 'manager'/'engineer', and the rest of the ERP uses the
-- collaborative "authenticated may write, role enforced in app layer"
-- rule (grns, boqs, rfqs, mrf_items, stock_count_lines).
--
-- This aligns the core inventory tables to that collaborative rule and
-- adds a RETURN_TO_SUPPLIER movement type for the new movement UI.
-- ============================================================

-- 1. Relax write policies to authenticated (collaborative ERP rule)
-- Drop both the old role-gated name and the new name so this is re-runnable.
DROP POLICY IF EXISTS "Allow write on stock_locations for storekeeper, procurement, admin" ON public.stock_locations;
DROP POLICY IF EXISTS "Allow write on stock_locations for authenticated" ON public.stock_locations;
CREATE POLICY "Allow write on stock_locations for authenticated" ON public.stock_locations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow write on stock_items for storekeeper, procurement, admin" ON public.stock_items;
DROP POLICY IF EXISTS "Allow write on stock_items for authenticated" ON public.stock_items;
CREATE POLICY "Allow write on stock_items for authenticated" ON public.stock_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow write on stock_balances for storekeeper, procurement, admin" ON public.stock_balances;
DROP POLICY IF EXISTS "Allow write on stock_balances for authenticated" ON public.stock_balances;
CREATE POLICY "Allow write on stock_balances for authenticated" ON public.stock_balances
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow insert on stock_transactions for storekeeper, procurement, admin" ON public.stock_transactions;
DROP POLICY IF EXISTS "Allow insert on stock_transactions for authenticated" ON public.stock_transactions;
CREATE POLICY "Allow insert on stock_transactions for authenticated" ON public.stock_transactions
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow write on serial_units for storekeeper, procurement, admin" ON public.serial_units;
DROP POLICY IF EXISTS "Allow write on serial_units for authenticated" ON public.serial_units;
CREATE POLICY "Allow write on serial_units for authenticated" ON public.serial_units
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Add RETURN_TO_SUPPLIER to the stock movement types
ALTER TABLE public.stock_transactions DROP CONSTRAINT IF EXISTS stock_transactions_type_check;
ALTER TABLE public.stock_transactions ADD CONSTRAINT stock_transactions_type_check
  CHECK (type IN (
    'GRN_RECEIPT', 'ISSUE_TO_PROJECT', 'ISSUE_TO_TICKET', 'RETURN_FROM_SITE',
    'RETURN_TO_SUPPLIER', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT', 'WRITE_OFF'
  ));

NOTIFY pgrst, 'reload schema';
