-- ============================================================
-- JEET ERP — Purchase Orders (LPO) & Goods Receipt (GRN) Schema
-- React 18 + TypeScript + Vite + Tailwind CSS + Supabase
-- ============================================================

-- Reset tables safely (order matters for FK dependencies)
-- This will automatically cascade-drop any triggers attached to them.
DROP TABLE IF EXISTS public.grn_returns CASCADE;
DROP TABLE IF EXISTS public.grn_items CASCADE;
DROP TABLE IF EXISTS public.grns CASCADE;
DROP TABLE IF EXISTS public.po_approvals CASCADE;
DROP TABLE IF EXISTS public.po_items CASCADE;
DROP TABLE IF EXISTS public.purchase_orders CASCADE;
DROP TABLE IF EXISTS public.po_number_sequences CASCADE;
DROP TABLE IF EXISTS public.grn_number_sequences CASCADE;

-- Reset functions
DROP FUNCTION IF EXISTS public.set_po_number() CASCADE;
DROP FUNCTION IF EXISTS public.set_grn_number() CASCADE;

-- ============================================================
-- 1. SEQUENCES & AUTO-INCREMENT TABLES
-- ============================================================

CREATE TABLE public.po_number_sequences (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE public.grn_number_sequences (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

-- RLS for sequences
ALTER TABLE public.po_number_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grn_number_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to po_number_sequences" ON public.po_number_sequences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write to po_number_sequences" ON public.po_number_sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read to grn_number_sequences" ON public.grn_number_sequences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write to grn_number_sequences" ON public.grn_number_sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 2. PURCHASE ORDERS TABLE
-- ============================================================
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT UNIQUE NOT NULL,
  revision_number INTEGER DEFAULT 0 NOT NULL,
  supersedes_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  is_latest BOOLEAN DEFAULT true NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('FROM_COMPARISON', 'MANUAL')),
  comparison_id UUID REFERENCES public.supplier_comparisons(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE RESTRICT, -- Null only for OVERHEAD
  po_type TEXT NOT NULL CHECK (po_type IN ('PROJECT_MATERIAL', 'SUBCONTRACT', 'SERVICES', 'CONSUMABLES', 'OVERHEAD')),
  
  supplier_id UUID REFERENCES public.pricing_suppliers(id) ON DELETE RESTRICT NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_trn TEXT,
  supplier_contact TEXT,
  supplier_email TEXT,
  supplier_phone TEXT,
  
  delivery_address TEXT,
  required_delivery_date DATE,
  promised_delivery_days INTEGER,
  payment_terms_days INTEGER DEFAULT 30 NOT NULL,
  payment_terms_text TEXT,
  
  currency TEXT DEFAULT 'AED' NOT NULL,
  exchange_rate NUMERIC(12,6) DEFAULT 1.000000 NOT NULL,
  
  subtotal NUMERIC(14,2) DEFAULT 0.00 NOT NULL,
  discount_amount NUMERIC(14,2) DEFAULT 0.00 NOT NULL,
  vat_amount NUMERIC(14,2) DEFAULT 0.00 NOT NULL,
  total NUMERIC(14,2) DEFAULT 0.00 NOT NULL,
  
  no_comparison_justification TEXT,
  terms_conditions TEXT,
  notes_to_supplier TEXT,
  internal_notes TEXT,
  
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CLOSED', 'CANCELLED', 'REVISED', 'SUPERSEDED'
  )),
  cancel_reason TEXT,
  closed_short_reason TEXT,
  
  sent_at TIMESTAMP WITH TIME ZONE,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  supplier_ack_reference TEXT,
  pdf_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  delivery_status TEXT NOT NULL DEFAULT 'NOT_DELIVERED' CHECK (delivery_status IN ('NOT_DELIVERED', 'PARTIAL', 'COMPLETE')),
  
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT check_overhead_project CHECK (
    (po_type = 'OVERHEAD' AND project_id IS NULL) OR 
    (po_type <> 'OVERHEAD' AND project_id IS NOT NULL)
  )
);

-- Enable RLS for PO
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to purchase_orders" ON public.purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write to purchase_orders" ON public.purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 3. PO ITEMS TABLE
-- ============================================================
CREATE TABLE public.po_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE NOT NULL,
  line_no INTEGER NOT NULL,
  comparison_item_id UUID REFERENCES public.comparison_items(id) ON DELETE SET NULL,
  pricing_item_id UUID REFERENCES public.pricing_items(id) ON DELETE SET NULL,
  item_code TEXT,
  description TEXT NOT NULL,
  brand TEXT,
  unit TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,4) NOT NULL CHECK (unit_price >= 0),
  discount_pct NUMERIC(5,2) DEFAULT 0.00 NOT NULL CHECK (discount_pct >= 0 AND discount_pct <= 100),
  vat_applicable BOOLEAN DEFAULT true NOT NULL,
  line_total NUMERIC(14,2) DEFAULT 0.00 NOT NULL,
  
  -- Receive progress
  qty_received NUMERIC(12,3) DEFAULT 0.000 NOT NULL CHECK (qty_received >= 0),
  qty_rejected NUMERIC(12,3) DEFAULT 0.000 NOT NULL CHECK (qty_rejected >= 0),
  receipt_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (receipt_status IN ('PENDING', 'PARTIAL', 'COMPLETE', 'CLOSED_SHORT')),
  
  system TEXT, -- ELV system code for cost division
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT unique_po_line UNIQUE (po_id, line_no)
);

