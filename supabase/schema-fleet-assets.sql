-- ============================================================
-- JEET ERP — Fleet Management & Fixed Asset Register Schema
-- ============================================================

-- Reset tables safely (dependencies order: disposals/schedules/fines/logs/maintenance/assignments depend on assets/vehicles)
DROP TABLE IF EXISTS public.asset_disposals CASCADE;
DROP TABLE IF EXISTS public.depreciation_schedule CASCADE;
DROP TABLE IF EXISTS public.vehicle_maintenance CASCADE;
DROP TABLE IF EXISTS public.fuel_logs CASCADE;
DROP TABLE IF EXISTS public.vehicle_fines CASCADE;
DROP TABLE IF EXISTS public.vehicle_assignments CASCADE;
DROP TABLE IF EXISTS public.fixed_assets CASCADE;
DROP TABLE IF EXISTS public.vehicles CASCADE;

DROP TABLE IF EXISTS public.vehicle_number_sequences CASCADE;
DROP TABLE IF EXISTS public.asset_number_sequences CASCADE;

-- Unified profiles role constraint alteration (include 'fleet_coordinator' and other existing roles)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_profiles_role;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT check_profiles_role CHECK (role IN (
  'admin', 'manager', 'account', 'engineer', 'storekeeper', 'technician', 'coordinator', 'fleet_coordinator', 'hr', 'gm', 'pm', 'commercial_mgr', 'procurement', 'site_eng'
));

-- Document Entity Type check constraint update to include 'VEHICLE' and 'ASSET'
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_entity_type_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_entity_type_check CHECK (entity_type IN ('PROJECT', 'CLIENT', 'SUPPLIER', 'COMPANY', 'AMC', 'EMPLOYEE', 'VEHICLE', 'ASSET'));

-- ============================================================
-- 1. SEQUENCES & AUTO-INCREMENT TABLES
-- ============================================================

CREATE TABLE public.vehicle_number_sequences (
  prefix TEXT PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.vehicle_number_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read/write on vehicle_number_sequences" ON public.vehicle_number_sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.asset_number_sequences (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.asset_number_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read/write on asset_number_sequences" ON public.asset_number_sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 2. VEHICLES SCHEMA
-- ============================================================

CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_code TEXT UNIQUE NOT NULL, -- Format: JI-VEH-NNN
  plate_number TEXT NOT NULL, -- e.g. "Dubai A 12345"
  plate_emirate TEXT NOT NULL CHECK (plate_emirate IN ('DUBAI', 'ABU_DHABI', 'SHARJAH', 'AJMAN', 'UMM_AL_QUWAIN', 'RAS_AL_KHAIMAH', 'FUJAIRAH')),
  plate_category TEXT, -- nullable, code/colour class (e.g. Private / Commercial)
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('PICKUP', 'VAN', 'CAR', 'TRUCK', 'BUS', 'LIFT_MACHINE')),
  chassis_no TEXT NOT NULL UNIQUE,
  engine_no TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  seating_capacity INTEGER,
  ownership TEXT NOT NULL CHECK (ownership IN ('OWNED', 'LEASED', 'RENTED')),
  purchase_date DATE,
  purchase_cost NUMERIC(12,2),
  fixed_asset_id UUID, -- FK to fixed_assets, added via ALTER TABLE later to avoid circular references
  assigned_driver_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  assigned_department TEXT,
  home_location TEXT,
  registration_expiry DATE NOT NULL, -- Mulkiya renewal date
  insurance_expiry DATE NOT NULL,
  insurance_company TEXT NOT NULL,
  insurance_policy_no TEXT NOT NULL,
  salik_tag_number TEXT,
  salik_account TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'IN_WORKSHOP', 'OFF_ROAD', 'SOLD', 'DISPOSED')),
  odometer_km INTEGER NOT NULL DEFAULT 0 CHECK (odometer_km >= 0),
  notes TEXT,
  photo_path TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select on vehicles for authenticated" ON public.vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write on vehicles for fleet_coordinator, gm, admin" ON public.vehicles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('fleet_coordinator', 'gm', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('fleet_coordinator', 'gm', 'admin')));

-- ============================================================
-- 3. VEHICLE ASSIGNMENTS (DRIVER CUSTODY)
-- ============================================================

