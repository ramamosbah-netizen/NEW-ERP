-- ============================================================
-- JEET ERP — Phase 10: Platform Consolidation Schema & Seeding
-- unifies RBAC, Audit Logging, Settings, and Mobile Push.
-- ============================================================

-- Reset tables safely
DROP TABLE IF EXISTS public.push_subscriptions CASCADE;
DROP TABLE IF EXISTS public.audit_log CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.role_permissions CASCADE;
DROP TABLE IF EXISTS public.permissions CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;

-- 1. ROLES TABLE
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  hierarchy_level INTEGER NOT NULL DEFAULT 100, -- lower number = higher authority
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. PERMISSIONS CATALOG
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key TEXT UNIQUE NOT NULL,
  module TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. ROLE-PERMISSIONS ASSOCIATION WITH SCOPES
CREATE TABLE public.role_permissions (
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('ALL', 'OWN', 'ASSIGNED', 'TEAM')),
  PRIMARY KEY (role_id, permission_id)
);

-- 4. USER ROLES MAPPING
CREATE TABLE public.user_roles (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, role_id)
);

-- 5. SETTINGS MASTER TABLE
CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  category TEXT NOT NULL CHECK (category IN ('COMPANY', 'FINANCE', 'WORKFLOW', 'HR', 'NOTIFICATIONS', 'INTEGRATIONS')),
  data_type TEXT NOT NULL CHECK (data_type IN ('STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'ARRAY')),
  description TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. UNIFIED AUDIT LOG TABLE
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT,
  action TEXT NOT NULL, -- e.g. 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'EXPORT', 'INVITE'
  entity_type TEXT NOT NULL, -- e.g. 'QUOTATION', 'PO', 'EMPLOYEE', 'VEHICLE', 'ASSET', 'SETTING'
  entity_id UUID NOT NULL,
  entity_label TEXT,
  summary TEXT NOT NULL,
  before JSONB,
  after JSONB,
  ip TEXT,
  source TEXT NOT NULL CHECK (source IN ('UI', 'API', 'CRON', 'WEBHOOK')) DEFAULT 'UI',
  module TEXT NOT NULL -- e.g. 'QUOTATION', 'PROCUREMENT', 'INVENTORY', 'PAYROLL', 'FLEET', 'SYSTEM'
);

-- 7. PUSH NOTIFICATION SUBSCRIPTIONS
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT UNIQUE NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for all newly created tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Dynamic profiles check constraint drop
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- RLS policies: Roles, Permissions, Mapping
CREATE POLICY "Allow authenticated read to roles" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin write to roles" ON public.roles FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

CREATE POLICY "Allow authenticated read to permissions" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin write to permissions" ON public.permissions FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    JOIN public.roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() AND r.role_key = 'admin'
  )
);

CREATE POLICY "Allow authenticated read to role_permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin write to role_permissions" ON public.role_permissions FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    JOIN public.roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() AND r.role_key = 'admin'
  )
);

CREATE POLICY "Allow authenticated read to user_roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin write to user_roles" ON public.user_roles FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- RLS policies: Settings
CREATE POLICY "Allow authenticated read to settings" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin write to settings" ON public.settings FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    JOIN public.roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() AND r.role_key = 'admin'
  )
);

-- RLS policies: Audit Trail
CREATE POLICY "Allow audit read for admin and account" ON public.audit_log FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    JOIN public.roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() AND r.role_key IN ('admin', 'accountant')
  )
);
CREATE POLICY "Allow write to audit_log for logged in sessions" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- RLS policies: Push Subscriptions
CREATE POLICY "Allow push subscriptions management by owner" ON public.push_subscriptions 
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Enforce Immutability Trigger on Audit Log
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit log entries are forensic records and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_immutable_trigger ON public.audit_log;
CREATE TRIGGER audit_log_immutable_trigger
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_modification();

