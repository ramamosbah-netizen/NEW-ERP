-- ============================================================
-- JEET INTECH — Master Pricing Catalog Schema
-- ELV & MEP Unit Rate Database
-- ============================================================

-- ============================================================
-- 1. AUDIT LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  changed_fields JSONB DEFAULT '{}'::jsonb,
  old_values JSONB DEFAULT '{}'::jsonb,
  new_values JSONB DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_select" ON public.audit_log;
CREATE POLICY "audit_log_select" ON public.audit_log
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "audit_log_insert" ON public.audit_log;
CREATE POLICY "audit_log_insert" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_audit_log_table ON public.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_record ON public.audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);

-- ============================================================
-- 2. PRICING LABOUR RATES (default hourly rates)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pricing_labour_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('TECHNICIAN','ENGINEER','PM','HELPER')),
  rate_aed_per_hour NUMERIC(10,2) NOT NULL DEFAULT 0,
  overtime_rate NUMERIC(10,2) DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.pricing_labour_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "labour_rates_select" ON public.pricing_labour_rates;
CREATE POLICY "labour_rates_select" ON public.pricing_labour_rates
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "labour_rates_insert" ON public.pricing_labour_rates;
CREATE POLICY "labour_rates_insert" ON public.pricing_labour_rates
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "labour_rates_update" ON public.pricing_labour_rates;
CREATE POLICY "labour_rates_update" ON public.pricing_labour_rates
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Seed default labour rates
INSERT INTO public.pricing_labour_rates (role, rate_aed_per_hour, overtime_rate)
VALUES
  ('TECHNICIAN', 15.00, 22.50),
  ('ENGINEER',   25.00, 37.50),
  ('PM',         45.00, 67.50),
  ('HELPER',      8.00, 12.00)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. PRICING ITEMS (master catalog)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pricing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code TEXT UNIQUE NOT NULL,
  system TEXT NOT NULL,
  category TEXT NOT NULL,
  sub_category TEXT,
  description TEXT NOT NULL,
  short_name TEXT,
  unit TEXT NOT NULL DEFAULT 'EA',
  spec_reference TEXT,
  brand TEXT,
  part_number TEXT,
  supplier TEXT,

  -- Material
  material_cost NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Computed pricing
  sell_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_with_vat NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Tiers
  price_tier TEXT NOT NULL DEFAULT 'standard' CHECK (price_tier IN ('standard','premium','budget')),
  lead_time_days INTEGER DEFAULT 0,
  warranty_months INTEGER DEFAULT 12,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  review_date DATE,
  last_price_change TIMESTAMPTZ,

  -- Usage
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_on_project TEXT,

  -- Meta
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  client_facing_notes TEXT,

  -- Labour fields
  labour_technician_rate NUMERIC(10,2) DEFAULT 15.00,
  labour_engineer_rate NUMERIC(10,2) DEFAULT 25.00,
  labour_pm_rate NUMERIC(10,2) DEFAULT 45.00,
  labour_helper_rate NUMERIC(10,2) DEFAULT 8.00,
  labour_technician_hours NUMERIC(8,2) DEFAULT 0,
  labour_engineer_hours NUMERIC(8,2) DEFAULT 0,
  labour_pm_hours NUMERIC(8,2) DEFAULT 0,
  labour_helper_hours NUMERIC(8,2) DEFAULT 0,
  labour_technician_count NUMERIC(6,2) DEFAULT 1,
  labour_engineer_count NUMERIC(6,2) DEFAULT 0,
  labour_pm_count NUMERIC(6,2) DEFAULT 0,
  labour_helper_count NUMERIC(6,2) DEFAULT 0,
  labour_productivity_factor NUMERIC(4,2) DEFAULT 1.00,
  labour_site_factor NUMERIC(4,2) DEFAULT 1.00,
  labour_cost_computed NUMERIC(12,2) DEFAULT 0,

  -- Pricing percentages
  overhead_pct NUMERIC(5,2) DEFAULT 15.00,
  gna_pct NUMERIC(5,2) DEFAULT 8.00,
  contingency_pct NUMERIC(5,2) DEFAULT 5.00,
  markup_pct NUMERIC(5,2) DEFAULT 20.00,
  subcon_cost NUMERIC(12,2) DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.pricing_items ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pricing_items_system ON public.pricing_items(system);
CREATE INDEX IF NOT EXISTS idx_pricing_items_category ON public.pricing_items(category);
CREATE INDEX IF NOT EXISTS idx_pricing_items_active ON public.pricing_items(is_active);
CREATE INDEX IF NOT EXISTS idx_pricing_items_code ON public.pricing_items(item_code);
CREATE INDEX IF NOT EXISTS idx_pricing_items_usage ON public.pricing_items(usage_count DESC);

DROP POLICY IF EXISTS "pricing_items_select" ON public.pricing_items;
CREATE POLICY "pricing_items_select" ON public.pricing_items
  FOR SELECT TO authenticated USING (is_deleted = false);

DROP POLICY IF EXISTS "pricing_items_insert" ON public.pricing_items;
CREATE POLICY "pricing_items_insert" ON public.pricing_items
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "pricing_items_update" ON public.pricing_items;
CREATE POLICY "pricing_items_update" ON public.pricing_items
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 4. PRICING PRICE HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pricing_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.pricing_items(id) ON DELETE CASCADE NOT NULL,
  old_sell_price NUMERIC(12,2),
  new_sell_price NUMERIC(12,2),
  change_pct NUMERIC(8,2),
  change_reason TEXT,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.pricing_price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "price_history_select" ON public.pricing_price_history;
CREATE POLICY "price_history_select" ON public.pricing_price_history
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "price_history_insert" ON public.pricing_price_history;
CREATE POLICY "price_history_insert" ON public.pricing_price_history
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_price_history_item ON public.pricing_price_history(item_id);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON public.pricing_price_history(changed_at DESC);