-- Enable RLS for PO items
ALTER TABLE public.po_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to po_items" ON public.po_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write to po_items" ON public.po_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 4. PO APPROVAL LOG TABLE
-- ============================================================
CREATE TABLE public.po_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('COMMERCIAL', 'GM')),
  action TEXT NOT NULL CHECK (action IN ('APPROVED', 'REJECTED')),
  comment TEXT,
  approver_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for PO approvals
ALTER TABLE public.po_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to po_approvals" ON public.po_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write to po_approvals" ON public.po_approvals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 5. GOODS RECEIPT NOTE (GRN) TABLE
-- ============================================================
CREATE TABLE public.grns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_number TEXT UNIQUE NOT NULL,
  po_id UUID REFERENCES public.purchase_orders(id) ON DELETE RESTRICT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE RESTRICT, -- denormalized
  received_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  delivery_note_ref TEXT NOT NULL, -- Supplier's delivery note number
  delivery_note_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL, -- Photo of DN in DMS
  vehicle_no TEXT,
  driver_name TEXT,
  location TEXT NOT NULL DEFAULT 'SITE' CHECK (location IN ('SITE', 'STORE')),
  status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('DRAFT', 'RECEIVED', 'CANCELLED')),
  notes TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for GRN
ALTER TABLE public.grns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to grns" ON public.grns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write to grns" ON public.grns FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 6. GRN ITEMS TABLE
-- ============================================================
CREATE TABLE public.grn_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id UUID REFERENCES public.grns(id) ON DELETE CASCADE NOT NULL,
  po_item_id UUID REFERENCES public.po_items(id) ON DELETE RESTRICT NOT NULL,
  qty_received NUMERIC(12,3) NOT NULL CHECK (qty_received >= 0),
  qty_rejected NUMERIC(12,3) DEFAULT 0.000 NOT NULL CHECK (qty_rejected >= 0),
  rejection_reason TEXT CHECK (
    rejection_reason IS NULL OR 
    rejection_reason IN ('DAMAGED', 'WRONG_ITEM', 'WRONG_BRAND', 'SHORT_EXPIRY', 'SPEC_MISMATCH', 'OTHER')
  ),
  rejection_photos TEXT[] DEFAULT '{}', -- storage paths in Supabase Bucket
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for GRN items
ALTER TABLE public.grn_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to grn_items" ON public.grn_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write to grn_items" ON public.grn_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 7. GRN RETURNS TABLE
-- ============================================================
CREATE TABLE public.grn_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_item_id UUID REFERENCES public.grn_items(id) ON DELETE CASCADE NOT NULL,
  qty NUMERIC(12,3) NOT NULL CHECK (qty > 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_COLLECTION' CHECK (status IN (
    'PENDING_COLLECTION', 'COLLECTED', 'REPLACED', 'CREDITED'
  )),
  expected_resolution_date DATE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for GRN returns
ALTER TABLE public.grn_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to grn_returns" ON public.grn_returns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write to grn_returns" ON public.grn_returns FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 8. AUTONUMBERING TRIGGERS & FUNCTIONS
-- ============================================================

-- Function to set PO number: locks the sequence table, increments sequence for the current year
CREATE OR REPLACE FUNCTION public.set_po_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
  po_num_val TEXT;
BEGIN
  IF NEW.po_number IS NOT NULL AND NEW.po_number <> '' THEN
    RETURN NEW;
  END IF;

  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

  -- Share Row Exclusive Lock on the sequence table to prevent race conditions
  LOCK TABLE public.po_number_sequences IN SHARE ROW EXCLUSIVE MODE;

  INSERT INTO public.po_number_sequences (year, last_number)
  VALUES (current_year, 1)
  ON CONFLICT (year) DO UPDATE
  SET last_number = po_number_sequences.last_number + 1
  RETURNING last_number INTO next_number;

  NEW.po_number := 'JI-PO-' || current_year::TEXT || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_set_po_number
  BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_po_number();


-- Function to set GRN number: locks the sequence table, increments sequence for the current year
CREATE OR REPLACE FUNCTION public.set_grn_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
  grn_num_val TEXT;
BEGIN
  IF NEW.grn_number IS NOT NULL AND NEW.grn_number <> '' THEN
    RETURN NEW;
  END IF;

  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

  -- Share Row Exclusive Lock on the sequence table to prevent race conditions
  LOCK TABLE public.grn_number_sequences IN SHARE ROW EXCLUSIVE MODE;

  INSERT INTO public.grn_number_sequences (year, last_number)
  VALUES (current_year, 1)
  ON CONFLICT (year) DO UPDATE
  SET last_number = grn_number_sequences.last_number + 1
  RETURNING last_number INTO next_number;

  NEW.grn_number := 'JI-GRN-' || current_year::TEXT || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_set_grn_number
  BEFORE INSERT ON public.grns
  FOR EACH ROW
  EXECUTE FUNCTION public.set_grn_number();

-- ============================================================
-- 9. TAXONOMY SEEDING
-- ============================================================
INSERT INTO public.document_categories (category, subcategory, description_for_ai, sort_order)
VALUES ('COMMERCIAL', 'SUPPLIER_LPO', 'A Local Purchase Order (LPO) issued to a supplier for purchasing materials or services', 45)
ON CONFLICT (category, subcategory) DO NOTHING;
