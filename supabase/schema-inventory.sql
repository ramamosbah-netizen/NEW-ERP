-- ============================================================
-- JEET ERP — Inventory / Stores & Tools Module Schema
-- ============================================================

-- Reset tables safely
DROP TABLE IF EXISTS public.tool_maintenance CASCADE;
DROP TABLE IF EXISTS public.tool_assignments CASCADE;
DROP TABLE IF EXISTS public.tools CASCADE;
DROP TABLE IF EXISTS public.stock_count_lines CASCADE;
DROP TABLE IF EXISTS public.stock_counts CASCADE;
DROP TABLE IF EXISTS public.mrf_items CASCADE;
DROP TABLE IF EXISTS public.material_requisitions CASCADE;
DROP TABLE IF EXISTS public.serial_units CASCADE;
DROP TABLE IF EXISTS public.stock_transactions CASCADE;
DROP TABLE IF EXISTS public.stock_balances CASCADE;
DROP TABLE IF EXISTS public.stock_items CASCADE;
DROP TABLE IF EXISTS public.stock_locations CASCADE;

DROP TABLE IF EXISTS public.stock_transaction_sequences CASCADE;
DROP TABLE IF EXISTS public.mrf_number_sequences CASCADE;
DROP TABLE IF EXISTS public.count_number_sequences CASCADE;
DROP TABLE IF EXISTS public.tool_number_sequences CASCADE;

-- Unified profiles role constraint alteration (run safely)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_profiles_role;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT check_profiles_role CHECK (role IN (
  'admin', 'manager', 'account', 'engineer', 'storekeeper', 'technician', 'coordinator', 'hr', 'gm', 'pm', 'commercial_mgr', 'procurement', 'site_eng'
));

-- ============================================================
-- 1. SEQUENCES & AUTO-INCREMENT SEQUENCES TABLES
-- ============================================================
CREATE TABLE public.stock_transaction_sequences (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.stock_transaction_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read/write on stock_transaction_sequences" ON public.stock_transaction_sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.mrf_number_sequences (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.mrf_number_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read/write on mrf_number_sequences" ON public.mrf_number_sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.count_number_sequences (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.count_number_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read/write on count_number_sequences" ON public.count_number_sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.tool_number_sequences (
  prefix TEXT PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.tool_number_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read/write on tool_number_sequences" ON public.tool_number_sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 2. STORES SCHEMA
-- ============================================================

-- Stock Locations (Main store, secondary stores, site sub-stores, vans)
CREATE TABLE public.stock_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('MAIN_STORE', 'SUB_STORE', 'PROJECT_SITE', 'VAN')),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  custodian_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  address TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.stock_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select on stock_locations for authenticated" ON public.stock_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write on stock_locations for storekeeper, procurement, admin" ON public.stock_locations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('storekeeper', 'procurement', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('storekeeper', 'procurement', 'admin')));

-- Stock Items (inventory properties of a pricing_item catalog entry)
CREATE TABLE public.stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_item_id UUID REFERENCES public.pricing_items(id) ON DELETE CASCADE UNIQUE NOT NULL,
  is_serialized BOOLEAN DEFAULT false NOT NULL,
  reorder_level NUMERIC(12,3),
  reorder_qty NUMERIC(12,3),
  preferred_supplier_id UUID REFERENCES public.pricing_suppliers(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select on stock_items for authenticated" ON public.stock_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write on stock_items for storekeeper, procurement, admin" ON public.stock_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('storekeeper', 'procurement', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('storekeeper', 'procurement', 'admin')));

-- Stock Balances (materialized balances per item x location)
CREATE TABLE public.stock_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id UUID REFERENCES public.stock_items(id) ON DELETE CASCADE NOT NULL,
  location_id UUID REFERENCES public.stock_locations(id) ON DELETE CASCADE NOT NULL,
  qty_on_hand NUMERIC(12,3) DEFAULT 0.000 NOT NULL CHECK (qty_on_hand >= 0),
  avg_unit_cost NUMERIC(12,4) DEFAULT 0.0000 NOT NULL CHECK (avg_unit_cost >= 0),
  qty_reserved NUMERIC(12,3) DEFAULT 0.000 NOT NULL CHECK (qty_reserved >= 0),
  qty_available NUMERIC(12,3) GENERATED ALWAYS AS (qty_on_hand - qty_reserved) STORED,
  last_movement_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (stock_item_id, location_id)
);

