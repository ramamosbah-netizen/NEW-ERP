-- ============================================================
-- JEET ERP — Finance Operations Layer Schema
-- Handles: Client Invoices, Payments, Allocations, Credit Notes,
-- Retention, Supplier Invoices (AP), Matching & VAT Periods.
-- ============================================================

-- Reset tables safely
DROP TABLE IF EXISTS public.supplier_payment_allocations CASCADE;
DROP TABLE IF EXISTS public.supplier_payments CASCADE;
DROP TABLE IF EXISTS public.supplier_invoice_items CASCADE;
DROP TABLE IF EXISTS public.supplier_invoices CASCADE;
DROP TABLE IF EXISTS public.project_retention_ledger CASCADE;
DROP TABLE IF EXISTS public.credit_notes CASCADE;
DROP TABLE IF EXISTS public.payment_allocations CASCADE;
DROP TABLE IF EXISTS public.client_payments CASCADE;
DROP TABLE IF EXISTS public.client_invoice_items CASCADE;
DROP TABLE IF EXISTS public.client_invoices CASCADE;
DROP TABLE IF EXISTS public.vat_periods CASCADE;

DROP TABLE IF EXISTS public.client_invoice_sequences CASCADE;
DROP TABLE IF EXISTS public.client_payment_sequences CASCADE;
DROP TABLE IF EXISTS public.credit_note_sequences CASCADE;
DROP TABLE IF EXISTS public.supplier_invoice_sequences CASCADE;
DROP TABLE IF EXISTS public.supplier_payment_sequences CASCADE;

-- ============================================================
-- 1. AUTO-NUMBERING SEQUENCES
-- ============================================================

CREATE TABLE public.client_invoice_sequences (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE public.client_payment_sequences (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE public.credit_note_sequences (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE public.supplier_invoice_sequences (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE public.supplier_payment_sequences (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.client_invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_payment_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_note_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payment_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow auth read on client_invoice_sequences" ON public.client_invoice_sequences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on client_invoice_sequences" ON public.client_invoice_sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow auth read on client_payment_sequences" ON public.client_payment_sequences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on client_payment_sequences" ON public.client_payment_sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow auth read on credit_note_sequences" ON public.credit_note_sequences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on credit_note_sequences" ON public.credit_note_sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow auth read on supplier_invoice_sequences" ON public.supplier_invoice_sequences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on supplier_invoice_sequences" ON public.supplier_invoice_sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow auth read on supplier_payment_sequences" ON public.supplier_payment_sequences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on supplier_payment_sequences" ON public.supplier_payment_sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 2. VAT PERIODS
-- ============================================================

CREATE TABLE public.vat_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- e.g. '2026-Q1', '2026-M06'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  filing_deadline DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'LOCKED')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  locked_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  locked_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.vat_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on vat_periods" ON public.vat_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on vat_periods" ON public.vat_periods FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 3. CLIENT INVOICES (AR)
-- ============================================================

CREATE TABLE public.client_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE RESTRICT, -- Null for standalone billing
  client_id UUID REFERENCES public.clients(id) ON DELETE RESTRICT NOT NULL,
  
  -- Snapshots for audit integrity
  client_name TEXT NOT NULL,
  client_trn TEXT,
  client_address TEXT,
  
  invoice_type TEXT NOT NULL CHECK (invoice_type IN ('ADVANCE', 'PROGRESS', 'FINAL', 'RETENTION_RELEASE', 'STANDALONE')),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'WRITTEN_OFF'
  )),
  
  invoice_date DATE NOT NULL,
  supply_date DATE NOT NULL,
  due_date DATE NOT NULL,
  
  period_from DATE,
  period_to DATE,
  
  -- Contract Math Metrics
  gross_claim NUMERIC(14,2) DEFAULT 0.00 NOT NULL,
  advance_recovery NUMERIC(14,2) DEFAULT 0.00 NOT NULL,
  retention_held NUMERIC(14,2) DEFAULT 0.00 NOT NULL,
  
  taxable_amount NUMERIC(14,2) DEFAULT 0.00 NOT NULL,
  vat_amount NUMERIC(14,2) DEFAULT 0.00 NOT NULL,
  total_incl_vat NUMERIC(14,2) DEFAULT 0.00 NOT NULL,
  net_due NUMERIC(14,2) DEFAULT 0.00 NOT NULL,
  amount_paid NUMERIC(14,2) DEFAULT 0.00 NOT NULL,
  
  -- Certified reference (for consultant approval projects)
  payment_application_id UUID, -- Placeholder FK (App router cert)
  certified_amount NUMERIC(14,2),
  
  pdf_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  write_off_reason TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  created_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.client_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on client_invoices" ON public.client_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on client_invoices" ON public.client_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 4. CLIENT INVOICE ITEMS
-- ============================================================

CREATE TABLE public.client_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.client_invoices(id) ON DELETE CASCADE NOT NULL,
  line_no INTEGER NOT NULL,
  description TEXT NOT NULL,
  milestone_id UUID REFERENCES public.project_milestones(id) ON DELETE SET NULL,
  boq_reference TEXT,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity >= 0),
  unit TEXT NOT NULL,
  unit_price NUMERIC(14,4) NOT NULL CHECK (unit_price >= 0),
  taxable_amount NUMERIC(14,2) NOT NULL,
  vat_rate NUMERIC(5,2) DEFAULT 5.00 NOT NULL CHECK (vat_rate IN (5.00, 0.00)),
  vat_amount NUMERIC(14,2) NOT NULL,
  line_total NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT unique_client_invoice_line UNIQUE (invoice_id, line_no)
);

