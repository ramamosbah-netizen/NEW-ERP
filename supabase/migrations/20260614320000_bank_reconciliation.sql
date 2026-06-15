-- ============================================================
-- JEET ERP — Finance: Bank Reconciliation (Page 4)
-- A reconciliation per payment account + statement period, with the
-- imported statement lines and their match state against system
-- receipts/payments. Read sources: client_payments, supplier_payments,
-- expenses (supplier_invoices). Nothing existing is modified.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bank_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_account_id UUID REFERENCES public.payment_accounts(id) ON DELETE SET NULL,
  account_name TEXT,
  statement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMPLETED')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.bank_reconciliation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id UUID REFERENCES public.bank_reconciliations(id) ON DELETE CASCADE NOT NULL,
  txn_date DATE,
  description TEXT,
  reference TEXT,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,   -- signed: + inflow, - outflow
  matched BOOLEAN NOT NULL DEFAULT false,
  match_type TEXT NOT NULL DEFAULT 'NONE' CHECK (match_type IN ('NONE', 'CLIENT_PAYMENT', 'SUPPLIER_PAYMENT', 'EXPENSE', 'CHARGE', 'ADJUSTMENT')),
  matched_ref TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bank_recon_lines_recon ON public.bank_reconciliation_lines (reconciliation_id);

ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_reconciliation_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow auth read on bank_reconciliations" ON public.bank_reconciliations;
DROP POLICY IF EXISTS "Allow auth write on bank_reconciliations" ON public.bank_reconciliations;
DROP POLICY IF EXISTS "Allow auth read on bank_reconciliation_lines" ON public.bank_reconciliation_lines;
DROP POLICY IF EXISTS "Allow auth write on bank_reconciliation_lines" ON public.bank_reconciliation_lines;
CREATE POLICY "Allow auth read on bank_reconciliations" ON public.bank_reconciliations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on bank_reconciliations" ON public.bank_reconciliations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow auth read on bank_reconciliation_lines" ON public.bank_reconciliation_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on bank_reconciliation_lines" ON public.bank_reconciliation_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