ALTER TABLE public.stock_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select on stock_balances for authenticated" ON public.stock_balances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write on stock_balances for storekeeper, procurement, admin" ON public.stock_balances FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('storekeeper', 'procurement', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('storekeeper', 'procurement', 'admin')));

-- Stock Transactions (Ledger - Immutable)
CREATE TABLE public.stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'GRN_RECEIPT', 'ISSUE_TO_PROJECT', 'ISSUE_TO_TICKET', 'RETURN_FROM_SITE', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'WRITE_OFF'
  )),
  stock_item_id UUID REFERENCES public.stock_items(id) ON DELETE RESTRICT NOT NULL,
  location_id UUID REFERENCES public.stock_locations(id) ON DELETE RESTRICT NOT NULL,
  qty NUMERIC(12,3) NOT NULL, -- signed quantity
  unit_cost NUMERIC(12,4) NOT NULL CHECK (unit_cost >= 0),
  total_value NUMERIC(14,4) NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('GRN', 'MRF', 'TICKET', 'VISIT', 'TRANSFER', 'COUNT', 'MANUAL')),
  source_id UUID,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  counterparty_location_id UUID REFERENCES public.stock_locations(id) ON DELETE SET NULL,
  reason TEXT,
  performed_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select on stock_transactions for authenticated" ON public.stock_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert on stock_transactions for storekeeper, procurement, admin" ON public.stock_transactions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('storekeeper', 'procurement', 'admin')));

-- Serial Units (for serialized tracking)
CREATE TABLE public.serial_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id UUID REFERENCES public.stock_items(id) ON DELETE CASCADE NOT NULL,
  serial_no TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('IN_STORE', 'ISSUED', 'INSTALLED', 'FAULTY', 'RETURNED')),
  current_location_id UUID REFERENCES public.stock_locations(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  grn_id UUID REFERENCES public.grns(id) ON DELETE SET NULL,
  installed_ticket_id UUID REFERENCES public.service_tickets(id) ON DELETE SET NULL,
  warranty_expiry DATE,
  notes TEXT,
  UNIQUE (stock_item_id, serial_no)
);

ALTER TABLE public.serial_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select on serial_units for authenticated" ON public.serial_units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write on serial_units for storekeeper, procurement, admin" ON public.serial_units FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('storekeeper', 'procurement', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('storekeeper', 'procurement', 'admin')));

-- ============================================================
-- 3. MATERIAL REQUISITIONS
-- ============================================================

CREATE TABLE public.material_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mrf_number TEXT UNIQUE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE RESTRICT NOT NULL,
  requested_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT NOT NULL,
  location_id UUID REFERENCES public.stock_locations(id) ON DELETE RESTRICT NOT NULL, -- source store
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_ISSUED', 'ISSUED', 'REJECTED')),
  needed_by DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.material_requisitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select on material_requisitions for authenticated" ON public.material_requisitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write on material_requisitions for own/authorized roles" ON public.material_requisitions FOR ALL TO authenticated
  USING (
    requested_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('storekeeper', 'procurement', 'pm', 'admin'))
  )
  WITH CHECK (
    requested_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('storekeeper', 'procurement', 'pm', 'admin'))
  );

CREATE TABLE public.mrf_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mrf_id UUID REFERENCES public.material_requisitions(id) ON DELETE CASCADE NOT NULL,
  stock_item_id UUID REFERENCES public.stock_items(id) ON DELETE RESTRICT NOT NULL,
  qty_requested NUMERIC(12,3) NOT NULL CHECK (qty_requested > 0),
  qty_approved NUMERIC(12,3) DEFAULT 0.000 NOT NULL CHECK (qty_approved >= 0),
  qty_issued NUMERIC(12,3) DEFAULT 0.000 NOT NULL CHECK (qty_issued >= 0),
  notes TEXT,
  CONSTRAINT check_issued_approved CHECK (qty_issued <= qty_approved),
  CONSTRAINT check_approved_requested CHECK (qty_approved <= qty_requested)
);