ALTER TABLE public.client_invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on client_invoice_items" ON public.client_invoice_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on client_invoice_items" ON public.client_invoice_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 5. CLIENT PAYMENTS (Receipts)
-- ============================================================

CREATE TABLE public.client_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number TEXT UNIQUE NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE RESTRICT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('TRANSFER', 'CHEQUE', 'CASH', 'CARD')),
  reference TEXT, -- Transfer code or cheque number
  bank_account TEXT, -- Destination ledger account
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.client_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on client_payments" ON public.client_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on client_payments" ON public.client_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 6. PAYMENT ALLOCATIONS (Allocation details)
-- ============================================================

CREATE TABLE public.payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.client_payments(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES public.client_invoices(id) ON DELETE CASCADE NOT NULL,
  allocated_amount NUMERIC(14,2) NOT NULL CHECK (allocated_amount > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT unique_allocation UNIQUE (payment_id, invoice_id)
);

ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on payment_allocations" ON public.payment_allocations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on payment_allocations" ON public.payment_allocations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 7. CREDIT NOTES (Client return matching)
-- ============================================================

CREATE TABLE public.credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number TEXT UNIQUE NOT NULL,
  original_invoice_id UUID REFERENCES public.client_invoices(id) ON DELETE RESTRICT NOT NULL,
  reason TEXT NOT NULL,
  taxable_amount NUMERIC(14,2) NOT NULL,
  vat_amount NUMERIC(14,2) NOT NULL,
  total NUMERIC(14,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('DRAFT', 'APPROVED', 'CANCELLED')),
  pdf_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on credit_notes" ON public.credit_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on credit_notes" ON public.credit_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 8. PROJECT RETENTION LEDGER
-- ============================================================

CREATE TABLE public.project_retention_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES public.client_invoices(id) ON DELETE CASCADE NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('HELD', 'RELEASED')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  expected_release_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.project_retention_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on project_retention_ledger" ON public.project_retention_ledger FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on project_retention_ledger" ON public.project_retention_ledger FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 9. SUPPLIER INVOICES (AP)
-- ============================================================

CREATE TABLE public.supplier_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_ref TEXT UNIQUE NOT NULL,
  supplier_id UUID REFERENCES public.pricing_suppliers(id) ON DELETE RESTRICT NOT NULL,
  supplier_invoice_number TEXT NOT NULL,
  po_id UUID REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
  project_id UUID REFERENCES public.projects(id) ON DELETE RESTRICT, -- Denormalized for P&L query
  
  invoice_type TEXT NOT NULL CHECK (invoice_type IN ('PO_MATCHED', 'DIRECT_EXPENSE')),
  invoice_date DATE NOT NULL,
  received_date DATE NOT NULL,
  due_date DATE NOT NULL,
  
  taxable_amount NUMERIC(14,2) NOT NULL,
  vat_amount NUMERIC(14,2) NOT NULL,
  total NUMERIC(14,2) NOT NULL,
  
  -- Three-way match audits
  match_status TEXT NOT NULL DEFAULT 'NA' CHECK (match_status IN ('MATCHED', 'EXCEPTION', 'OVERRIDDEN', 'NA')),
  match_results JSONB DEFAULT '{}'::JSONB NOT NULL,
  override_reason TEXT,
  override_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  
  status TEXT NOT NULL DEFAULT 'REGISTERED' CHECK (status IN (
    'REGISTERED', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'PARTIALLY_PAID', 'PAID', 'DISPUTED', 'CANCELLED'
  )),
  
  amount_paid NUMERIC(14,2) DEFAULT 0.00 NOT NULL,
  source_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL, -- PDF attachment in DMS
  expense_category TEXT CHECK (
    expense_category IS NULL OR 
    expense_category IN ('RENT', 'UTILITIES', 'SALARIES_PLACEHOLDER', 'FUEL', 'OTHER')
  ),
  notes TEXT,
  
  created_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Duplicate prevention
  CONSTRAINT unique_supplier_invoice_num UNIQUE (supplier_id, supplier_invoice_number)
);

ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on supplier_invoices" ON public.supplier_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on supplier_invoices" ON public.supplier_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 10. SUPPLIER INVOICE ITEMS
-- ============================================================

