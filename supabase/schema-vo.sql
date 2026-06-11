-- ============================================================
-- JEET ERP — Variation Order (VO) Module Schema
-- Location: supabase/schema-vo.sql
-- ============================================================

-- Reset tables safely
DROP TABLE IF EXISTS public.vo_status_history CASCADE;
DROP TABLE IF EXISTS public.vo_items CASCADE;
DROP TABLE IF EXISTS public.variation_orders CASCADE;
DROP TABLE IF EXISTS public.vo_number_sequences CASCADE;

-- ============================================================
-- 1. AUTO-NUMBERING SEQUENCES
-- ============================================================
CREATE TABLE public.vo_number_sequences (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.vo_number_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on vo_number_sequences" ON public.vo_number_sequences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on vo_number_sequences" ON public.vo_number_sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 2. PROJECTS TABLE SEAM COLUMNS
-- ============================================================
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS vo_total_sell NUMERIC(14,2) DEFAULT 0.00 NOT NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS vo_count INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS revised_contract_value NUMERIC(14,2) GENERATED ALWAYS AS (original_contract_value + vo_total_sell) STORED;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS revised_end_date DATE;

-- Set initial values for revised_end_date
UPDATE public.projects SET revised_end_date = planned_end_date WHERE revised_end_date IS NULL;

-- ============================================================
-- 3. VARIATION ORDERS
-- ============================================================
CREATE TABLE public.variation_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vo_number TEXT UNIQUE NOT NULL,
  project_vo_sequence INTEGER NOT NULL, -- per-project number: 1, 2, 3...
  project_id UUID REFERENCES public.projects(id) ON DELETE RESTRICT NOT NULL,
  title TEXT NOT NULL,
  vo_type TEXT NOT NULL CHECK (vo_type IN ('ADDITION', 'OMISSION', 'SUBSTITUTION', 'RATE_CHANGE', 'DAYWORKS', 'PROVISIONAL_SUM_ADJ')),
  origin TEXT NOT NULL CHECK (origin IN ('CLIENT_INSTRUCTION', 'SITE_INSTRUCTION', 'CONSULTANT', 'RFI', 'DESIGN_CHANGE', 'SITE_CONDITION')),
  instruction_reference TEXT NOT NULL,
  instruction_date DATE NOT NULL,
  instruction_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  description TEXT,
  justification TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'PRICED', 'PENDING_INTERNAL', 'INTERNALLY_APPROVED', 'SUBMITTED_TO_CLIENT', 
    'CLIENT_APPROVED', 'CLIENT_REJECTED', 'REVISED', 'SUPERSEDED', 'CANCELLED'
  )),
  pricing_basis TEXT NOT NULL CHECK (pricing_basis IN ('BOQ_RATES', 'NEW_RATES', 'DAYWORKS', 'NEGOTIATED')),
  cost_amount NUMERIC(14,2) DEFAULT 0.00 NOT NULL,
  sell_amount NUMERIC(14,2) DEFAULT 0.00 NOT NULL,
  vat_amount NUMERIC(14,2) DEFAULT 0.00 NOT NULL,
  total_incl_vat NUMERIC(14,2) DEFAULT 0.00 NOT NULL,
  time_impact_days INTEGER DEFAULT 0 NOT NULL,
  work_status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK (work_status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
  proceed_at_risk BOOLEAN DEFAULT false NOT NULL,
  client_approval_ref TEXT,
  client_approval_date DATE,
  client_approval_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  cancel_reason TEXT,
  pdf_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.variation_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on variation_orders" ON public.variation_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on variation_orders" ON public.variation_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexing
CREATE INDEX idx_vo_project ON public.variation_orders (project_id);
CREATE INDEX idx_vo_status ON public.variation_orders (status);
CREATE INDEX idx_vo_number ON public.variation_orders (vo_number);

-- ============================================================
-- 4. VO ITEMS
-- ============================================================
CREATE TABLE public.vo_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vo_id UUID REFERENCES public.variation_orders(id) ON DELETE CASCADE NOT NULL,
  line_no INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('ADD', 'OMIT', 'RE_RATE')),
  pricing_item_id UUID REFERENCES public.pricing_items(id) ON DELETE SET NULL,
  boq_item_ref TEXT, -- Links to original BOQ line identifier for omissions/re-rates
  description TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL, -- negative for omissions
  unit_cost NUMERIC(12,4) NOT NULL,
  unit_sell NUMERIC(12,4) NOT NULL,
  line_cost NUMERIC(14,2) NOT NULL,
  line_sell NUMERIC(14,2) NOT NULL,
  system TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT unique_vo_line UNIQUE (vo_id, line_no)
);