-- Postgres RLS Helper to evaluate scopes
CREATE OR REPLACE FUNCTION public.has_permission(
  p_user_id UUID,
  p_perm_key TEXT,
  p_creator_id UUID DEFAULT NULL,
  p_assigned_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_scope TEXT;
BEGIN
  -- 1. Check if user holds 'admin' role (admin gets instant bypass)
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id AND r.role_key = 'admin' AND r.is_active = true
  ) THEN
    RETURN TRUE;
  END IF;

  -- 2. Resolve highest available scope for the requested permission key
  SELECT rp.scope INTO v_scope
  FROM public.role_permissions rp
  JOIN public.permissions p ON rp.permission_id = p.id
  JOIN public.user_roles ur ON rp.role_id = ur.role_id
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = p_user_id 
    AND p.permission_key = p_perm_key 
    AND r.is_active = true
  ORDER BY 
    CASE rp.scope
      WHEN 'ALL' THEN 1
      WHEN 'TEAM' THEN 2
      WHEN 'ASSIGNED' THEN 3
      WHEN 'OWN' THEN 4
      ELSE 5
    END ASC
  LIMIT 1;

  -- 3. Evaluate scope filters
  IF v_scope IS NULL THEN
    RETURN FALSE;
  ELSIF v_scope = 'ALL' THEN
    RETURN TRUE;
  ELSIF v_scope = 'OWN' AND p_creator_id = p_user_id THEN
    RETURN TRUE;
  ELSIF v_scope = 'ASSIGNED' AND p_assigned_id = p_user_id THEN
    RETURN TRUE;
  ELSIF v_scope = 'TEAM' THEN
    -- In this simple implementation: users in the same department as the creator share access
    -- We retrieve departments from employees table
    DECLARE
      v_user_dept TEXT;
      v_creator_dept TEXT;
    BEGIN
      SELECT department INTO v_user_dept FROM public.employees WHERE user_id = p_user_id LIMIT 1;
      SELECT department INTO v_creator_dept FROM public.employees WHERE user_id = p_creator_id LIMIT 1;
      
      IF v_user_dept IS NOT NULL AND v_user_dept = v_creator_dept THEN
        RETURN TRUE;
      END IF;
    END;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- SEED INITIAL MASTER DATA
-- ============================================================