CREATE TABLE public.supplier_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_invoice_id UUID REFERENCES public.supplier_invoices(id) ON DELETE CASCADE NOT NULL,
  po_item_id UUID REFERENCES public.po_items(id) ON DELETE RESTRICT, -- Null for direct expenses
  description TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity >= 0),
  unit_price NUMERIC(14,4) NOT NULL CHECK (unit_price >= 0),
  taxable_amount NUMERIC(14,2) NOT NULL,
  vat_rate NUMERIC(5,2) DEFAULT 5.00 NOT NULL,
  vat_amount NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.supplier_invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on supplier_invoice_items" ON public.supplier_invoice_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on supplier_invoice_items" ON public.supplier_invoice_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 11. SUPPLIER PAYMENTS (Outgoing disbursements)
-- ============================================================

CREATE TABLE public.supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number TEXT UNIQUE NOT NULL,
  supplier_id UUID REFERENCES public.pricing_suppliers(id) ON DELETE RESTRICT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('TRANSFER', 'CHEQUE', 'CASH', 'CARD')),
  reference TEXT,
  bank_account TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on supplier_payments" ON public.supplier_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on supplier_payments" ON public.supplier_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 12. SUPPLIER PAYMENT ALLOCATIONS
-- ============================================================

CREATE TABLE public.supplier_payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.supplier_payments(id) ON DELETE CASCADE NOT NULL,
  supplier_invoice_id UUID REFERENCES public.supplier_invoices(id) ON DELETE CASCADE NOT NULL,
  allocated_amount NUMERIC(14,2) NOT NULL CHECK (allocated_amount > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT unique_supplier_allocation UNIQUE (payment_id, supplier_invoice_id)
);

ALTER TABLE public.supplier_payment_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on supplier_payment_allocations" ON public.supplier_payment_allocations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on supplier_payment_allocations" ON public.supplier_payment_allocations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 13. AUTONUMBERING TRIGGERS & FUNCTIONS
-- ============================================================

-- Client Invoice trigger
CREATE OR REPLACE FUNCTION public.set_client_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
BEGIN
  IF NEW.invoice_number IS NOT NULL AND NEW.invoice_number <> '' THEN
    RETURN NEW;
  END IF;

  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  LOCK TABLE public.client_invoice_sequences IN SHARE ROW EXCLUSIVE MODE;

  INSERT INTO public.client_invoice_sequences (year, last_number)
  VALUES (current_year, 1)
  ON CONFLICT (year) DO UPDATE
  SET last_number = client_invoice_sequences.last_number + 1
  RETURNING last_number INTO next_number;

  NEW.invoice_number := 'JI-INV-' || current_year::TEXT || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_set_client_invoice_number
  BEFORE INSERT ON public.client_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_client_invoice_number();

-- Client Payment trigger
CREATE OR REPLACE FUNCTION public.set_client_payment_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
BEGIN
  IF NEW.payment_number IS NOT NULL AND NEW.payment_number <> '' THEN
    RETURN NEW;
  END IF;

  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  LOCK TABLE public.client_payment_sequences IN SHARE ROW EXCLUSIVE MODE;

  INSERT INTO public.client_payment_sequences (year, last_number)
  VALUES (current_year, 1)
  ON CONFLICT (year) DO UPDATE
  SET last_number = client_payment_sequences.last_number + 1
  RETURNING last_number INTO next_number;

  NEW.payment_number := 'JI-RCT-' || current_year::TEXT || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_set_client_payment_number
  BEFORE INSERT ON public.client_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_client_payment_number();

