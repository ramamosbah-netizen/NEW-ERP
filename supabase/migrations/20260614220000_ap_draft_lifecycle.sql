-- ============================================================
-- JEET ERP — AP draft → validate lifecycle
--
-- An approved LPO (and every other spend) creates a DRAFT payable
-- ("action to spend money"). When the supplier's actual invoice is
-- uploaded and validated it becomes a registered bill. A revised bill
-- can be marked REVISED. A supplier proforma attached to the LPO is
-- auto-imported onto the draft.
-- ============================================================

-- DRAFT + REVISED statuses
ALTER TABLE public.supplier_invoices DROP CONSTRAINT IF EXISTS supplier_invoices_status_check;
ALTER TABLE public.supplier_invoices ADD CONSTRAINT supplier_invoices_status_check
  CHECK (status IN (
    'DRAFT', 'REGISTERED', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED',
    'PARTIALLY_PAID', 'PAID', 'DISPUTED', 'REVISED', 'CANCELLED'
  ));

-- Auto-imported supplier proforma (from the LPO)
ALTER TABLE public.supplier_invoices ADD COLUMN IF NOT EXISTS proforma_path TEXT;
ALTER TABLE public.supplier_invoices ADD COLUMN IF NOT EXISTS proforma_name TEXT;

-- Workforce / labour as an expense nature
ALTER TABLE public.supplier_invoices DROP CONSTRAINT IF EXISTS supplier_invoices_expense_category_check;
ALTER TABLE public.supplier_invoices ADD CONSTRAINT supplier_invoices_expense_category_check
  CHECK (expense_category IS NULL OR expense_category IN (
    'RENT', 'UTILITIES', 'SALARIES_PLACEHOLDER', 'FUEL', 'VEHICLE', 'MATERIAL',
    'TOOLS', 'TRANSPORT', 'MAINTENANCE', 'OFFICE_SUPPLIES', 'PETTY_CASH',
    'SUBCONTRACTOR', 'WORKFORCE', 'OTHER'
  ));

NOTIFY pgrst, 'reload schema';