ALTER TABLE public.mrf_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select on mrf_items for authenticated" ON public.mrf_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write on mrf_items for authenticated" ON public.mrf_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 4. STOCK COUNT & RECONCILIATION
-- ============================================================

CREATE TABLE public.stock_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  count_number TEXT UNIQUE NOT NULL,
  location_id UUID REFERENCES public.stock_locations(id) ON DELETE RESTRICT NOT NULL,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'PENDING_REVIEW', 'POSTED', 'CANCELLED')),
  counted_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT NOT NULL,
  count_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.stock_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select on stock_counts for authenticated" ON public.stock_counts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write on stock_counts for storekeeper, procurement, admin" ON public.stock_counts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('storekeeper', 'procurement', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('storekeeper', 'procurement', 'admin')));

CREATE TABLE public.stock_count_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_count_id UUID REFERENCES public.stock_counts(id) ON DELETE CASCADE NOT NULL,
  stock_item_id UUID REFERENCES public.stock_items(id) ON DELETE RESTRICT NOT NULL,
  system_qty NUMERIC(12,3) NOT NULL,
  counted_qty NUMERIC(12,3) NOT NULL CHECK (counted_qty >= 0),
  variance NUMERIC(12,3) NOT NULL,
  variance_value NUMERIC(14,4) NOT NULL,
  recount_flag BOOLEAN DEFAULT false NOT NULL,
  UNIQUE (stock_count_id, stock_item_id)
);

ALTER TABLE public.stock_count_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select on stock_count_lines for authenticated" ON public.stock_count_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write on stock_count_lines for authenticated" ON public.stock_count_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 5. TOOLS & EQUIPMENT REGISTER SCHEMA
-- ============================================================

CREATE TABLE public.tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('TEST_INSTRUMENT', 'POWER_TOOL', 'HAND_TOOL', 'ACCESS_EQUIPMENT', 'SAFETY', 'IT_DEVICE')),
  brand_model TEXT,
  serial_no TEXT,
  purchase_date DATE,
  purchase_cost NUMERIC(12,2),
  supplier_id UUID REFERENCES public.pricing_suppliers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN (
    'AVAILABLE', 'ISSUED', 'UNDER_MAINTENANCE', 'UNDER_CALIBRATION', 'LOST', 'RETIRED'
  )),
  current_custodian_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  current_location_id UUID REFERENCES public.stock_locations(id) ON DELETE SET NULL,
  requires_calibration BOOLEAN DEFAULT false NOT NULL,
  calibration_interval_months INTEGER,
  last_calibration_date DATE,
  next_calibration_due DATE,
  calibration_cert_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  condition TEXT NOT NULL DEFAULT 'GOOD' CHECK (condition IN ('GOOD', 'FAIR', 'NEEDS_REPAIR')),
  photo_path TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select on tools for authenticated" ON public.tools FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write on tools for storekeeper, procurement, admin" ON public.tools FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('storekeeper', 'procurement', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('storekeeper', 'procurement', 'admin')));

CREATE TABLE public.tool_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID REFERENCES public.tools(id) ON DELETE CASCADE NOT NULL,
  issued_to UUID REFERENCES public.employees(id) ON DELETE RESTRICT NOT NULL,
  issued_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  issue_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  expected_return_date DATE,
  returned_date TIMESTAMP WITH TIME ZONE,
  issue_condition TEXT NOT NULL CHECK (issue_condition IN ('GOOD', 'FAIR', 'NEEDS_REPAIR')),
  return_condition TEXT CHECK (return_condition IN ('GOOD', 'FAIR', 'NEEDS_REPAIR')),
  issue_signature_path TEXT,
  notes TEXT
);

ALTER TABLE public.tool_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select on tool_assignments for authenticated" ON public.tool_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write on tool_assignments for storekeeper, procurement, pm, admin" ON public.tool_assignments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('storekeeper', 'procurement', 'pm', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('storekeeper', 'procurement', 'pm', 'admin')));