-- Credit Note trigger
CREATE OR REPLACE FUNCTION public.set_credit_note_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
BEGIN
  IF NEW.credit_note_number IS NOT NULL AND NEW.credit_note_number <> '' THEN
    RETURN NEW;
  END IF;

  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  LOCK TABLE public.credit_note_sequences IN SHARE ROW EXCLUSIVE MODE;

  INSERT INTO public.credit_note_sequences (year, last_number)
  VALUES (current_year, 1)
  ON CONFLICT (year) DO UPDATE
  SET last_number = credit_note_sequences.last_number + 1
  RETURNING last_number INTO next_number;

  NEW.credit_note_number := 'JI-CN-' || current_year::TEXT || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_set_credit_note_number
  BEFORE INSERT ON public.credit_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_credit_note_number();

-- Supplier Invoice trigger
CREATE OR REPLACE FUNCTION public.set_supplier_invoice_ref()
RETURNS TRIGGER AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
BEGIN
  IF NEW.internal_ref IS NOT NULL AND NEW.internal_ref <> '' THEN
    RETURN NEW;
  END IF;

  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  LOCK TABLE public.supplier_invoice_sequences IN SHARE ROW EXCLUSIVE MODE;

  INSERT INTO public.supplier_invoice_sequences (year, last_number)
  VALUES (current_year, 1)
  ON CONFLICT (year) DO UPDATE
  SET last_number = supplier_invoice_sequences.last_number + 1
  RETURNING last_number INTO next_number;

  NEW.internal_ref := 'JI-SINV-' || current_year::TEXT || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_set_supplier_invoice_ref
  BEFORE INSERT ON public.supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_supplier_invoice_ref();

-- Supplier Payment trigger
CREATE OR REPLACE FUNCTION public.set_supplier_payment_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
BEGIN
  IF NEW.payment_number IS NOT NULL AND NEW.payment_number <> '' THEN
    RETURN NEW;
  END IF;

  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  LOCK TABLE public.supplier_payment_sequences IN SHARE ROW EXCLUSIVE MODE;

  INSERT INTO public.supplier_payment_sequences (year, last_number)
  VALUES (current_year, 1)
  ON CONFLICT (year) DO UPDATE
  SET last_number = supplier_payment_sequences.last_number + 1
  RETURNING last_number INTO next_number;

  NEW.payment_number := 'JI-SPAY-' || current_year::TEXT || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_set_supplier_payment_number
  BEFORE INSERT ON public.supplier_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_supplier_payment_number();

-- ============================================================
-- 14. SCHEMA INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX idx_client_invoices_project ON public.client_invoices (project_id);
CREATE INDEX idx_client_invoices_client ON public.client_invoices (client_id);
CREATE INDEX idx_client_invoices_status ON public.client_invoices (status);
CREATE INDEX idx_client_invoices_date ON public.client_invoices (invoice_date);
CREATE INDEX idx_client_invoices_due ON public.client_invoices (due_date);

CREATE INDEX idx_client_payments_client ON public.client_payments (client_id);
CREATE INDEX idx_client_payments_date ON public.client_payments (payment_date);

CREATE INDEX idx_payment_allocations_inv ON public.payment_allocations (invoice_id);
CREATE INDEX idx_payment_allocations_pay ON public.payment_allocations (payment_id);

CREATE INDEX idx_supplier_invoices_po ON public.supplier_invoices (po_id);
CREATE INDEX idx_supplier_invoices_supplier ON public.supplier_invoices (supplier_id);
CREATE INDEX idx_supplier_invoices_status ON public.supplier_invoices (status);
CREATE INDEX idx_supplier_invoices_due ON public.supplier_invoices (due_date);
CREATE INDEX idx_supplier_invoices_project ON public.supplier_invoices (project_id);

CREATE INDEX idx_supplier_payments_supplier ON public.supplier_payments (supplier_id);
CREATE INDEX idx_supplier_payments_date ON public.supplier_payments (payment_date);

CREATE INDEX idx_supplier_payment_allocations_inv ON public.supplier_payment_allocations (supplier_invoice_id);
CREATE INDEX idx_supplier_payment_allocations_pay ON public.supplier_payment_allocations (payment_id);
