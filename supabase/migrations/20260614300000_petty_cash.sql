-- ============================================================
-- JEET ERP — Finance: Petty Cash (Page 8)
-- Petty-cash funds (floats) and their transactions: expense claims,
-- replenishments and returns, with approval. Balance is computed
-- live from approved transactions.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.petty_cash_funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  custodian_name TEXT,
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  low_threshold NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.petty_cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID REFERENCES public.petty_cash_funds(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('EXPENSE', 'REPLENISH', 'RETURN')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  category TEXT,
  description TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  txn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  receipt_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_petty_txn_fund ON public.petty_cash_transactions (fund_id);
CREATE INDEX IF NOT EXISTS idx_petty_txn_status ON public.petty_cash_transactions (status);

ALTER TABLE public.petty_cash_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petty_cash_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow auth read on petty_cash_funds" ON public.petty_cash_funds;
DROP POLICY IF EXISTS "Allow auth write on petty_cash_funds" ON public.petty_cash_funds;
DROP POLICY IF EXISTS "Allow auth read on petty_cash_transactions" ON public.petty_cash_transactions;
DROP POLICY IF EXISTS "Allow auth write on petty_cash_transactions" ON public.petty_cash_transactions;
CREATE POLICY "Allow auth read on petty_cash_funds" ON public.petty_cash_funds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on petty_cash_funds" ON public.petty_cash_funds FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow auth read on petty_cash_transactions" ON public.petty_cash_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on petty_cash_transactions" ON public.petty_cash_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