ALTER TABLE public.vo_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on vo_items" ON public.vo_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on vo_items" ON public.vo_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_vo_items_vo ON public.vo_items (vo_id);

-- ============================================================
-- 5. VO STATUS HISTORY
-- ============================================================
CREATE TABLE public.vo_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vo_id UUID REFERENCES public.variation_orders(id) ON DELETE CASCADE NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  comment TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.vo_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on vo_status_history" ON public.vo_status_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on vo_status_history" ON public.vo_status_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_vo_sh_vo ON public.vo_status_history (vo_id);

-- ============================================================
-- 6. AUTONUMBERING & SEQUENCE TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_vo_numbers()
RETURNS TRIGGER AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
  proj_seq INTEGER;
BEGIN
  -- 1. Generate Global VO Number (JI-VO-YYYY-NNN)
  IF NEW.vo_number IS NULL OR NEW.vo_number = '' THEN
    current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
    LOCK TABLE public.vo_number_sequences IN SHARE ROW EXCLUSIVE MODE;

    INSERT INTO public.vo_number_sequences (year, last_number)
    VALUES (current_year, 1)
    ON CONFLICT (year) DO UPDATE
    SET last_number = vo_number_sequences.last_number + 1
    RETURNING last_number INTO next_number;

    NEW.vo_number := 'JI-VO-' || current_year::TEXT || '-' || LPAD(next_number::TEXT, 3, '0');
  END IF;

  -- 2. Generate Per-Project Display Sequence (VO-NN)
  IF NEW.project_vo_sequence IS NULL OR NEW.project_vo_sequence = 0 THEN
    SELECT COALESCE(MAX(project_vo_sequence), 0) + 1
    INTO proj_seq
    FROM public.variation_orders
    WHERE project_id = NEW.project_id;
    
    NEW.project_vo_sequence := proj_seq;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_set_vo_numbers
  BEFORE INSERT ON public.variation_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_vo_numbers();