CREATE TABLE public.tool_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID REFERENCES public.tools(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('CALIBRATION', 'REPAIR', 'SERVICE')),
  performed_date DATE NOT NULL,
  vendor TEXT NOT NULL,
  cost NUMERIC(12,2) DEFAULT 0.00 NOT NULL CHECK (cost >= 0),
  certificate_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  next_due_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.tool_maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select on tool_maintenance for authenticated" ON public.tool_maintenance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write on tool_maintenance for storekeeper, procurement, admin" ON public.tool_maintenance FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('storekeeper', 'procurement', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('storekeeper', 'procurement', 'admin')));

-- ============================================================
-- 6. AUTONUMBERING TRIGGERS & FUNCTIONS
-- ============================================================

-- A. Stock Transactions
CREATE OR REPLACE FUNCTION public.set_stock_transaction_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
BEGIN
  IF NEW.transaction_number IS NOT NULL AND NEW.transaction_number <> '' THEN
    RETURN NEW;
  END IF;

  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  LOCK TABLE public.stock_transaction_sequences IN SHARE ROW EXCLUSIVE MODE;

  INSERT INTO public.stock_transaction_sequences (year, last_number)
  VALUES (current_year, 1)
  ON CONFLICT (year) DO UPDATE
  SET last_number = stock_transaction_sequences.last_number + 1
  RETURNING last_number INTO next_number;

  NEW.transaction_number := 'JI-STK-' || current_year::TEXT || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_set_stock_transaction_number
  BEFORE INSERT ON public.stock_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_stock_transaction_number();

-- B. Material Requisitions (MRF)
CREATE OR REPLACE FUNCTION public.set_mrf_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
BEGIN
  IF NEW.mrf_number IS NOT NULL AND NEW.mrf_number <> '' THEN
    RETURN NEW;
  END IF;

  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  LOCK TABLE public.mrf_number_sequences IN SHARE ROW EXCLUSIVE MODE;

  INSERT INTO public.mrf_number_sequences (year, last_number)
  VALUES (current_year, 1)
  ON CONFLICT (year) DO UPDATE
  SET last_number = mrf_number_sequences.last_number + 1
  RETURNING last_number INTO next_number;

  NEW.mrf_number := 'JI-MRF-' || current_year::TEXT || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_set_mrf_number
  BEFORE INSERT ON public.material_requisitions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_mrf_number();

-- C. Stock Counts
CREATE OR REPLACE FUNCTION public.set_count_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
BEGIN
  IF NEW.count_number IS NOT NULL AND NEW.count_number <> '' THEN
    RETURN NEW;
  END IF;

  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  LOCK TABLE public.count_number_sequences IN SHARE ROW EXCLUSIVE MODE;

  INSERT INTO public.count_number_sequences (year, last_number)
  VALUES (current_year, 1)
  ON CONFLICT (year) DO UPDATE
  SET last_number = count_number_sequences.last_number + 1
  RETURNING last_number INTO next_number;

  NEW.count_number := 'JI-CNT-' || current_year::TEXT || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_set_count_number
  BEFORE INSERT ON public.stock_counts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_count_number();

-- D. Tools
CREATE OR REPLACE FUNCTION public.set_tool_number()
RETURNS TRIGGER AS $$
DECLARE
  next_number INTEGER;