CREATE TABLE public.vehicle_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES public.employees(id) ON DELETE RESTRICT NOT NULL,
  from_date TIMESTAMP WITH TIME ZONE NOT NULL,
  to_date TIMESTAMP WITH TIME ZONE, -- nullable until handed back
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  purpose TEXT NOT NULL,
  handover_odometer INTEGER NOT NULL CHECK (handover_odometer >= 0),
  return_odometer INTEGER CHECK (return_odometer IS NULL OR return_odometer >= handover_odometer),
  condition_notes TEXT,
  signature_path TEXT, -- driver handover signature URL
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.vehicle_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select on vehicle_assignments for authenticated" ON public.vehicle_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write on vehicle_assignments for fleet_coordinator, gm, admin" ON public.vehicle_assignments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('fleet_coordinator', 'gm', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('fleet_coordinator', 'gm', 'admin')));

-- ============================================================
-- 4. FIXED ASSETS REGISTER
-- ============================================================

CREATE TABLE public.fixed_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_number TEXT UNIQUE NOT NULL, -- JI-FA-YYYY-NNN
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('VEHICLE', 'IT_EQUIPMENT', 'TOOLS_INSTRUMENTS', 'OFFICE_FURNITURE', 'SITE_EQUIPMENT', 'SOFTWARE', 'OTHER')),
  description TEXT,
  acquisition_date DATE NOT NULL,
  acquisition_cost NUMERIC(14,2) NOT NULL CHECK (acquisition_cost > 0),
  supplier_id UUID REFERENCES public.pricing_suppliers(id) ON DELETE SET NULL,
  source_po_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  source_invoice_id UUID REFERENCES public.supplier_invoices(id) ON DELETE SET NULL,
  salvage_value NUMERIC(14,2) DEFAULT 0.00 NOT NULL CHECK (salvage_value >= 0 AND salvage_value <= acquisition_cost),
  useful_life_months INTEGER NOT NULL CHECK (useful_life_months > 0),
  depreciation_method TEXT NOT NULL DEFAULT 'STRAIGHT_LINE' CHECK (depreciation_method = 'STRAIGHT_LINE'),
  accumulated_depreciation NUMERIC(14,2) DEFAULT 0.00 NOT NULL CHECK (accumulated_depreciation >= 0 AND accumulated_depreciation <= acquisition_cost),
  net_book_value NUMERIC(14,2) NOT NULL CHECK (net_book_value >= 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FULLY_DEPRECIATED', 'DISPOSED', 'WRITTEN_OFF')),
  custodian_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  location TEXT,
  linked_vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  linked_tool_id UUID REFERENCES public.tools(id) ON DELETE SET NULL,
  disposal_date DATE,
  disposal_proceeds NUMERIC(14,2) CHECK (disposal_proceeds >= 0),
  disposal_method TEXT CHECK (disposal_method IN ('SALE', 'SCRAP', 'TRADE_IN', 'LOST')),
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL, -- purchase doc DMS link
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select on fixed_assets for authenticated" ON public.fixed_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write on fixed_assets for accountant, fleet_coordinator, gm, admin" ON public.fixed_assets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('account', 'fleet_coordinator', 'gm', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('account', 'fleet_coordinator', 'gm', 'admin')));

-- Now link vehicles to fixed_assets with constraint
ALTER TABLE public.vehicles ADD CONSTRAINT fk_vehicles_fixed_asset FOREIGN KEY (fixed_asset_id) REFERENCES public.fixed_assets(id) ON DELETE SET NULL;

-- ============================================================
-- 5. DEPRECIATION SCHEDULE (LEDGER ROWS PER PERIOD)
-- ============================================================

CREATE TABLE public.depreciation_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES public.fixed_assets(id) ON DELETE CASCADE NOT NULL,
  period_month DATE NOT NULL, -- Date representing the month (first day of month, e.g. 2026-06-01)
  opening_nbv NUMERIC(14,2) NOT NULL CHECK (opening_nbv >= 0),
  depreciation_amount NUMERIC(14,2) NOT NULL CHECK (depreciation_amount >= 0),
  closing_nbv NUMERIC(14,2) NOT NULL CHECK (closing_nbv >= 0),
  accumulated NUMERIC(14,2) NOT NULL CHECK (accumulated >= 0),
  posted BOOLEAN DEFAULT false NOT NULL, -- Locked once exported to accounting
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(asset_id, period_month)
);

ALTER TABLE public.depreciation_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select on depreciation_schedule for authenticated" ON public.depreciation_schedule FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write on depreciation_schedule for accountant, gm, admin" ON public.depreciation_schedule FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('account', 'gm', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('account', 'gm', 'admin')));

-- ============================================================
-- 6. ASSET DISPOSALS RECORD
-- ============================================================