-- ============================================================
-- 5. PRICING RATE ANALYSES (snapshots per project)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pricing_rate_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.pricing_items(id) ON DELETE CASCADE NOT NULL,
  project_ref TEXT,
  snapshot_label TEXT,
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.pricing_rate_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rate_analyses_select" ON public.pricing_rate_analyses;
CREATE POLICY "rate_analyses_select" ON public.pricing_rate_analyses
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rate_analyses_insert" ON public.pricing_rate_analyses;
CREATE POLICY "rate_analyses_insert" ON public.pricing_rate_analyses
  FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- 6. PRICING ADJUSTMENT FACTORS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pricing_adjustment_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factor_code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  applies_to TEXT NOT NULL DEFAULT 'LABOUR_ONLY' CHECK (applies_to IN ('LABOUR_ONLY','ALL_COSTS','MATERIAL_ONLY')),
  applicable_systems TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.pricing_adjustment_factors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "factors_select" ON public.pricing_adjustment_factors;
CREATE POLICY "factors_select" ON public.pricing_adjustment_factors
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "factors_insert" ON public.pricing_adjustment_factors;
CREATE POLICY "factors_insert" ON public.pricing_adjustment_factors
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "factors_update" ON public.pricing_adjustment_factors;
CREATE POLICY "factors_update" ON public.pricing_adjustment_factors
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Pre-seed factors
INSERT INTO public.pricing_adjustment_factors (factor_code, label, multiplier, applies_to) VALUES
  ('STD', 'Standard',             1.00, 'LABOUR_ONLY'),
  ('RST', 'Restricted Access',    1.20, 'LABOUR_ONLY'),
  ('HCX', 'High Complexity',      1.30, 'LABOUR_ONLY'),
  ('NSH', 'Night Shift',          1.40, 'LABOUR_ONLY'),
  ('CHZ', 'Confined / Hazmat',    1.50, 'LABOUR_ONLY'),
  ('WKN', 'Weekend Working',      1.25, 'LABOUR_ONLY'),
  ('HGT', 'Height >10m',          1.35, 'LABOUR_ONLY'),
  ('OFS', 'Offshore / Remote',    1.75, 'ALL_COSTS'),
  ('VIP', 'Ultra-Premium Finish', 1.20, 'ALL_COSTS'),
  ('EMG', 'Emergency Works',      1.60, 'ALL_COSTS')
ON CONFLICT (factor_code) DO NOTHING;

-- ============================================================
-- 7. PRICING SUPPLIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pricing_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  systems_covered TEXT[] DEFAULT '{}',
  payment_terms_days INTEGER DEFAULT 30,
  preferred BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.pricing_suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_select" ON public.pricing_suppliers;
CREATE POLICY "suppliers_select" ON public.pricing_suppliers
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "suppliers_insert" ON public.pricing_suppliers;
CREATE POLICY "suppliers_insert" ON public.pricing_suppliers
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "suppliers_update" ON public.pricing_suppliers;
CREATE POLICY "suppliers_update" ON public.pricing_suppliers
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 8. PRICING TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pricing_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT UNIQUE NOT NULL,
  overhead_pct NUMERIC(5,2) NOT NULL DEFAULT 15,
  gna_pct NUMERIC(5,2) NOT NULL DEFAULT 8,
  contingency_pct NUMERIC(5,2) NOT NULL DEFAULT 5,
  markup_pct NUMERIC(5,2) NOT NULL DEFAULT 20,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.pricing_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "templates_select" ON public.pricing_templates;
CREATE POLICY "templates_select" ON public.pricing_templates
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "templates_insert" ON public.pricing_templates;
CREATE POLICY "templates_insert" ON public.pricing_templates
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "templates_update" ON public.pricing_templates;
CREATE POLICY "templates_update" ON public.pricing_templates
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Pre-seed templates
INSERT INTO public.pricing_templates (template_name, overhead_pct, gna_pct, contingency_pct, markup_pct, description) VALUES
  ('Government Tender',   15, 8, 8, 15, 'Government sector tenders with conservative margins'),
  ('Private Villa',       12, 7, 5, 25, 'High-end residential villa projects'),
  ('Hotel / Hospitality', 14, 8, 6, 22, 'Hotel and hospitality fit-out projects'),
  ('Industrial',          12, 7, 7, 18, 'Industrial and warehouse installations'),
  ('AMC / Maintenance',   10, 6, 3, 30, 'Annual maintenance contracts'),
  ('Design & Build',      15, 8, 10, 20, 'Design-build turnkey projects'),
  ('Subcon Only',          8, 5, 5, 12, 'Subcontractor-only scope packages')
ON CONFLICT (template_name) DO NOTHING;

-- ============================================================
-- 9. AUDIT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_pricing_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, old_values, new_values, user_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());

    -- Track price changes specifically
    IF TG_TABLE_NAME = 'pricing_items' AND OLD.sell_price IS DISTINCT FROM NEW.sell_price THEN
      INSERT INTO public.pricing_price_history (item_id, old_sell_price, new_sell_price, change_pct, changed_by)
      VALUES (
        NEW.id,
        OLD.sell_price,
        NEW.sell_price,
        CASE WHEN OLD.sell_price > 0
          THEN ROUND(((NEW.sell_price - OLD.sell_price) / OLD.sell_price) * 100, 2)
          ELSE 0 END,
        auth.uid()
      );
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, new_values, user_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, old_values, user_id)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Attach triggers
DROP TRIGGER IF EXISTS pricing_items_audit ON public.pricing_items;
CREATE TRIGGER pricing_items_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.pricing_items
  FOR EACH ROW EXECUTE FUNCTION public.log_pricing_change();

DROP TRIGGER IF EXISTS pricing_factors_audit ON public.pricing_adjustment_factors;
CREATE TRIGGER pricing_factors_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.pricing_adjustment_factors
  FOR EACH ROW EXECUTE FUNCTION public.log_pricing_change();

DROP TRIGGER IF EXISTS pricing_templates_audit ON public.pricing_templates;
CREATE TRIGGER pricing_templates_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.pricing_templates
  FOR EACH ROW EXECUTE FUNCTION public.log_pricing_change();

DROP TRIGGER IF EXISTS pricing_suppliers_audit ON public.pricing_suppliers;
CREATE TRIGGER pricing_suppliers_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.pricing_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.log_pricing_change();

DROP TRIGGER IF EXISTS pricing_labour_rates_audit ON public.pricing_labour_rates;
CREATE TRIGGER pricing_labour_rates_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.pricing_labour_rates
  FOR EACH ROW EXECUTE FUNCTION public.log_pricing_change();