BEGIN
  IF NEW.tool_number IS NOT NULL AND NEW.tool_number <> '' THEN
    RETURN NEW;
  END IF;

  LOCK TABLE public.tool_number_sequences IN SHARE ROW EXCLUSIVE MODE;

  INSERT INTO public.tool_number_sequences (prefix, last_number)
  VALUES ('JI-TL', 1)
  ON CONFLICT (prefix) DO UPDATE
  SET last_number = tool_number_sequences.last_number + 1
  RETURNING last_number INTO next_number;

  NEW.tool_number := 'JI-TL-' || LPAD(next_number::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_set_tool_number
  BEFORE INSERT ON public.tools
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tool_number();

-- ============================================================
-- 7. ATOMIC WEIGHTED AVERAGE COST & BALANCE MANAGEMENT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_stock_balances_on_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_cur_qty NUMERIC(12,3);
  v_cur_cost NUMERIC(12,4);
  v_cur_reserved NUMERIC(12,3);
  
  v_new_cost NUMERIC(12,4);
  v_new_qty NUMERIC(12,3);
  v_found BOOLEAN := false;
BEGIN
  -- 1. Select the current balance for locking
  SELECT qty_on_hand, avg_unit_cost, qty_reserved
  INTO v_cur_qty, v_cur_cost, v_cur_reserved
  FROM public.stock_balances
  WHERE stock_item_id = NEW.stock_item_id AND location_id = NEW.location_id
  FOR UPDATE;
  
  IF FOUND THEN
    v_found := true;
  ELSE
    v_cur_qty := 0.000;
    v_cur_cost := 0.0000;
    v_cur_reserved := 0.000;
  END IF;

  v_new_qty := v_cur_qty + NEW.qty;

  -- Verify physical stock guard (stock can never drop below 0 on hand)
  IF v_new_qty < 0 THEN
    RAISE EXCEPTION 'Physical stock cost guard: Transaction causes quantity on hand to go negative (%) for stock item % at location %.', 
      v_new_qty, NEW.stock_item_id, NEW.location_id;
  END IF;

  -- 2. Determine if average cost needs to be recomputed
  -- WAC recomputes on: GRN_RECEIPT, TRANSFER_IN, and ADJUSTMENT_IN (if positive and cost supplied)
  IF NEW.qty > 0 AND NEW.type IN ('GRN_RECEIPT', 'TRANSFER_IN', 'ADJUSTMENT_IN') AND NEW.unit_cost > 0 THEN
    IF (v_cur_qty + NEW.qty) > 0 THEN
      v_new_cost := ROUND(((v_cur_qty * v_cur_cost) + (NEW.qty * NEW.unit_cost)) / (v_cur_qty + NEW.qty), 4);
    ELSE
      v_new_cost := NEW.unit_cost;
    END IF;
  ELSE
    v_new_cost := v_cur_cost;
  END IF;

  -- 3. Perform Insert or Update
  IF v_found THEN
    UPDATE public.stock_balances
    SET 
      qty_on_hand = v_new_qty,
      avg_unit_cost = v_new_cost,
      last_movement_at = NEW.created_at
    WHERE stock_item_id = NEW.stock_item_id AND location_id = NEW.location_id;
  ELSE
    INSERT INTO public.stock_balances (
      stock_item_id,
      location_id,
      qty_on_hand,
      avg_unit_cost,
      qty_reserved,
      last_movement_at
    ) VALUES (
      NEW.stock_item_id,
      NEW.location_id,
      v_new_qty,
      v_new_cost,
      0.000,
      NEW.created_at
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_stock_balances_on_transaction
  AFTER INSERT ON public.stock_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stock_balances_on_transaction();

-- ============================================================
-- 8. INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX idx_stock_bal_item ON public.stock_balances(stock_item_id);
CREATE INDEX idx_stock_bal_loc ON public.stock_balances(location_id);
CREATE INDEX idx_stock_tx_item ON public.stock_transactions(stock_item_id);
CREATE INDEX idx_stock_tx_loc ON public.stock_transactions(location_id);
CREATE INDEX idx_stock_tx_proj ON public.stock_transactions(project_id);
CREATE INDEX idx_serial_item ON public.serial_units(stock_item_id);
CREATE INDEX idx_serial_loc ON public.serial_units(current_location_id);
CREATE INDEX idx_mrf_proj ON public.material_requisitions(project_id);
CREATE INDEX idx_mrf_items_mrf ON public.mrf_items(mrf_id);
CREATE INDEX idx_tools_status ON public.tools(status);
CREATE INDEX idx_tools_custodian ON public.tools(current_custodian_id);
CREATE INDEX idx_tools_cal_due ON public.tools(next_calibration_due);
CREATE INDEX idx_tool_assign_tool ON public.tool_assignments(tool_id);
CREATE INDEX idx_tool_maint_tool ON public.tool_maintenance(tool_id);