CREATE TABLE public.asset_disposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES public.fixed_assets(id) ON DELETE CASCADE NOT NULL,
  disposal_date DATE NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('SALE', 'SCRAP', 'TRADE_IN', 'LOST')),
  proceeds NUMERIC(14,2) DEFAULT 0.00 NOT NULL CHECK (proceeds >= 0),
  nbv_at_disposal NUMERIC(14,2) NOT NULL CHECK (nbv_at_disposal >= 0),
  gain_loss NUMERIC(14,2) NOT NULL, -- proceeds - nbv_at_disposal (can be negative)
  buyer TEXT,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL, -- Invoice / Disposal Receipt
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.asset_disposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select on asset_disposals for authenticated" ON public.asset_disposals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write on asset_disposals for commercial_mgr, accountant, gm, admin" ON public.asset_disposals FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('commercial_mgr', 'account', 'gm', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('commercial_mgr', 'account', 'gm', 'admin')));

-- ============================================================
-- 7. VEHICLE FINES RECORD (WITH PAYROLL ADJUSTMENT WIRING)
-- ============================================================

CREATE TABLE public.vehicle_fines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  fine_number TEXT UNIQUE NOT NULL,
  fine_date DATE NOT NULL,
  fine_time TIME, -- nullable
  location TEXT NOT NULL,
  violation_type TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  black_points INTEGER DEFAULT 0 CHECK (black_points >= 0),
  source TEXT NOT NULL CHECK (source IN ('DUBAI_POLICE', 'ABU_DHABI_POLICE', 'SHARJAH_POLICE', 'RTA', 'OTHER')),
  driver_id UUID REFERENCES public.employees(id) ON DELETE SET NULL, -- Auto-resolved from assignments or manual override
  status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PAID', 'DISPUTED', 'TRANSFERRED_TO_DRIVER')),
  paid_date DATE,
  paid_by TEXT CHECK (paid_by IN ('COMPANY', 'DRIVER')),
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL, -- Fine ticket PDF in DMS
  payroll_adjustment_id UUID REFERENCES public.payroll_adjustments(id) ON DELETE SET NULL, -- Driver liability payroll links
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.vehicle_fines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select on vehicle_fines for authenticated" ON public.vehicle_fines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write on vehicle_fines for fleet_coordinator, accountant, gm, admin" ON public.vehicle_fines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('fleet_coordinator', 'account', 'gm', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('fleet_coordinator', 'account', 'gm', 'admin')));

-- ============================================================
-- 8. FUEL LOGS RECORD (WITH EFFICIENCY AND DEV TRIGGER FLAGS)
-- ============================================================

CREATE TABLE public.fuel_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  log_date DATE NOT NULL,
  odometer_km INTEGER NOT NULL CHECK (odometer_km >= 0),
  litres NUMERIC(8,2) NOT NULL CHECK (litres > 0),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  fuel_type TEXT NOT NULL CHECK (fuel_type IN ('SPECIAL_95', 'SUPER_98', 'DIESEL', 'ELECTRIC')),
  station TEXT,
  card_number TEXT,
  driver_id UUID REFERENCES public.employees(id) ON DELETE RESTRICT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  receipt_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  efficiency_km_l NUMERIC(8,2) NOT NULL DEFAULT 0.00, -- dynamic efficiency (km since last fill-up / litres)
  is_anomaly BOOLEAN DEFAULT false NOT NULL, -- flags when consumption >30% rolling average deviation
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.fuel_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select on fuel_logs for authenticated" ON public.fuel_logs FOR SELECT TO authenticated USING (true);
-- Any authenticated driver, coordinator, accountant, or admin can log fuel
CREATE POLICY "Allow write on fuel_logs for authenticated users" ON public.fuel_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 9. VEHICLE MAINTENANCE RECORD
-- ============================================================

CREATE TABLE public.vehicle_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('SERVICE', 'REPAIR', 'TYRE', 'BATTERY', 'ACCIDENT', 'INSPECTION')),
  service_date DATE NOT NULL,
  odometer_km INTEGER NOT NULL CHECK (odometer_km >= 0),
  vendor TEXT NOT NULL,
  description TEXT NOT NULL,
  cost NUMERIC(10,2) NOT NULL CHECK (cost >= 0),
  next_service_odometer INTEGER CHECK (next_service_odometer IS NULL OR next_service_odometer > odometer_km),
  next_service_date DATE,
  invoice_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  downtime_days INTEGER DEFAULT 0 CHECK (downtime_days >= 0),
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.vehicle_maintenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select on vehicle_maintenance for authenticated" ON public.vehicle_maintenance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write on vehicle_maintenance for fleet_coordinator, accountant, gm, admin" ON public.vehicle_maintenance FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('fleet_coordinator', 'account', 'gm', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('fleet_coordinator', 'account', 'gm', 'admin')));

