-- ============================================================
-- JEET ERP — AP accounts/cards + full expense capture
--
-- Extends Accounts Payable so every payment — LPO purchases, non-LPO
-- purchases, car petrol, petty cash, office expenses — is captured as
-- a supplier bill that:
--   * is paid from a tracked card / bank / cash account (with balance),
--   * carries an invoice/receipt reference, and
--   * is bucketed to PROJECT (via LPO), PETTY_CASH (project-linked) or OFFICE.
-- ============================================================

-- 1. Payment accounts / cards (balances tracked)
CREATE TABLE IF NOT EXISTS public.payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'BANK' CHECK (type IN ('BANK', 'CARD', 'CASH', 'PETTY_CASH')),
  account_ref TEXT,                                   -- card last-4 / IBAN / cash float ref
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow auth read on payment_accounts" ON public.payment_accounts;
DROP POLICY IF EXISTS "Allow auth write on payment_accounts" ON public.payment_accounts;
CREATE POLICY "Allow auth read on payment_accounts" ON public.payment_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on payment_accounts" ON public.payment_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. supplier_invoices: support non-supplier expenses, cost bucketing and the paying account
ALTER TABLE public.supplier_invoices ALTER COLUMN supplier_id DROP NOT NULL;
ALTER TABLE public.supplier_invoices ADD COLUMN IF NOT EXISTS cost_bucket TEXT
  CHECK (cost_bucket IS NULL OR cost_bucket IN ('PROJECT', 'PETTY_CASH', 'OFFICE'));
ALTER TABLE public.supplier_invoices ADD COLUMN IF NOT EXISTS payment_account_id UUID
  REFERENCES public.payment_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.supplier_invoices ADD COLUMN IF NOT EXISTS payee_name TEXT;  -- for non-registered payees (petrol station, etc.)

-- Widen the expense nature list
ALTER TABLE public.supplier_invoices DROP CONSTRAINT IF EXISTS supplier_invoices_expense_category_check;
ALTER TABLE public.supplier_invoices ADD CONSTRAINT supplier_invoices_expense_category_check
  CHECK (expense_category IS NULL OR expense_category IN (
    'RENT', 'UTILITIES', 'SALARIES_PLACEHOLDER', 'FUEL', 'VEHICLE', 'MATERIAL',
    'TOOLS', 'TRANSPORT', 'MAINTENANCE', 'OFFICE_SUPPLIES', 'PETTY_CASH', 'SUBCONTRACTOR', 'OTHER'
  ));

-- 3. supplier_payments: which account the money left from
ALTER TABLE public.supplier_payments ADD COLUMN IF NOT EXISTS payment_account_id UUID
  REFERENCES public.payment_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_bucket ON public.supplier_invoices (cost_bucket);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_account ON public.supplier_invoices (payment_account_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_account ON public.supplier_payments (payment_account_id);

NOTIFY pgrst, 'reload schema';