-- ============================================================
-- 10. SEED DATA — 80+ PRICING ITEMS
-- ============================================================

-- CCTV System
INSERT INTO public.pricing_items (item_code, system, category, sub_category, description, short_name, unit, brand, part_number, material_cost, labour_technician_hours, labour_engineer_hours, labour_helper_hours, labour_technician_count, labour_engineer_count, labour_helper_count, overhead_pct, gna_pct, contingency_pct, markup_pct, tags) VALUES
('CCTV-CAM-001', 'CCTV', 'Cameras', 'Dome', '2MP IR Dome Camera Indoor', '2MP Dome', 'EA', 'Hikvision', 'DS-2CD1123G0E-I', 185.00, 2.00, 0.25, 1.00, 1, 0, 1, 15, 8, 5, 20, '{indoor,dome,2mp}'),
('CCTV-CAM-002', 'CCTV', 'Cameras', 'Bullet', '4MP IR Bullet Camera Outdoor', '4MP Bullet', 'EA', 'Hikvision', 'DS-2CD2T47G2-L', 320.00, 2.50, 0.25, 1.00, 1, 0, 1, 15, 8, 5, 20, '{outdoor,bullet,4mp}'),
('CCTV-CAM-003', 'CCTV', 'Cameras', 'PTZ', '4MP 25x PTZ Camera', '4MP PTZ', 'EA', 'Hikvision', 'DS-2DE4425IW-DE', 2800.00, 4.00, 1.00, 2.00, 1, 1, 1, 15, 8, 5, 20, '{ptz,outdoor,4mp}'),
('CCTV-CAM-004', 'CCTV', 'Cameras', 'Dome', '8MP 4K Dome Camera Vandal', '8MP Dome VR', 'EA', 'Axis', 'P3245-V', 1650.00, 2.00, 0.50, 1.00, 1, 0, 1, 15, 8, 5, 20, '{vandal,dome,8mp,4k}'),
('CCTV-NVR-001', 'CCTV', 'Recording', 'NVR', '16-Channel NVR 4TB HDD', '16ch NVR', 'EA', 'Hikvision', 'DS-7616NI-K2', 1450.00, 3.00, 1.00, 0.50, 1, 1, 0, 15, 8, 5, 20, '{nvr,16ch}'),
('CCTV-NVR-002', 'CCTV', 'Recording', 'NVR', '32-Channel NVR 8TB HDD', '32ch NVR', 'EA', 'Hikvision', 'DS-9632NI-I8', 3200.00, 4.00, 2.00, 1.00, 1, 1, 1, 15, 8, 5, 20, '{nvr,32ch}'),
('CCTV-MON-001', 'CCTV', 'Monitors', 'Display', '43" LED Monitor 4K', '43" Monitor', 'EA', 'Hikvision', 'DS-D5043UC', 1100.00, 1.00, 0.25, 0.50, 1, 0, 1, 15, 8, 5, 20, '{monitor,4k}'),
('CCTV-ACC-001', 'CCTV', 'Accessories', 'Mount', 'Wall Mount Bracket', 'Wall Mount', 'EA', 'Hikvision', 'DS-1273ZJ-135', 45.00, 0.50, 0.00, 0.25, 1, 0, 0, 15, 8, 5, 20, '{mount,bracket}')
ON CONFLICT (item_code) DO NOTHING;

-- Access Control System
INSERT INTO public.pricing_items (item_code, system, category, sub_category, description, short_name, unit, brand, part_number, material_cost, labour_technician_hours, labour_engineer_hours, labour_helper_hours, labour_technician_count, labour_engineer_count, labour_helper_count, overhead_pct, gna_pct, contingency_pct, markup_pct, tags) VALUES
('ACS-RDR-001', 'ACCESS_CONTROL', 'Readers', 'Proximity', 'HID Prox Reader RP15', 'Prox Reader', 'EA', 'HID', 'RP15', 280.00, 1.50, 0.25, 0.50, 1, 0, 1, 15, 8, 5, 20, '{reader,prox}'),
('ACS-RDR-002', 'ACCESS_CONTROL', 'Readers', 'Biometric', 'Fingerprint + Card Reader', 'Bio Reader', 'EA', 'HID', 'iCLASS SE RB25F', 950.00, 2.00, 0.50, 0.50, 1, 0, 1, 15, 8, 5, 20, '{reader,biometric}'),
('ACS-CTL-001', 'ACCESS_CONTROL', 'Controllers', 'Door Controller', '2-Door Access Controller', '2-Door Ctrl', 'EA', 'HID', 'EDGE EVO E400', 1200.00, 3.00, 1.00, 1.00, 1, 1, 1, 15, 8, 5, 20, '{controller,2door}'),
('ACS-CTL-002', 'ACCESS_CONTROL', 'Controllers', 'Door Controller', '4-Door Access Controller', '4-Door Ctrl', 'EA', 'HID', 'EDGE EVO E400-K', 1850.00, 4.00, 1.50, 1.00, 1, 1, 1, 15, 8, 5, 20, '{controller,4door}'),
('ACS-LCK-001', 'ACCESS_CONTROL', 'Locks', 'EM Lock', 'Electromagnetic Lock 600lbs', 'EM Lock', 'EA', 'HID', 'ML-600', 180.00, 1.00, 0.00, 0.50, 1, 0, 0, 15, 8, 5, 20, '{lock,em,600lbs}'),
('ACS-DOR-001', 'ACCESS_CONTROL', 'Doors', 'Full Install', 'Access Door Full Install', 'Door Install', 'EA', 'HID', '', 450.00, 4.00, 0.50, 1.00, 1, 0, 1, 15, 8, 5, 20, '{door,install}'),
('ACS-BTN-001', 'ACCESS_CONTROL', 'Accessories', 'Exit Button', 'Request to Exit Button', 'REX Button', 'EA', 'HID', 'REX-100', 55.00, 0.50, 0.00, 0.25, 1, 0, 0, 15, 8, 5, 20, '{rex,button}'),
('ACS-PSU-001', 'ACCESS_CONTROL', 'Power', 'PSU', 'Access Control PSU 5A', 'ACS PSU', 'EA', 'HID', 'PS-5A', 120.00, 0.75, 0.00, 0.25, 1, 0, 0, 15, 8, 5, 20, '{psu,power}')
ON CONFLICT (item_code) DO NOTHING;