-- ============================================================
-- 10. AUTONUMBERING TRIGGERS & FUNCTIONS
-- ============================================================

-- A. Vehicles Code (JI-VEH-NNN)
CREATE OR REPLACE FUNCTION public.set_vehicle_code()
RETURNS TRIGGER AS $$
DECLARE
  next_number INTEGER;
BEGIN
  IF NEW.vehicle_code IS NOT NULL AND NEW.vehicle_code <> '' THEN
    RETURN NEW;
  END IF;

  LOCK TABLE public.vehicle_number_sequences IN SHARE ROW EXCLUSIVE MODE;

  INSERT INTO public.vehicle_number_sequences (prefix, last_number)
  VALUES ('JI-VEH', 1)
  ON CONFLICT (prefix) DO UPDATE
  SET last_number = vehicle_number_sequences.last_number + 1
  RETURNING last_number INTO next_number;

  NEW.vehicle_code := 'JI-VEH-' || LPAD(next_number::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_set_vehicle_code
  BEFORE INSERT ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_vehicle_code();

-- B. Fixed Assets Number (JI-FA-YYYY-NNN)
CREATE OR REPLACE FUNCTION public.set_fixed_asset_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
BEGIN
  IF NEW.asset_number IS NOT NULL AND NEW.asset_number <> '' THEN
    RETURN NEW;
  END IF;

  current_year := EXTRACT(YEAR FROM NEW.acquisition_date)::INTEGER;
  IF current_year IS NULL THEN
    current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  END IF;

  LOCK TABLE public.asset_number_sequences IN SHARE ROW EXCLUSIVE MODE;

  INSERT INTO public.asset_number_sequences (year, last_number)
  VALUES (current_year, 1)
  ON CONFLICT (year) DO UPDATE
  SET last_number = asset_number_sequences.last_number + 1
  RETURNING last_number INTO next_number;

  NEW.asset_number := 'JI-FA-' || current_year::TEXT || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_set_fixed_asset_number
  BEFORE INSERT ON public.fixed_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_fixed_asset_number();

-- ============================================================
-- 11. INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX idx_vehicles_driver ON public.vehicles (assigned_driver_id);
CREATE INDEX idx_vehicles_asset ON public.vehicles (fixed_asset_id);
CREATE INDEX idx_vehicles_status ON public.vehicles (status);
CREATE INDEX idx_vehicles_reg_expiry ON public.vehicles (registration_expiry);
CREATE INDEX idx_vehicles_ins_expiry ON public.vehicles (insurance_expiry);

CREATE INDEX idx_assignments_vehicle ON public.vehicle_assignments (vehicle_id);
CREATE INDEX idx_assignments_driver ON public.vehicle_assignments (driver_id);
CREATE INDEX idx_assignments_dates ON public.vehicle_assignments (from_date, to_date);

CREATE INDEX idx_assets_category ON public.fixed_assets (category);
CREATE INDEX idx_assets_status ON public.fixed_assets (status);
CREATE INDEX idx_assets_linked_vehicle ON public.fixed_assets (linked_vehicle_id);
CREATE INDEX idx_assets_linked_tool ON public.fixed_assets (linked_tool_id);

CREATE INDEX idx_dep_sched_asset ON public.depreciation_schedule (asset_id);
CREATE INDEX idx_dep_sched_period ON public.depreciation_schedule (period_month);

CREATE INDEX idx_disposals_asset ON public.asset_disposals (asset_id);

CREATE INDEX idx_fines_vehicle ON public.vehicle_fines (vehicle_id);
CREATE INDEX idx_fines_date ON public.vehicle_fines (fine_date);
CREATE INDEX idx_fines_driver ON public.vehicle_fines (driver_id);

CREATE INDEX idx_fuel_vehicle ON public.fuel_logs (vehicle_id);
CREATE INDEX idx_fuel_date ON public.fuel_logs (log_date);
CREATE INDEX idx_fuel_driver ON public.fuel_logs (driver_id);

CREATE INDEX idx_maint_vehicle ON public.vehicle_maintenance (vehicle_id);
CREATE INDEX idx_maint_date ON public.vehicle_maintenance (service_date);