-- A. Seed Roles
INSERT INTO public.roles (role_key, name, description, hierarchy_level, is_system) VALUES
('admin', 'Administrator', 'Full system control and permission management overrides', 10, true),
('gm', 'General Manager', 'Top tier approval operations, P&L reporting, and disposals authorization', 20, true),
('commercial_mgr', 'Commercial Manager', 'Quotation review, PO pricing margins audit, and contracts sign-off', 30, true),
('pm', 'Project Manager', 'Oversees assigned project BOQs, snags verification, and labour timesheets', 40, true),
('accountant', 'Accountant', 'AR/AP ledgers, VAT period locks, asset depreciation run, and payroll summaries', 50, true),
('hr', 'HR Manager', 'Employee onboarding, air tickets entitlements, and salary payroll processing', 60, true),
('coordinator', 'Service Coordinator', 'Reactive tickets dispatch, AMC contracts setup, and PPM schedule dispatch', 70, true),
('estimator', 'Estimator', 'Prepares client project estimates, BOQ items mapping, and vendor inquiries', 80, true),
('procurement', 'Procurement Officer', 'POs generation, comparison spreadsheets reviewer, and vendor metrics', 80, true),
('storekeeper', 'Storekeeper', 'GRN receipts checking, inventory counts, MRF issues, and tools custody records', 90, true),
('fleet_coordinator', 'Fleet Coordinator', 'Mulkiya renewals, traffic fines mapping, and vehicle maintenance logs', 90, true),
('site_eng', 'Site Engineer', 'Launches material requests, snags logs, daily task completions, and timesheets', 100, true),
('technician', 'Field Technician', 'Closes site service tickets, executes PPM checklists, and logs timesheets', 100, true),
('viewer', 'Auditor/Viewer', 'Read-only audits over projects, transactions, and registry histories', 200, true)
ON CONFLICT (role_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  hierarchy_level = EXCLUDED.hierarchy_level;

-- B. Seed Permissions
INSERT INTO public.permissions (permission_key, module, description) VALUES
-- Quotations
('quotation.view', 'QUOTATION', 'View quotation records and history'),
('quotation.create', 'QUOTATION', 'Prepare new quotations'),
('quotation.update', 'QUOTATION', 'Edit draft quotations'),
('quotation.approve', 'QUOTATION', 'Approve/sign off quotations'),
('quotation.delete', 'QUOTATION', 'Delete draft quotations'),

-- Purchase Orders & GRNs
('po.view', 'PROCUREMENT', 'View purchase orders and delivery logs'),
('po.create', 'PROCUREMENT', 'Draft purchase orders from comparisons'),
('po.update', 'PROCUREMENT', 'Edit draft purchase orders'),
('po.approve', 'PROCUREMENT', 'Authorize purchase orders sign-off'),
('po.delete', 'PROCUREMENT', 'Delete draft purchase orders'),
('grn.view', 'PROCUREMENT', 'View goods receipt notes'),
('grn.create', 'PROCUREMENT', 'Execute goods receipts (inbound)'),

-- Invoices & VAT
('invoice.view', 'FINANCE', 'View customer and supplier invoices'),
('invoice.create', 'FINANCE', 'Draft supplier invoices and LPOs'),
('invoice.approve', 'FINANCE', 'Verify client invoices and process payments'),
('vat.manage', 'FINANCE', 'Run VAT locks and export VAT schedules'),

-- AMC, PPM & Tickets
('amc.view', 'SERVICE', 'View annual maintenance contracts'),
('amc.manage', 'SERVICE', 'Create and modify AMC contracts/SLA tiers'),
('ticket.view', 'SERVICE', 'View reactive service tickets'),
('ticket.create', 'SERVICE', 'Create tickets and log calls'),
('ticket.assign', 'SERVICE', 'Dispatch and assign technicians to visits'),
('ticket.execute', 'SERVICE', 'Perform checklist tasks and close tickets'),

-- T&C and Snags
('tc.view', 'TESTING', 'View testing & commissioning reports'),
('tc.execute', 'TESTING', 'Conduct system parameter checks and upload logs'),
('snag.view', 'TESTING', 'View snag and punch lists'),
('snag.create', 'TESTING', 'Log snags on site with photos'),
('snag.resolve', 'TESTING', 'Mark snags as resolved'),
('snag.verify', 'TESTING', 'Verify resolved snags (pm/gm)'),

-- HR & Payroll
('hr.view_employee', 'HR', 'View employee records, documents and salaries'),
('hr.manage_employee', 'HR', 'Register employees, upload compliance docs, and update compensation'),
('payroll.view', 'HR', 'View payroll summaries and SIF sheets'),
('payroll.process', 'HR', 'Generate payroll runs and apply salary adjustments'),
('timesheet.view', 'HR', 'View timesheet histories'),
('timesheet.submit', 'HR', 'Log hourly timesheet sheets'),
('timesheet.approve', 'HR', 'Approve timesheet hours'),

-- Stores & Tools
('stores.view_stock', 'INVENTORY', 'View stock balances and valuations'),
('stores.manage_stock', 'INVENTORY', 'Modify locations, log counts and adjustments'),
('stores.mrf_create', 'INVENTORY', 'Prepare Material Requisition Forms (MRF)'),
('stores.mrf_approve', 'INVENTORY', 'Approve MRF material allocations'),
('stores.mrf_issue', 'INVENTORY', 'Issue materials from stores to project sites'),
('tools.manage', 'INVENTORY', 'Log calibrations and tools custody allocations'),

-- Fleet & Assets
('fleet.view', 'FLEET', 'View fleet registry and running costs'),
('fleet.manage', 'FLEET', 'Onboard vehicles, register drivers, and log maintenance'),
('fleet.fine_manage', 'FLEET', 'Import police/RTA fine statements and trigger recoveries'),
('assets.view', 'ASSET', 'View capitalized asset register'),
('assets.manage', 'ASSET', 'Capitalize assets and record disposals'),
('assets.depreciate', 'ASSET', 'Trigger monthly depreciation runs and lock periods'),

-- System Config
('settings.manage', 'SYSTEM', 'Configure approval thresholds, calendar templates and keys'),
('users.manage', 'SYSTEM', 'Modify user log-ins, reset keys and verify MFA'),
('roles.manage', 'SYSTEM', 'Modify role-permission matrix mappings'),
('audit.view', 'SYSTEM', 'Search unified forensic logs')
ON CONFLICT (permission_key) DO NOTHING;

-- C. Seed Role-Permissions Map (Effective default permissions)
DO $$
DECLARE
  v_role_admin UUID;
  v_role_gm UUID;
  v_role_comm UUID;
  v_role_pm UUID;
  v_role_account UUID;
  v_role_hr UUID;
  v_role_coord UUID;
  v_role_estimator UUID;
  v_role_proc UUID;
  v_role_keeper UUID;
  v_role_fleet UUID;
  v_role_site_eng UUID;
  v_role_tech UUID;
  v_role_viewer UUID;
  
  v_perm_qview UUID; v_perm_qcreate UUID; v_perm_qupdate UUID; v_perm_qapp UUID;
  v_perm_pview UUID; v_perm_pcreate UUID; v_perm_pupdate UUID; v_perm_papp UUID;
  v_perm_gview UUID; v_perm_gcreate UUID;
  v_perm_iview UUID; v_perm_icreate UUID; v_perm_iapp UUID; v_perm_vat UUID;
  v_perm_amc_v UUID; v_perm_amc_m UUID;
  v_perm_t_v UUID; v_perm_t_c UUID; v_perm_t_a UUID; v_perm_t_e UUID;
  v_perm_tc_v UUID; v_perm_tc_e UUID;
  v_perm_s_v UUID; v_perm_s_c UUID; v_perm_s_r UUID; v_perm_s_ve UUID;
  v_perm_emp_v UUID; v_perm_emp_m UUID;
  v_perm_pay_v UUID; v_perm_pay_p UUID;
  v_perm_time_v UUID; v_perm_time_s UUID; v_perm_time_a UUID;
  v_perm_st_v UUID; v_perm_st_m UUID; v_perm_mrf_c UUID; v_perm_mrf_a UUID; v_perm_mrf_i UUID;
  v_perm_tools UUID;
  v_perm_fl_v UUID; v_perm_fl_m UUID; v_perm_fl_f UUID;
  v_perm_as_v UUID; v_perm_as_m UUID; v_perm_as_d UUID;
  v_perm_set UUID; v_perm_usr UUID; v_perm_rls UUID; v_perm_aud UUID;
BEGIN
  -- Retrieve role IDs
  SELECT id INTO v_role_admin FROM public.roles WHERE role_key = 'admin';
  SELECT id INTO v_role_gm FROM public.roles WHERE role_key = 'gm';
  SELECT id INTO v_role_comm FROM public.roles WHERE role_key = 'commercial_mgr';
  SELECT id INTO v_role_pm FROM public.roles WHERE role_key = 'pm';
  SELECT id INTO v_role_account FROM public.roles WHERE role_key = 'accountant';
  SELECT id INTO v_role_hr FROM public.roles WHERE role_key = 'hr';
  SELECT id INTO v_role_coord FROM public.roles WHERE role_key = 'coordinator';
  SELECT id INTO v_role_estimator FROM public.roles WHERE role_key = 'estimator';
  SELECT id INTO v_role_proc FROM public.roles WHERE role_key = 'procurement';
  SELECT id INTO v_role_keeper FROM public.roles WHERE role_key = 'storekeeper';
  SELECT id INTO v_role_fleet FROM public.roles WHERE role_key = 'fleet_coordinator';
  SELECT id INTO v_role_site_eng FROM public.roles WHERE role_key = 'site_eng';
  SELECT id INTO v_role_tech FROM public.roles WHERE role_key = 'technician';
  SELECT id INTO v_role_viewer FROM public.roles WHERE role_key = 'viewer';

  -- Retrieve permission IDs
  SELECT id INTO v_perm_qview FROM public.permissions WHERE permission_key = 'quotation.view';
  SELECT id INTO v_perm_qcreate FROM public.permissions WHERE permission_key = 'quotation.create';
  SELECT id INTO v_perm_qupdate FROM public.permissions WHERE permission_key = 'quotation.update';
  SELECT id INTO v_perm_qapp FROM public.permissions WHERE permission_key = 'quotation.approve';
  
  SELECT id INTO v_perm_pview FROM public.permissions WHERE permission_key = 'po.view';
  SELECT id INTO v_perm_pcreate FROM public.permissions WHERE permission_key = 'po.create';
  SELECT id INTO v_perm_pupdate FROM public.permissions WHERE permission_key = 'po.update';
  SELECT id INTO v_perm_papp FROM public.permissions WHERE permission_key = 'po.approve';
  
  SELECT id INTO v_perm_gview FROM public.permissions WHERE permission_key = 'grn.view';
  SELECT id INTO v_perm_gcreate FROM public.permissions WHERE permission_key = 'grn.create';
  
  SELECT id INTO v_perm_iview FROM public.permissions WHERE permission_key = 'invoice.view';
  SELECT id INTO v_perm_icreate FROM public.permissions WHERE permission_key = 'invoice.create';
  SELECT id INTO v_perm_iapp FROM public.permissions WHERE permission_key = 'invoice.approve';
  SELECT id INTO v_perm_vat FROM public.permissions WHERE permission_key = 'vat.manage';
  
  SELECT id INTO v_perm_amc_v FROM public.permissions WHERE permission_key = 'amc.view';
  SELECT id INTO v_perm_amc_m FROM public.permissions WHERE permission_key = 'amc.manage';
  
  SELECT id INTO v_perm_t_v FROM public.permissions WHERE permission_key = 'ticket.view';
  SELECT id INTO v_perm_t_c FROM public.permissions WHERE permission_key = 'ticket.create';
  SELECT id INTO v_perm_t_a FROM public.permissions WHERE permission_key = 'ticket.assign';
  SELECT id INTO v_perm_t_e FROM public.permissions WHERE permission_key = 'ticket.execute';
  
  SELECT id INTO v_perm_tc_v FROM public.permissions WHERE permission_key = 'tc.view';
  SELECT id INTO v_perm_tc_e FROM public.permissions WHERE permission_key = 'tc.execute';
  
  SELECT id INTO v_perm_s_v FROM public.permissions WHERE permission_key = 'snag.view';
  SELECT id INTO v_perm_s_c FROM public.permissions WHERE permission_key = 'snag.create';
  SELECT id INTO v_perm_s_r FROM public.permissions WHERE permission_key = 'snag.resolve';
  SELECT id INTO v_perm_s_ve FROM public.permissions WHERE permission_key = 'snag.verify';
  
  SELECT id INTO v_perm_emp_v FROM public.permissions WHERE permission_key = 'hr.view_employee';
  SELECT id INTO v_perm_emp_m FROM public.permissions WHERE permission_key = 'hr.manage_employee';
  
  SELECT id INTO v_perm_pay_v FROM public.permissions WHERE permission_key = 'payroll.view';
  SELECT id INTO v_perm_pay_p FROM public.permissions WHERE permission_key = 'payroll.process';
  
  SELECT id INTO v_perm_time_v FROM public.permissions WHERE permission_key = 'timesheet.view';
  SELECT id INTO v_perm_time_s FROM public.permissions WHERE permission_key = 'timesheet.submit';
  SELECT id INTO v_perm_time_a FROM public.permissions WHERE permission_key = 'timesheet.approve';
  
  SELECT id INTO v_perm_st_v FROM public.permissions WHERE permission_key = 'stores.view_stock';
  SELECT id INTO v_perm_st_m FROM public.permissions WHERE permission_key = 'stores.manage_stock';
  SELECT id INTO v_perm_mrf_c FROM public.permissions WHERE permission_key = 'stores.mrf_create';
  SELECT id INTO v_perm_mrf_a FROM public.permissions WHERE permission_key = 'stores.mrf_approve';
  SELECT id INTO v_perm_mrf_i FROM public.permissions WHERE permission_key = 'stores.mrf_issue';
  SELECT id INTO v_perm_tools FROM public.permissions WHERE permission_key = 'tools.manage';
  
  SELECT id INTO v_perm_fl_v FROM public.permissions WHERE permission_key = 'fleet.view';
  SELECT id INTO v_perm_fl_m FROM public.permissions WHERE permission_key = 'fleet.manage';
  SELECT id INTO v_perm_fl_f FROM public.permissions WHERE permission_key = 'fleet.fine_manage';
  
  SELECT id INTO v_perm_as_v FROM public.permissions WHERE permission_key = 'assets.view';
  SELECT id INTO v_perm_as_m FROM public.permissions WHERE permission_key = 'assets.manage';
  SELECT id INTO v_perm_as_d FROM public.permissions WHERE permission_key = 'assets.depreciate';
  
  SELECT id INTO v_perm_set FROM public.permissions WHERE permission_key = 'settings.manage';
  SELECT id INTO v_perm_usr FROM public.permissions WHERE permission_key = 'users.manage';
  SELECT id INTO v_perm_rls FROM public.permissions WHERE permission_key = 'roles.manage';
  SELECT id INTO v_perm_aud FROM public.permissions WHERE permission_key = 'audit.view';

  -- Clean existing mappings
  DELETE FROM public.role_permissions;

  -- 1. Admin gets EVERYTHING (Scope ALL)
  INSERT INTO public.role_permissions (role_id, permission_id, scope)
  SELECT v_role_admin, id, 'ALL' FROM public.permissions;

  -- 2. General Manager (GM) permissions
  INSERT INTO public.role_permissions (role_id, permission_id, scope) VALUES
  (v_role_gm, v_perm_qview, 'ALL'), (v_role_gm, v_perm_qapp, 'ALL'),
  (v_role_gm, v_perm_pview, 'ALL'), (v_role_gm, v_perm_papp, 'ALL'),
  (v_role_gm, v_perm_gview, 'ALL'), (v_role_gm, v_perm_iview, 'ALL'),
  (v_role_gm, v_perm_iapp, 'ALL'), (v_role_gm, v_perm_vat, 'ALL'),
  (v_role_gm, v_perm_amc_v, 'ALL'), (v_role_gm, v_perm_t_v, 'ALL'),
  (v_role_gm, v_perm_tc_v, 'ALL'), (v_role_gm, v_perm_s_v, 'ALL'),
  (v_role_gm, v_perm_s_ve, 'ALL'), (v_role_gm, v_perm_emp_v, 'ALL'),
  (v_role_gm, v_perm_pay_v, 'ALL'), (v_role_gm, v_perm_time_v, 'ALL'),
  (v_role_gm, v_perm_st_v, 'ALL'), (v_role_gm, v_perm_fl_v, 'ALL'),
  (v_role_gm, v_perm_as_v, 'ALL'), (v_role_gm, v_perm_set, 'ALL'),
  (v_role_gm, v_perm_aud, 'ALL');

  -- 3. Commercial Manager
  INSERT INTO public.role_permissions (role_id, permission_id, scope) VALUES
  (v_role_comm, v_perm_qview, 'ALL'), (v_role_comm, v_perm_qcreate, 'ALL'),
  (v_role_comm, v_perm_qupdate, 'ALL'), (v_role_comm, v_perm_qapp, 'ALL'),
  (v_role_comm, v_perm_pview, 'ALL'), (v_role_comm, v_perm_papp, 'ALL'),
  (v_role_comm, v_perm_iview, 'ALL'), (v_role_comm, v_perm_amc_v, 'ALL'),
  (v_role_comm, v_perm_st_v, 'ALL'), (v_role_comm, v_perm_as_v, 'ALL');

  -- 4. Project Manager (PM)
  INSERT INTO public.role_permissions (role_id, permission_id, scope) VALUES
  (v_role_pm, v_perm_qview, 'ASSIGNED'), (v_role_pm, v_perm_pview, 'ASSIGNED'),
  (v_role_pm, v_perm_gview, 'ASSIGNED'), (v_role_pm, v_perm_amc_v, 'ASSIGNED'),
  (v_role_pm, v_perm_t_v, 'ASSIGNED'), (v_role_pm, v_perm_tc_v, 'ASSIGNED'),
  (v_role_pm, v_perm_s_v, 'ASSIGNED'), (v_role_pm, v_perm_s_ve, 'ASSIGNED'),
  (v_role_pm, v_perm_time_v, 'TEAM'), (v_role_pm, v_perm_time_a, 'TEAM'),
  (v_role_pm, v_perm_st_v, 'ALL'), (v_role_pm, v_perm_mrf_a, 'ASSIGNED'),
  (v_role_pm, v_perm_fl_v, 'ALL');

  -- 5. Accountant
  INSERT INTO public.role_permissions (role_id, permission_id, scope) VALUES
  (v_role_account, v_perm_pview, 'ALL'), (v_role_account, v_perm_iview, 'ALL'),
  (v_role_account, v_perm_icreate, 'ALL'), (v_role_account, v_perm_iapp, 'ALL'),
  (v_role_account, v_perm_vat, 'ALL'), (v_role_account, v_perm_pay_v, 'ALL'),
  (v_role_account, v_perm_time_v, 'ALL'), (v_role_account, v_perm_st_v, 'ALL'),
  (v_role_account, v_perm_fl_v, 'ALL'), (v_role_account, v_perm_as_v, 'ALL'),
  (v_role_account, v_perm_as_m, 'ALL'), (v_role_account, v_perm_as_d, 'ALL');

  -- 6. HR Manager
  INSERT INTO public.role_permissions (role_id, permission_id, scope) VALUES
  (v_role_hr, v_perm_emp_v, 'ALL'), (v_role_hr, v_perm_emp_m, 'ALL'),
  (v_role_hr, v_perm_pay_v, 'ALL'), (v_role_hr, v_perm_pay_p, 'ALL'),
  (v_role_hr, v_perm_time_v, 'ALL');

  -- 7. Service Coordinator
  INSERT INTO public.role_permissions (role_id, permission_id, scope) VALUES
  (v_role_coord, v_perm_amc_v, 'ALL'), (v_role_coord, v_perm_amc_m, 'ALL'),
  (v_role_coord, v_perm_t_v, 'ALL'), (v_role_coord, v_perm_t_c, 'ALL'),
  (v_role_coord, v_perm_t_a, 'ALL'), (v_role_coord, v_perm_fl_v, 'ALL');

  -- 8. Estimator
  INSERT INTO public.role_permissions (role_id, permission_id, scope) VALUES
  (v_role_estimator, v_perm_qview, 'ALL'), (v_role_estimator, v_perm_qcreate, 'ALL'),
  (v_role_estimator, v_perm_qupdate, 'ALL'), (v_role_estimator, v_perm_st_v, 'ALL');

  -- 9. Procurement Officer
  INSERT INTO public.role_permissions (role_id, permission_id, scope) VALUES
  (v_role_proc, v_perm_pview, 'ALL'), (v_role_proc, v_perm_pcreate, 'ALL'),
  (v_role_proc, v_perm_pupdate, 'ALL'), (v_role_proc, v_perm_gview, 'ALL'),
  (v_role_proc, v_perm_st_v, 'ALL');

  -- 10. Storekeeper
  INSERT INTO public.role_permissions (role_id, permission_id, scope) VALUES
  (v_role_keeper, v_perm_gview, 'ALL'), (v_role_keeper, v_perm_gcreate, 'ALL'),
  (v_role_keeper, v_perm_st_v, 'ALL'), (v_role_keeper, v_perm_st_m, 'ALL'),
  (v_role_keeper, v_perm_mrf_i, 'ALL'), (v_role_keeper, v_perm_tools, 'ALL');

  -- 11. Fleet Coordinator
  INSERT INTO public.role_permissions (role_id, permission_id, scope) VALUES
  (v_role_fleet, v_perm_fl_v, 'ALL'), (v_role_fleet, v_perm_fl_m, 'ALL'),
  (v_role_fleet, v_perm_fl_f, 'ALL'), (v_role_fleet, v_perm_as_v, 'ALL');

  -- 12. Site Engineer
  INSERT INTO public.role_permissions (role_id, permission_id, scope) VALUES
  (v_role_site_eng, v_perm_pview, 'ASSIGNED'), (v_role_site_eng, v_perm_gview, 'ASSIGNED'),
  (v_role_site_eng, v_perm_gcreate, 'ASSIGNED'), (v_role_site_eng, v_perm_tc_v, 'ASSIGNED'),
  (v_role_site_eng, v_perm_tc_e, 'ASSIGNED'), (v_role_site_eng, v_perm_s_v, 'ASSIGNED'),
  (v_role_site_eng, v_perm_s_c, 'ASSIGNED'), (v_role_site_eng, v_perm_s_r, 'ASSIGNED'),
  (v_role_site_eng, v_perm_time_s, 'OWN'), (v_role_site_eng, v_perm_mrf_c, 'ASSIGNED');

  -- 13. Field Technician
  INSERT INTO public.role_permissions (role_id, permission_id, scope) VALUES
  (v_role_tech, v_perm_t_v, 'ASSIGNED'), (v_role_tech, v_perm_t_e, 'ASSIGNED'),
  (v_role_tech, v_perm_time_s, 'OWN'), (v_role_tech, v_perm_fl_v, 'OWN');

  -- 14. Viewer gets read-only (Scope ALL)
  INSERT INTO public.role_permissions (role_id, permission_id, scope) VALUES
  (v_role_viewer, v_perm_qview, 'ALL'), (v_role_viewer, v_perm_pview, 'ALL'),
  (v_role_viewer, v_perm_gview, 'ALL'), (v_role_viewer, v_perm_iview, 'ALL'),
  (v_role_viewer, v_perm_amc_v, 'ALL'), (v_role_viewer, v_perm_t_v, 'ALL'),
  (v_role_viewer, v_perm_tc_v, 'ALL'), (v_role_viewer, v_perm_s_v, 'ALL'),
  (v_role_viewer, v_perm_emp_v, 'ALL'), (v_role_viewer, v_perm_time_v, 'ALL'),
  (v_role_viewer, v_perm_st_v, 'ALL'), (v_role_viewer, v_perm_fl_v, 'ALL'),
  (v_role_viewer, v_perm_as_v, 'ALL');

END $$;

-- D. Seed Master Settings
INSERT INTO public.settings (key, value, category, data_type, description) VALUES
('finance.vat_rate', '5.00'::jsonb, 'FINANCE', 'NUMBER', 'Standard UAE Value Added Tax (VAT) rate in percentage'),
('finance.vat_period_months', '3'::jsonb, 'FINANCE', 'NUMBER', 'VAT filing period length in months'),
('finance.approval_threshold_quotation', '50000.00'::jsonb, 'FINANCE', 'NUMBER', 'Financial quote threshold requiring General Manager approval'),
('finance.approval_threshold_po', '20000.00'::jsonb, 'FINANCE', 'NUMBER', 'Purchase order threshold requiring General Manager approval'),
('fleet.depreciation_lives_months', '{"VEHICLE": 60, "IT_EQUIPMENT": 36, "TOOLS_INSTRUMENTS": 48, "OFFICE_FURNITURE": 84, "SOFTWARE": 36}'::jsonb, 'FINANCE', 'JSON', 'Standard useful life conventions in months for Straight-Line depreciation category defaults'),
('workflow.business_hours', '{"start": "08:00", "end": "17:00", "working_days": [0, 1, 2, 3, 4]}'::jsonb, 'WORKFLOW', 'JSON', 'Weekly business operating hours (Sunday=0 to Thursday=4)'),
('payroll.gratuity_entitlement_days', '{"under_1yr": 0, "1to5yr": 21, "above5yr": 30}'::jsonb, 'HR', 'JSON', 'UAE Labor Law standard End-of-Service gratuity accrual day rate scales per year of employment'),
('notifications.channel_toggles', '{"email": true, "whatsapp": true, "push": true}'::jsonb, 'NOTIFICATIONS', 'JSON', 'System wide notification channel status variables')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;

-- E. Auto-assign admin role to existing admin users
INSERT INTO public.user_roles (user_id, role_id)
SELECT p.id, r.id
FROM public.profiles p
CROSS JOIN public.roles r
WHERE p.role = 'admin' AND r.role_key = 'admin'
ON CONFLICT DO NOTHING;

-- Auto-assign default roles based on profiles table metadata mapping
INSERT INTO public.user_roles (user_id, role_id)
SELECT p.id, r.id
FROM public.profiles p
JOIN public.roles r ON 
  (p.role = 'manager' AND r.role_key = 'pm') OR 
  (p.role = 'account' AND r.role_key = 'accountant') OR 
  (p.role = 'storekeeper' AND r.role_key = 'storekeeper') OR 
  (p.role = 'engineer' AND r.role_key = 'site_eng')
ON CONFLICT DO NOTHING;

-- Ensure all missing relationships/foreign keys for meetings and service_tickets are present
ALTER TABLE public.meetings DROP CONSTRAINT IF EXISTS meetings_project_id_projects_fkey;
ALTER TABLE public.meetings ADD CONSTRAINT meetings_project_id_projects_fkey 
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
  
ALTER TABLE public.meetings DROP CONSTRAINT IF EXISTS meetings_organizer_id_profiles_fkey;
ALTER TABLE public.meetings ADD CONSTRAINT meetings_organizer_id_profiles_fkey 
  FOREIGN KEY (organizer_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.service_tickets DROP CONSTRAINT IF EXISTS service_tickets_client_id_clients_fkey;
ALTER TABLE public.service_tickets ADD CONSTRAINT service_tickets_client_id_clients_fkey 
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.service_tickets DROP CONSTRAINT IF EXISTS service_tickets_project_id_projects_fkey;
ALTER TABLE public.service_tickets ADD CONSTRAINT service_tickets_project_id_projects_fkey 
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.service_tickets DROP CONSTRAINT IF EXISTS service_tickets_technician_id_profiles_fkey;
ALTER TABLE public.service_tickets ADD CONSTRAINT service_tickets_technician_id_profiles_fkey 
  FOREIGN KEY (technician_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.service_tickets DROP CONSTRAINT IF EXISTS service_tickets_chargeable_quote_id_quotations_fkey;
ALTER TABLE public.service_tickets ADD CONSTRAINT service_tickets_chargeable_quote_id_quotations_fkey 
  FOREIGN KEY (chargeable_quote_id) REFERENCES public.quotations(id) ON DELETE SET NULL;

ALTER TABLE public.service_tickets DROP CONSTRAINT IF EXISTS service_tickets_invoice_id_client_invoices_fkey;
ALTER TABLE public.service_tickets ADD CONSTRAINT service_tickets_invoice_id_client_invoices_fkey 
  FOREIGN KEY (invoice_id) REFERENCES public.client_invoices(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';