-- Fire Alarm System
INSERT INTO public.pricing_items (item_code, system, category, sub_category, description, short_name, unit, brand, part_number, material_cost, labour_technician_hours, labour_engineer_hours, labour_helper_hours, labour_technician_count, labour_engineer_count, labour_helper_count, overhead_pct, gna_pct, contingency_pct, markup_pct, tags) VALUES
('FA-DET-001', 'FIRE_ALARM', 'Detectors', 'Smoke', 'Addressable Smoke Detector', 'Smoke Det', 'EA', 'Notifier', 'FSP-851', 95.00, 0.75, 0.25, 0.25, 1, 0, 0, 15, 8, 5, 20, '{smoke,addressable}'),
('FA-DET-002', 'FIRE_ALARM', 'Detectors', 'Heat', 'Addressable Heat Detector', 'Heat Det', 'EA', 'Notifier', 'FST-851', 85.00, 0.75, 0.25, 0.25, 1, 0, 0, 15, 8, 5, 20, '{heat,addressable}'),
('FA-DET-003', 'FIRE_ALARM', 'Detectors', 'Beam', 'Reflective Beam Detector', 'Beam Det', 'EA', 'Notifier', 'FSB-200S', 1350.00, 3.00, 1.00, 1.00, 1, 1, 1, 15, 8, 5, 20, '{beam,reflective}'),
('FA-MCP-001', 'FIRE_ALARM', 'Call Points', 'Manual', 'Addressable Manual Call Point', 'MCP', 'EA', 'Notifier', 'M700KI', 110.00, 0.50, 0.00, 0.25, 1, 0, 0, 15, 8, 5, 20, '{mcp,manual}'),
('FA-SND-001', 'FIRE_ALARM', 'Sounders', 'Sounder', 'Addressable Sounder Strobe', 'Sounder', 'EA', 'Notifier', 'NFXI-OPT-IV', 145.00, 0.75, 0.00, 0.25, 1, 0, 0, 15, 8, 5, 20, '{sounder,strobe}'),
('FA-PNL-001', 'FIRE_ALARM', 'Panels', 'FACP', 'Fire Alarm Control Panel 2-Loop', 'FACP 2L', 'EA', 'Notifier', 'NFS2-3030', 8500.00, 6.00, 2.00, 1.00, 2, 1, 1, 15, 8, 5, 20, '{facp,2loop}'),
('FA-PNL-002', 'FIRE_ALARM', 'Panels', 'FACP', 'Fire Alarm Control Panel 4-Loop', 'FACP 4L', 'EA', 'Notifier', 'NFS2-3030E', 14000.00, 8.00, 3.00, 2.00, 2, 1, 1, 15, 8, 5, 20, '{facp,4loop}'),
('FA-MOD-001', 'FIRE_ALARM', 'Modules', 'I/O', 'Addressable Monitor Module', 'Mon Module', 'EA', 'Notifier', 'FMM-1', 95.00, 0.50, 0.25, 0.00, 1, 0, 0, 15, 8, 5, 20, '{module,monitor}'),
('FA-MOD-002', 'FIRE_ALARM', 'Modules', 'I/O', 'Addressable Control Module', 'Ctrl Module', 'EA', 'Notifier', 'FCM-1', 110.00, 0.50, 0.25, 0.00, 1, 0, 0, 15, 8, 5, 20, '{module,control}')
ON CONFLICT (item_code) DO NOTHING;

-- Structured Cabling
INSERT INTO public.pricing_items (item_code, system, category, sub_category, description, short_name, unit, brand, part_number, material_cost, labour_technician_hours, labour_engineer_hours, labour_helper_hours, labour_technician_count, labour_engineer_count, labour_helper_count, overhead_pct, gna_pct, contingency_pct, markup_pct, tags) VALUES
('SC-CAB-001', 'STRUCTURED_CABLING', 'Cables', 'UTP', 'Cat6 UTP Cable 305m Box', 'Cat6 UTP', 'BOX', 'Panduit', 'PUP6C04BU-CEG', 450.00, 2.50, 0.00, 1.50, 1, 0, 1, 15, 8, 5, 20, '{cat6,utp,305m}'),
('SC-CAB-002', 'STRUCTURED_CABLING', 'Cables', 'UTP', 'Cat6A UTP Cable 305m Box', 'Cat6A UTP', 'BOX', 'Panduit', 'PUP6AV04BU', 680.00, 2.50, 0.00, 1.50, 1, 0, 1, 15, 8, 5, 20, '{cat6a,utp,305m}'),
('SC-CAB-003', 'STRUCTURED_CABLING', 'Cables', 'Fiber', 'OM3 12-Core Fiber Cable per metre', 'OM3 12C', 'M', 'Nexans', 'N164.191', 8.50, 0.15, 0.00, 0.05, 1, 0, 0, 15, 8, 5, 20, '{fiber,om3,12core}'),
('SC-JCK-001', 'STRUCTURED_CABLING', 'Outlets', 'Jack', 'Cat6 Keystone Jack', 'Cat6 Jack', 'EA', 'Panduit', 'CJ688TGBL', 18.00, 0.25, 0.00, 0.00, 1, 0, 0, 15, 8, 5, 20, '{jack,cat6}'),
('SC-FPL-001', 'STRUCTURED_CABLING', 'Outlets', 'Face Plate', 'Single Gang Face Plate 2-Port', 'Face Plate 2P', 'EA', 'Panduit', 'CFPSE2IW', 12.00, 0.15, 0.00, 0.00, 1, 0, 0, 15, 8, 5, 20, '{faceplate,2port}'),
('SC-PTH-001', 'STRUCTURED_CABLING', 'Patching', 'Patch Panel', '24-Port Cat6 Patch Panel', '24P Patch', 'EA', 'Panduit', 'CP24WSBLY', 185.00, 1.50, 0.50, 0.50, 1, 0, 0, 15, 8, 5, 20, '{patchpanel,24port}'),
('SC-RCK-001', 'STRUCTURED_CABLING', 'Racks', 'Cabinet', '42U Floor Standing Rack', '42U Rack', 'EA', 'Panduit', 'S6522BF', 1800.00, 4.00, 1.00, 2.00, 2, 0, 2, 15, 8, 5, 20, '{rack,42u,floor}'),
('SC-FBR-001', 'STRUCTURED_CABLING', 'Fiber', 'Termination', 'Fiber Termination per end (SC/LC)', 'Fiber Term', 'EA', 'Nexans', '', 35.00, 1.00, 0.50, 0.00, 1, 0, 0, 15, 8, 5, 20, '{fiber,termination}'),
('SC-PTL-001', 'STRUCTURED_CABLING', 'Patching', 'Patch Lead', 'Cat6 Patch Lead 1m', 'Patch 1m', 'EA', 'Panduit', 'UTPSP1MBLY', 8.00, 0.00, 0.00, 0.00, 0, 0, 0, 15, 8, 5, 20, '{patchlead,1m}')
ON CONFLICT (item_code) DO NOTHING;