-- ============================================================
-- 7. RECALCULATION TRIGGERS ON PROJECTS
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalculate_project_vo_totals(p_project_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_sell NUMERIC(14,2);
  v_count INTEGER;
  v_time_impact_days INTEGER;
  v_planned_end_date DATE;
BEGIN
  -- Sum sell_amount of CLIENT_APPROVED variation orders
  SELECT COALESCE(SUM(sell_amount), 0), COUNT(*)
  INTO v_total_sell, v_count
  FROM public.variation_orders
  WHERE project_id = p_project_id AND status = 'CLIENT_APPROVED' AND is_active = true;

  -- Sum time impact
  SELECT COALESCE(SUM(time_impact_days), 0)
  INTO v_time_impact_days
  FROM public.variation_orders
  WHERE project_id = p_project_id AND status = 'CLIENT_APPROVED' AND is_active = true;

  -- Get planned end date
  SELECT planned_end_date INTO v_planned_end_date
  FROM public.projects
  WHERE id = p_project_id;

  -- Update project
  UPDATE public.projects
  SET 
    vo_total_sell = v_total_sell,
    vo_count = v_count,
    revised_end_date = CASE WHEN v_planned_end_date IS NOT NULL THEN v_planned_end_date + v_time_impact_days ELSE NULL END,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.after_vo_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM public.recalculate_project_vo_totals(NEW.project_id);
    -- If project changed, also update the old project
    IF TG_OP = 'UPDATE' AND OLD.project_id <> NEW.project_id THEN
      PERFORM public.recalculate_project_vo_totals(OLD.project_id);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_project_vo_totals(OLD.project_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_vo_change
  AFTER INSERT OR UPDATE OR DELETE ON public.variation_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.after_vo_change();

-- ============================================================
-- 8. SEED PERMISSIONS AND ROLE MAPPINGS
-- ============================================================
DO $$
DECLARE
  v_role_admin UUID;
  v_role_gm UUID;
  v_role_comm UUID;
  v_role_pm UUID;
  v_role_estimator UUID;
  v_role_site_eng UUID;
  
  v_perm_create UUID;
  v_perm_price UUID;
  v_perm_approve UUID;
  v_perm_submit UUID;
  v_perm_record UUID;
  v_perm_cancel UUID;
BEGIN
  -- 1. Insert permissions
  INSERT INTO public.permissions (permission_key, module, description) VALUES
  ('vo.create', 'COMMERCIAL', 'Create and capture Variation Orders'),
  ('vo.price', 'COMMERCIAL', 'Price Variation Orders'),
  ('vo.approve_internal', 'COMMERCIAL', 'Approve Variation Orders internally'),
  ('vo.submit_client', 'COMMERCIAL', 'Submit Variation Orders to client'),
  ('vo.record_approval', 'COMMERCIAL', 'Record client approval for Variation Orders'),
  ('vo.cancel', 'COMMERCIAL', 'Cancel Variation Orders')
  ON CONFLICT (permission_key) DO UPDATE SET
    module = EXCLUDED.module,
    description = EXCLUDED.description;

  -- Get role IDs
  SELECT id INTO v_role_admin FROM public.roles WHERE role_key = 'admin';
  SELECT id INTO v_role_gm FROM public.roles WHERE role_key = 'gm';
  SELECT id INTO v_role_comm FROM public.roles WHERE role_key = 'commercial_mgr';
  SELECT id INTO v_role_pm FROM public.roles WHERE role_key = 'pm';
  SELECT id INTO v_role_estimator FROM public.roles WHERE role_key = 'estimator';
  SELECT id INTO v_role_site_eng FROM public.roles WHERE role_key = 'site_eng';

  -- Get permission IDs
  SELECT id INTO v_perm_create FROM public.permissions WHERE permission_key = 'vo.create';
  SELECT id INTO v_perm_price FROM public.permissions WHERE permission_key = 'vo.price';
  SELECT id INTO v_perm_approve FROM public.permissions WHERE permission_key = 'vo.approve_internal';
  SELECT id INTO v_perm_submit FROM public.permissions WHERE permission_key = 'vo.submit_client';
  SELECT id INTO v_perm_record FROM public.permissions WHERE permission_key = 'vo.record_approval';
  SELECT id INTO v_perm_cancel FROM public.permissions WHERE permission_key = 'vo.cancel';

  -- Clean existing mappings for these permissions to prevent constraints conflicts
  DELETE FROM public.role_permissions WHERE permission_id IN (v_perm_create, v_perm_price, v_perm_approve, v_perm_submit, v_perm_record, v_perm_cancel);

  -- 2. Admin: ALL scopes
  INSERT INTO public.role_permissions (role_id, permission_id, scope) VALUES
  (v_role_admin, v_perm_create, 'ALL'),
  (v_role_admin, v_perm_price, 'ALL'),
  (v_role_admin, v_perm_approve, 'ALL'),
  (v_role_admin, v_perm_submit, 'ALL'),
  (v_role_admin, v_perm_record, 'ALL'),
  (v_role_admin, v_perm_cancel, 'ALL');

  -- 3. GM: ALL scopes
  INSERT INTO public.role_permissions (role_id, permission_id, scope) VALUES
  (v_role_gm, v_perm_create, 'ALL'),
  (v_role_gm, v_perm_price, 'ALL'),
  (v_role_gm, v_perm_approve, 'ALL'),
  (v_role_gm, v_perm_submit, 'ALL'),
  (v_role_gm, v_perm_record, 'ALL'),
  (v_role_gm, v_perm_cancel, 'ALL');

  -- 4. Commercial Manager: ALL scopes
  INSERT INTO public.role_permissions (role_id, permission_id, scope) VALUES
  (v_role_comm, v_perm_create, 'ALL'),
  (v_role_comm, v_perm_price, 'ALL'),
  (v_role_comm, v_perm_approve, 'ALL'),
  (v_role_comm, v_perm_submit, 'ALL'),
  (v_role_comm, v_perm_record, 'ALL'),
  (v_role_comm, v_perm_cancel, 'ALL');

  -- 5. PM: ASSIGNED scopes
  INSERT INTO public.role_permissions (role_id, permission_id, scope) VALUES
  (v_role_pm, v_perm_create, 'ASSIGNED'),
  (v_role_pm, v_perm_price, 'ASSIGNED'),
  (v_role_pm, v_perm_submit, 'ASSIGNED'),
  (v_role_pm, v_perm_record, 'ASSIGNED');

  -- 6. Estimator: ALL scopes
  INSERT INTO public.role_permissions (role_id, permission_id, scope) VALUES
  (v_role_estimator, v_perm_create, 'ALL'),
  (v_role_estimator, v_perm_price, 'ALL'),
  (v_role_estimator, v_perm_submit, 'ALL');

  -- 7. Site Engineer: ASSIGNED scope for creation
  INSERT INTO public.role_permissions (role_id, permission_id, scope) VALUES
  (v_role_site_eng, v_perm_create, 'ASSIGNED');

END $$;