-- PA / Public Address
INSERT INTO public.pricing_items (item_code, system, category, sub_category, description, short_name, unit, brand, part_number, material_cost, labour_technician_hours, labour_engineer_hours, labour_helper_hours, labour_technician_count, labour_engineer_count, labour_helper_count, overhead_pct, gna_pct, contingency_pct, markup_pct, tags) VALUES
('PA-SPK-001', 'PA_SYSTEM', 'Speakers', 'Ceiling', '6W Ceiling Speaker', 'Ceiling Spk', 'EA', 'Bosch', 'LC1-WM06E8', 85.00, 0.50, 0.00, 0.25, 1, 0, 0, 15, 8, 5, 20, '{speaker,ceiling,6w}'),
('PA-SPK-002', 'PA_SYSTEM', 'Speakers', 'Horn', '30W Horn Speaker Outdoor', 'Horn Spk 30W', 'EA', 'Bosch', 'LBC3493/12', 220.00, 1.00, 0.00, 0.50, 1, 0, 1, 15, 8, 5, 20, '{speaker,horn,30w}'),
('PA-AMP-001', 'PA_SYSTEM', 'Amplifiers', 'Mixer Amp', '240W Mixer Amplifier', 'Mixer 240W', 'EA', 'Bosch', 'PLE-1MA120-EU', 1250.00, 2.00, 1.00, 0.50, 1, 1, 0, 15, 8, 5, 20, '{amplifier,mixer,240w}'),
('PA-MIC-001', 'PA_SYSTEM', 'Microphones', 'Paging', 'Paging Microphone Desktop', 'Paging Mic', 'EA', 'Bosch', 'PLE-1CS', 650.00, 0.50, 0.25, 0.00, 1, 0, 0, 15, 8, 5, 20, '{microphone,paging}')
ON CONFLICT (item_code) DO NOTHING;

-- Barrier / Gate Systems
INSERT INTO public.pricing_items (item_code, system, category, sub_category, description, short_name, unit, brand, part_number, material_cost, labour_technician_hours, labour_engineer_hours, labour_helper_hours, labour_technician_count, labour_engineer_count, labour_helper_count, overhead_pct, gna_pct, contingency_pct, markup_pct, tags) VALUES
('BGS-BOM-001', 'BARRIERS_GATES', 'Boom Gates', 'Vehicle', 'Automatic Boom Gate 4m Arm', 'Boom 4m', 'EA', 'BFT', 'GIOTTO-30', 4500.00, 6.00, 1.00, 3.00, 2, 1, 2, 15, 8, 5, 20, '{boom,4m,automatic}'),
('BGS-BOM-002', 'BARRIERS_GATES', 'Boom Gates', 'Vehicle', 'Automatic Boom Gate 6m Arm', 'Boom 6m', 'EA', 'FAAC', 'B680H', 6200.00, 8.00, 1.50, 4.00, 2, 1, 2, 15, 8, 5, 20, '{boom,6m,automatic}'),
('BGS-BLR-001', 'BARRIERS_GATES', 'Bollards', 'Automatic', 'Automatic Rising Bollard 600mm', 'Bollard 600', 'EA', 'FAAC', 'J275HA600', 8500.00, 8.00, 2.00, 4.00, 2, 1, 2, 15, 8, 5, 20, '{bollard,rising,auto}'),
('BGS-TRN-001', 'BARRIERS_GATES', 'Turnstiles', 'Tripod', 'Tripod Turnstile with Reader', 'Turnstile', 'EA', 'BFT', '', 3500.00, 4.00, 1.00, 2.00, 1, 1, 1, 15, 8, 5, 20, '{turnstile,tripod}'),
('BGS-LPR-001', 'BARRIERS_GATES', 'LPR', 'Camera', 'LPR Camera with Software License', 'LPR Cam', 'EA', 'Hikvision', 'DS-2CD7A26G0/P', 3800.00, 3.00, 2.00, 1.00, 1, 1, 1, 15, 8, 5, 20, '{lpr,anpr,camera}')
ON CONFLICT (item_code) DO NOTHING;

-- Intercom / Video Door Phone
INSERT INTO public.pricing_items (item_code, system, category, sub_category, description, short_name, unit, brand, part_number, material_cost, labour_technician_hours, labour_engineer_hours, labour_helper_hours, labour_technician_count, labour_engineer_count, labour_helper_count, overhead_pct, gna_pct, contingency_pct, markup_pct, tags) VALUES
('IDP-PNL-001', 'INTERCOM', 'Door Panels', 'Video', 'IP Video Door Station 2-Button', 'Door Station', 'EA', 'Hikvision', 'DS-KD8003-IME1', 750.00, 2.00, 0.50, 1.00, 1, 0, 1, 15, 8, 5, 20, '{doorphone,video,ip}'),
('IDP-MON-001', 'INTERCOM', 'Indoor Monitors', 'Screen', '7" Indoor Monitor Touch', 'Indoor Mon', 'EA', 'Hikvision', 'DS-KH6320-WTE1', 450.00, 1.00, 0.25, 0.50, 1, 0, 0, 15, 8, 5, 20, '{monitor,indoor,7inch}'),
('IDP-SRV-001', 'INTERCOM', 'Server', 'Management', 'Intercom Management Server', 'IDP Server', 'EA', 'Hikvision', 'DS-KAD606', 1200.00, 2.00, 1.50, 0.50, 1, 1, 0, 15, 8, 5, 20, '{server,management}')
ON CONFLICT (item_code) DO NOTHING;

-- BMS (Building Management System)
INSERT INTO public.pricing_items (item_code, system, category, sub_category, description, short_name, unit, brand, part_number, material_cost, labour_technician_hours, labour_engineer_hours, labour_helper_hours, labour_technician_count, labour_engineer_count, labour_helper_count, overhead_pct, gna_pct, contingency_pct, markup_pct, tags) VALUES
('BMS-CTL-001', 'BMS', 'Controllers', 'DDC', 'DDC Controller 16-Point', 'DDC 16pt', 'EA', 'Honeywell', 'PXC36-E.D', 1850.00, 4.00, 2.00, 1.00, 1, 1, 1, 15, 8, 5, 20, '{ddc,controller,16pt}'),
('BMS-CTL-002', 'BMS', 'Controllers', 'DDC', 'DDC Controller 36-Point', 'DDC 36pt', 'EA', 'Honeywell', 'PXC100-E.D', 3200.00, 6.00, 3.00, 2.00, 1, 1, 1, 15, 8, 5, 20, '{ddc,controller,36pt}'),
('BMS-SEN-001', 'BMS', 'Sensors', 'Temperature', 'Duct Temperature Sensor', 'Duct Temp', 'EA', 'Honeywell', 'QAM2120.040', 95.00, 0.50, 0.25, 0.25, 1, 0, 0, 15, 8, 5, 20, '{sensor,temperature,duct}'),
('BMS-SEN-002', 'BMS', 'Sensors', 'CO2', 'Room CO2 Sensor', 'CO2 Sensor', 'EA', 'Honeywell', 'AQS-Duct-CO2', 350.00, 0.50, 0.25, 0.00, 1, 0, 0, 15, 8, 5, 20, '{sensor,co2}'),
('BMS-PRG-001', 'BMS', 'Programming', 'Point', 'BMS Point Programming', 'BMS Prog', 'PT', 'Honeywell', '', 0.00, 0.00, 1.00, 0.00, 0, 1, 0, 15, 8, 5, 20, '{programming,point}'),
('BMS-VLV-001', 'BMS', 'Actuators', 'Valve', 'Motorized Valve 2-Way DN25', 'Valve 2W DN25', 'EA', 'Honeywell', 'V5011R1059', 280.00, 1.50, 0.50, 0.50, 1, 0, 0, 15, 8, 5, 20, '{valve,motorized,2way}'),
('BMS-WKS-001', 'BMS', 'Workstations', 'Server', 'BMS Server + Software License', 'BMS Server', 'EA', 'Honeywell', 'EBI-R500', 25000.00, 8.00, 8.00, 2.00, 1, 1, 1, 15, 8, 5, 20, '{server,software,license}')
ON CONFLICT (item_code) DO NOTHING;

-- Electrical (LV)
INSERT INTO public.pricing_items (item_code, system, category, sub_category, description, short_name, unit, brand, part_number, material_cost, labour_technician_hours, labour_engineer_hours, labour_helper_hours, labour_technician_count, labour_engineer_count, labour_helper_count, overhead_pct, gna_pct, contingency_pct, markup_pct, tags) VALUES
('EL-MDB-001', 'ELECTRICAL', 'Distribution', 'MDB', 'Main Distribution Board 400A', 'MDB 400A', 'EA', 'Schneider', 'Prisma PM', 18000.00, 8.00, 2.00, 2.00, 2, 1, 2, 15, 8, 5, 20, '{mdb,400a,distribution}'),
('EL-SDB-001', 'ELECTRICAL', 'Distribution', 'SMDB', 'Sub-Main Distribution Board 200A', 'SMDB 200A', 'EA', 'Schneider', 'Prisma PM', 8500.00, 6.00, 1.50, 2.00, 2, 1, 2, 15, 8, 5, 20, '{smdb,200a}'),
('EL-DBB-001', 'ELECTRICAL', 'Distribution', 'DB', 'Distribution Board 12-Way', 'DB 12W', 'EA', 'ABB', 'SDB12', 650.00, 3.00, 0.50, 1.00, 1, 0, 1, 15, 8, 5, 20, '{db,12way}'),
('EL-CBL-001', 'ELECTRICAL', 'Cables', 'Power', '4C × 10mm XLPE Power Cable per m', '4C 10mm', 'M', 'Nexans', 'N2XRY', 28.00, 0.10, 0.00, 0.05, 1, 0, 1, 15, 8, 5, 20, '{cable,power,4c,10mm}'),
('EL-CBL-002', 'ELECTRICAL', 'Cables', 'Power', '4C × 25mm XLPE Power Cable per m', '4C 25mm', 'M', 'Nexans', 'N2XRY', 55.00, 0.12, 0.00, 0.06, 1, 0, 1, 15, 8, 5, 20, '{cable,power,4c,25mm}'),
('EL-CDT-001', 'ELECTRICAL', 'Containment', 'Conduit', 'GI Conduit 20mm per metre', 'GI 20mm', 'M', 'Legrand', '', 8.50, 0.20, 0.00, 0.10, 1, 0, 0, 15, 8, 5, 20, '{conduit,gi,20mm}'),
('EL-CDT-002', 'ELECTRICAL', 'Containment', 'Conduit', 'GI Conduit 25mm per metre', 'GI 25mm', 'M', 'Legrand', '', 11.00, 0.20, 0.00, 0.10, 1, 0, 0, 15, 8, 5, 20, '{conduit,gi,25mm}'),
('EL-TRY-001', 'ELECTRICAL', 'Containment', 'Tray', 'Cable Tray 300mm × 50mm GI per m', 'Tray 300', 'M', 'Legrand', '', 35.00, 0.25, 0.00, 0.15, 1, 0, 1, 15, 8, 5, 20, '{tray,300mm,gi}'),
('EL-MCB-001', 'ELECTRICAL', 'Protection', 'MCB', 'MCB 32A SP', 'MCB 32A SP', 'EA', 'Schneider', 'IC60N', 35.00, 0.25, 0.00, 0.00, 1, 0, 0, 15, 8, 5, 20, '{mcb,32a,sp}')
ON CONFLICT (item_code) DO NOTHING;

-- MEP - HVAC
INSERT INTO public.pricing_items (item_code, system, category, sub_category, description, short_name, unit, brand, part_number, material_cost, labour_technician_hours, labour_engineer_hours, labour_helper_hours, labour_technician_count, labour_engineer_count, labour_helper_count, overhead_pct, gna_pct, contingency_pct, markup_pct, tags) VALUES
('HVAC-FCU-001', 'HVAC', 'Fan Coil Units', 'Ducted', 'Ducted FCU 2.0 TR', 'FCU 2.0TR', 'EA', 'Carrier', '42CE', 2800.00, 4.00, 0.50, 1.50, 2, 0, 1, 15, 8, 5, 20, '{fcu,ducted,2tr}'),
('HVAC-FCU-002', 'HVAC', 'Fan Coil Units', 'Cassette', 'Cassette FCU 3.0 TR', 'Cassette 3TR', 'EA', 'Carrier', '42KA', 3500.00, 4.00, 0.50, 2.00, 2, 0, 2, 15, 8, 5, 20, '{fcu,cassette,3tr}'),
('HVAC-DFR-001', 'HVAC', 'Diffusers', 'Supply', 'Supply Air Diffuser 600×600', 'SAD 600', 'EA', 'Trox', 'ADLR', 95.00, 0.50, 0.00, 0.25, 1, 0, 0, 15, 8, 5, 20, '{diffuser,supply,600}'),
('HVAC-DKT-001', 'HVAC', 'Ductwork', 'GI', 'GI Ductwork per kg (fabricated)', 'GI Duct/kg', 'KG', '', '', 18.00, 0.08, 0.00, 0.04, 1, 0, 1, 15, 8, 5, 20, '{duct,gi,fabricated}'),
('HVAC-INS-001', 'HVAC', 'Insulation', 'Duct', 'Duct Insulation 25mm per sqm', 'Duct Ins 25', 'SQM', 'Armaflex', '', 45.00, 0.30, 0.00, 0.15, 1, 0, 0, 15, 8, 5, 20, '{insulation,duct,25mm}')
ON CONFLICT (item_code) DO NOTHING;

-- Plumbing
INSERT INTO public.pricing_items (item_code, system, category, sub_category, description, short_name, unit, brand, part_number, material_cost, labour_technician_hours, labour_engineer_hours, labour_helper_hours, labour_technician_count, labour_engineer_count, labour_helper_count, overhead_pct, gna_pct, contingency_pct, markup_pct, tags) VALUES
('PLB-PPR-001', 'PLUMBING', 'Piping', 'PPR', 'PPR Pipe 25mm per metre', 'PPR 25mm', 'M', 'Aquatherm', '', 12.00, 0.30, 0.00, 0.15, 1, 0, 0, 15, 8, 5, 20, '{ppr,pipe,25mm}'),
('PLB-PPR-002', 'PLUMBING', 'Piping', 'PPR', 'PPR Pipe 32mm per metre', 'PPR 32mm', 'M', 'Aquatherm', '', 18.00, 0.30, 0.00, 0.15, 1, 0, 0, 15, 8, 5, 20, '{ppr,pipe,32mm}'),
('PLB-VLV-001', 'PLUMBING', 'Valves', 'Gate', 'Gate Valve DN25 Brass', 'Gate 25', 'EA', 'Giacomini', '', 45.00, 0.50, 0.00, 0.25, 1, 0, 0, 15, 8, 5, 20, '{valve,gate,25mm}'),
('PLB-SAN-001', 'PLUMBING', 'Sanitary', 'WC', 'Wall-Hung WC + Concealed Cistern', 'WC Wall', 'SET', 'Grohe', '', 1200.00, 3.00, 0.00, 1.50, 1, 0, 1, 15, 8, 5, 20, '{wc,wallhung,grohe}'),
('PLB-SAN-002', 'PLUMBING', 'Sanitary', 'Basin', 'Counter Top Basin + Mixer', 'Basin Set', 'SET', 'Grohe', '', 850.00, 2.00, 0.00, 1.00, 1, 0, 1, 15, 8, 5, 20, '{basin,countertop}'),
('PLB-WTR-001', 'PLUMBING', 'Water Heaters', 'Electric', 'Electric Water Heater 50L', 'Heater 50L', 'EA', 'Ariston', '', 450.00, 2.00, 0.00, 1.00, 1, 0, 0, 15, 8, 5, 20, '{heater,electric,50l}')
ON CONFLICT (item_code) DO NOTHING;

-- Fire Fighting
INSERT INTO public.pricing_items (item_code, system, category, sub_category, description, short_name, unit, brand, part_number, material_cost, labour_technician_hours, labour_engineer_hours, labour_helper_hours, labour_technician_count, labour_engineer_count, labour_helper_count, overhead_pct, gna_pct, contingency_pct, markup_pct, tags) VALUES
('FF-SPR-001', 'FIRE_FIGHTING', 'Sprinklers', 'Pendant', 'Pendant Sprinkler 68°C', 'Sprinkler', 'EA', 'Honeywell', '', 18.00, 0.50, 0.00, 0.25, 1, 0, 0, 15, 8, 5, 20, '{sprinkler,pendant}'),
('FF-PMP-001', 'FIRE_FIGHTING', 'Pumps', 'Fire Pump', 'Fire Pump Set 100HP', 'Fire Pump', 'SET', 'Grundfos', '', 45000.00, 16.00, 4.00, 8.00, 2, 1, 2, 15, 8, 5, 20, '{pump,fire,100hp}'),
('FF-HOS-001', 'FIRE_FIGHTING', 'Hose Reels', 'Reel', 'Fire Hose Reel 30m Complete', 'Hose Reel', 'EA', '', '', 350.00, 2.00, 0.00, 1.00, 1, 0, 1, 15, 8, 5, 20, '{hosereel,30m}'),
('FF-EXT-001', 'FIRE_FIGHTING', 'Extinguishers', 'Dry Powder', 'Fire Extinguisher 6kg DCP', 'Ext 6kg', 'EA', '', '', 65.00, 0.25, 0.00, 0.00, 1, 0, 0, 15, 8, 5, 20, '{extinguisher,dcp,6kg}'),
('FF-PIP-001', 'FIRE_FIGHTING', 'Piping', 'Black Steel', 'Black Steel Pipe 2" per metre', 'BS Pipe 2"', 'M', '', '', 35.00, 0.40, 0.00, 0.20, 1, 0, 1, 15, 8, 5, 20, '{pipe,steel,2inch}')
ON CONFLICT (item_code) DO NOTHING;

-- Additional items to bring count above 80
INSERT INTO public.pricing_items (item_code, system, category, sub_category, description, short_name, unit, brand, part_number, material_cost, labour_technician_hours, labour_engineer_hours, labour_helper_hours, labour_technician_count, labour_engineer_count, labour_helper_count, overhead_pct, gna_pct, contingency_pct, markup_pct, tags) VALUES
('CCTV-SWT-001', 'CCTV', 'Networking', 'Switch', 'PoE Switch 16-Port Managed', 'PoE 16P', 'EA', 'Hikvision', 'DS-3E1518P-SI', 1200.00, 1.50, 0.50, 0.25, 1, 0, 0, 15, 8, 5, 20, '{switch,poe,16port}'),
('CCTV-HDD-001', 'CCTV', 'Storage', 'HDD', 'Surveillance HDD 4TB', 'HDD 4TB', 'EA', 'Seagate', 'ST4000VX013', 380.00, 0.25, 0.00, 0.00, 1, 0, 0, 15, 8, 5, 20, '{hdd,4tb,surveillance}'),
('ACS-CRD-001', 'ACCESS_CONTROL', 'Credentials', 'Card', 'HID Proximity Card (pack 100)', 'Prox Cards', 'PKT', 'HID', '1326LSSMV', 350.00, 0.00, 0.00, 0.00, 0, 0, 0, 15, 8, 5, 20, '{cards,proximity,100pk}'),
('SC-CAB-004', 'STRUCTURED_CABLING', 'Cables', 'Fiber', 'OM4 24-Core Fiber Cable per m', 'OM4 24C', 'M', 'Nexans', '', 15.00, 0.20, 0.00, 0.10, 1, 0, 0, 15, 8, 5, 20, '{fiber,om4,24core}'),
('SC-SPC-001', 'STRUCTURED_CABLING', 'Fiber', 'Splice', 'Fiber Splice Closure 24-Core', 'Splice 24C', 'EA', 'Commscope', '', 250.00, 2.00, 0.50, 0.50, 1, 0, 0, 15, 8, 5, 20, '{fiber,splice,24core}'),
('EL-UPS-001', 'ELECTRICAL', 'UPS', 'Online', 'Online UPS 10kVA', 'UPS 10kVA', 'EA', 'Schneider', 'SRT10KXLI', 12000.00, 4.00, 2.00, 2.00, 1, 1, 1, 15, 8, 5, 20, '{ups,online,10kva}'),
('EL-LGT-001', 'ELECTRICAL', 'Lighting', 'LED Panel', 'LED Panel Light 600×600 40W', 'LED Panel', 'EA', 'Philips', 'RC065B', 85.00, 0.50, 0.00, 0.25, 1, 0, 0, 15, 8, 5, 20, '{led,panel,600,40w}'),
('EL-LGT-002', 'ELECTRICAL', 'Lighting', 'Downlight', 'LED Downlight 15W Recessed', 'Downlight', 'EA', 'Philips', 'DN130B', 45.00, 0.30, 0.00, 0.15, 1, 0, 0, 15, 8, 5, 20, '{led,downlight,15w}'),
('EL-SWT-001', 'ELECTRICAL', 'Switches', 'Modular', 'Light Switch 2-Gang', '2G Switch', 'EA', 'Schneider', 'AvatarOn', 25.00, 0.25, 0.00, 0.00, 1, 0, 0, 15, 8, 5, 20, '{switch,2gang}'),
('EL-SOC-001', 'ELECTRICAL', 'Sockets', 'Power', 'Twin Power Socket 13A', 'Twin Socket', 'EA', 'Schneider', 'AvatarOn', 30.00, 0.30, 0.00, 0.00, 1, 0, 0, 15, 8, 5, 20, '{socket,twin,13a}'),
('BMS-SEN-003', 'BMS', 'Sensors', 'Humidity', 'Room Humidity Sensor', 'RH Sensor', 'EA', 'Honeywell', 'H7012B1014', 180.00, 0.50, 0.25, 0.00, 1, 0, 0, 15, 8, 5, 20, '{sensor,humidity,room}'),
('BMS-ACT-001', 'BMS', 'Actuators', 'Damper', 'Damper Actuator Spring Return', 'Damper Act', 'EA', 'Honeywell', 'ML7420A', 220.00, 1.00, 0.25, 0.50, 1, 0, 0, 15, 8, 5, 20, '{actuator,damper,spring}')
ON CONFLICT (item_code) DO NOTHING;

-- Seed suppliers
INSERT INTO public.pricing_suppliers (name, contact_person, phone, email, systems_covered, payment_terms_days, preferred) VALUES
  ('Hikvision UAE', 'Mohammed Al Qassim', '+971-4-234-5678', 'sales@hikvision.ae', '{CCTV,INTERCOM}', 30, true),
  ('HID Global Dubai', 'Ahmed Khalil', '+971-4-345-6789', 'orders@hidglobal.ae', '{ACCESS_CONTROL}', 45, true),
  ('Notifier by Honeywell', 'Farid Abbas', '+971-4-456-7890', 'fire@honeywell.ae', '{FIRE_ALARM,BMS}', 30, true),
  ('Panduit MENA', 'Sarah Johnson', '+971-4-567-8901', 'mena@panduit.com', '{STRUCTURED_CABLING}', 60, true),
  ('Schneider Electric UAE', 'Khalid Nasser', '+971-4-678-9012', 'uae@schneider-electric.com', '{ELECTRICAL}', 45, true),
  ('Bosch Security Dubai', 'Layla Hamdan', '+971-4-789-0123', 'security@bosch.ae', '{PA_SYSTEM,CCTV}', 30, false),
  ('BFT Automation', 'Ravi Kumar', '+971-4-890-1234', 'uae@bft.com', '{BARRIERS_GATES}', 30, false),
  ('Nexans Gulf', 'Hassan Iqbal', '+971-4-901-2345', 'gulf@nexans.com', '{STRUCTURED_CABLING,ELECTRICAL}', 45, false)
ON CONFLICT DO NOTHING;
