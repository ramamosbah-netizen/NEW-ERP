-- ============================================================
-- JEET ERP — AMC, PPM & Service Call-Outs Module Schema
-- Handles: AMC Contracts, Asset Register, Billing Schedules,
-- PPM Visits, Checklists, Service Tickets & SLA audit events.
-- ============================================================

-- Alter public.profiles role constraint & trigger to add technician and coordinator roles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_profiles_role;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles ADD CONSTRAINT check_profiles_role CHECK (role IN (
  'admin', 'manager', 'account', 'engineer', 'storekeeper', 'technician', 'coordinator'
));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role text;
  input_role text;
BEGIN
  input_role := new.raw_user_meta_data->>'role';
  
  IF input_role IN ('admin', 'manager', 'account', 'engineer', 'storekeeper', 'technician', 'coordinator') THEN
    assigned_role := input_role;
  ELSE
    assigned_role := 'engineer';
  END IF;

  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'New ERP User'),
    COALESCE(new.email, ''),
    assigned_role
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Alter quotations to add AMC fields
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS is_amc BOOLEAN DEFAULT false;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS amc_coverage JSONB;

-- Reset tables safely
DROP TABLE IF EXISTS public.ticket_events CASCADE;
DROP TABLE IF EXISTS public.service_tickets CASCADE;
DROP TABLE IF EXISTS public.ppm_visit_checklist_results CASCADE;
DROP TABLE IF EXISTS public.ppm_visits CASCADE;
DROP TABLE IF EXISTS public.checklist_template_items CASCADE;
DROP TABLE IF EXISTS public.checklist_templates CASCADE;
DROP TABLE IF EXISTS public.amc_billing_schedule CASCADE;
DROP TABLE IF EXISTS public.amc_equipment CASCADE;
DROP TABLE IF EXISTS public.amc_contracts CASCADE;
DROP TABLE IF EXISTS public.company_holidays CASCADE;

DROP TABLE IF EXISTS public.amc_contract_sequences CASCADE;
DROP TABLE IF EXISTS public.service_ticket_sequences CASCADE;

-- ============================================================
-- 1. AUTO-NUMBERING SEQUENCES
-- ============================================================

CREATE TABLE public.amc_contract_sequences (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.amc_contract_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on amc_contract_sequences" ON public.amc_contract_sequences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on amc_contract_sequences" ON public.amc_contract_sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.service_ticket_sequences (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.service_ticket_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on service_ticket_sequences" ON public.service_ticket_sequences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on service_ticket_sequences" ON public.service_ticket_sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 2. COMPANY HOLIDAYS (For SLA calculations)
-- ============================================================

CREATE TABLE public.company_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE UNIQUE NOT NULL,
  description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.company_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on company_holidays" ON public.company_holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin write on company_holidays" ON public.company_holidays FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 3. AMC CONTRACTS
-- ============================================================

CREATE TABLE public.amc_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number TEXT UNIQUE NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE RESTRICT NOT NULL,
  
  -- Client Snapshot
  client_name TEXT NOT NULL,
  client_trn TEXT,
  client_address TEXT,
  
  site_name TEXT NOT NULL,
  site_address TEXT NOT NULL,
  emirate TEXT NOT NULL CHECK (emirate IN ('DUBAI', 'ABU_DHABI', 'SHARJAH', 'AJMAN', 'UMM_AL_QUWAIN', 'RAS_AL_KHAIMAH', 'FUJAIRAH')),
  
  origin_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  origin_quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
  
  contract_type TEXT NOT NULL CHECK (contract_type IN ('COMPREHENSIVE', 'NON_COMPREHENSIVE', 'LABOUR_ONLY')),
  systems TEXT[] NOT NULL DEFAULT '{}'::text[],
  coverage_matrix JSONB NOT NULL DEFAULT '{}'::jsonb,
  parts_included BOOLEAN NOT NULL DEFAULT false,
  parts_cap_aed NUMERIC(14,2),
  visits_per_year INTEGER NOT NULL DEFAULT 4 CHECK (visits_per_year > 0),
  
  sla_tier TEXT NOT NULL CHECK (sla_tier IN ('STANDARD', 'PRIORITY', 'CRITICAL')),
  response_hours INTEGER NOT NULL DEFAULT 24,
  resolution_hours INTEGER NOT NULL DEFAULT 48,
  
  emergency_callouts_included INTEGER,
  annual_value NUMERIC(14,2) NOT NULL,
  billing_frequency TEXT NOT NULL CHECK (billing_frequency IN ('ANNUAL_ADVANCE', 'SEMI_ANNUAL', 'QUARTERLY', 'MONTHLY')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  auto_renewal BOOLEAN NOT NULL DEFAULT false,
  sira_linked BOOLEAN NOT NULL DEFAULT false,
  sira_expiry_date DATE,
  
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'RENEWED', 'TERMINATED', 'SUSPENDED'
  )),
  
  renewed_to_id UUID REFERENCES public.amc_contracts(id) ON DELETE SET NULL,
  renewed_from_id UUID REFERENCES public.amc_contracts(id) ON DELETE SET NULL,
  
  termination_reason TEXT,
  contract_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.amc_contracts ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 4. AMC EQUIPMENT (Asset Register)
-- ============================================================

CREATE TABLE public.amc_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.amc_contracts(id) ON DELETE CASCADE NOT NULL,
  system TEXT NOT NULL,
  equipment_type TEXT NOT NULL, -- dome, bullet, nvr, barrier, etc.
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  serial_no TEXT,
  location_label TEXT NOT NULL,
  install_date DATE,
  condition TEXT NOT NULL CHECK (condition IN ('GOOD', 'FAIR', 'POOR', 'FAULTY')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.amc_equipment ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 5. AMC BILLING SCHEDULE
-- ============================================================

CREATE TABLE public.amc_billing_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.amc_contracts(id) ON DELETE CASCADE NOT NULL,
  sequence INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'INVOICED', 'PAID')),
  invoice_id UUID REFERENCES public.client_invoices(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.amc_billing_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on amc_billing_schedule" ON public.amc_billing_schedule FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow staff write on amc_billing_schedule" ON public.amc_billing_schedule FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 6. PPM VISITS
-- ============================================================

CREATE TABLE public.ppm_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.amc_contracts(id) ON DELETE CASCADE NOT NULL,
  visit_number TEXT NOT NULL,
  target_month DATE NOT NULL, -- first day of month target
  scheduled_date DATE,
  scheduled_slot TEXT CHECK (scheduled_slot IN ('AM', 'PM')),
  technician_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  second_technician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'UNSCHEDULED' CHECK (status IN (
    'UNSCHEDULED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'MISSED', 'CANCELLED'
  )),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  client_notified_at TIMESTAMP WITH TIME ZONE,
  report_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  client_signature_storage_path TEXT,
  client_sign_name TEXT,
  client_sign_designation TEXT,
  summary TEXT,
  recommendations TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.ppm_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select on ppm_visits" ON public.ppm_visits
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'technician'
    OR
    technician_id = auth.uid() OR second_technician_id = auth.uid()
  );

CREATE POLICY "Allow update on ppm_visits" ON public.ppm_visits
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'technician'
    OR
    technician_id = auth.uid() OR second_technician_id = auth.uid()
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'technician'
    OR
    technician_id = auth.uid() OR second_technician_id = auth.uid()
  );

CREATE POLICY "Allow coordinators create/delete ppm_visits" ON public.ppm_visits
  FOR ALL TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'technician')
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'technician');

-- ============================================================
-- 7. CHECKLIST TEMPLATES
-- ============================================================

CREATE TABLE public.checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  system TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on checklist_templates" ON public.checklist_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin write on checklist_templates" ON public.checklist_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.checklist_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.checklist_templates(id) ON DELETE CASCADE NOT NULL,
  item_text TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('PASS_FAIL', 'VALUE', 'TEXT', 'PHOTO_REQUIRED')),
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.checklist_template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on checklist_template_items" ON public.checklist_template_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin write on checklist_template_items" ON public.checklist_template_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 8. PPM VISIT CHECKLIST RESULTS
-- ============================================================

CREATE TABLE public.ppm_visit_checklist_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES public.ppm_visits(id) ON DELETE CASCADE NOT NULL,
  template_item_id UUID REFERENCES public.checklist_template_items(id) ON DELETE RESTRICT NOT NULL,
  equipment_id UUID REFERENCES public.amc_equipment(id) ON DELETE SET NULL,
  result TEXT NOT NULL CHECK (result IN ('PASS', 'FAIL', 'NA')),
  value TEXT,
  photo_paths TEXT[] NOT NULL DEFAULT '{}'::text[],
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.ppm_visit_checklist_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select on checklist_results" ON public.ppm_visit_checklist_results
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'technician'
    OR
    visit_id IN (SELECT id FROM public.ppm_visits WHERE technician_id = auth.uid() OR second_technician_id = auth.uid())
  );

CREATE POLICY "Allow write on checklist_results" ON public.ppm_visit_checklist_results
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'technician'
    OR
    visit_id IN (SELECT id FROM public.ppm_visits WHERE technician_id = auth.uid() OR second_technician_id = auth.uid())
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'technician'
    OR
    visit_id IN (SELECT id FROM public.ppm_visits WHERE technician_id = auth.uid() OR second_technician_id = auth.uid())
  );

-- ============================================================
-- 9. SERVICE TICKETS (Call-Outs)
-- ============================================================

CREATE TABLE public.service_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT UNIQUE NOT NULL,
  intake_channel TEXT NOT NULL CHECK (intake_channel IN ('MANUAL', 'PHONE', 'EMAIL', 'WHATSAPP')),
  client_id UUID REFERENCES public.clients(id) ON DELETE RESTRICT,
  contract_id UUID REFERENCES public.amc_contracts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL, -- for warranty tracking
  
  site_address TEXT NOT NULL,
  system TEXT NOT NULL,
  equipment_id UUID REFERENCES public.amc_equipment(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reported_by_name TEXT NOT NULL,
  reported_by_phone TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'EMERGENCY')),
  coverage TEXT NOT NULL CHECK (coverage IN ('COVERED', 'CHARGEABLE', 'WARRANTY')),
  
  sla_response_due TIMESTAMP WITH TIME ZONE NOT NULL,
  sla_resolution_due TIMESTAMP WITH TIME ZONE NOT NULL,
  sla_paused_at TIMESTAMP WITH TIME ZONE,
  sla_pause_total_minutes INTEGER DEFAULT 0 NOT NULL,
  response_met BOOLEAN,
  resolution_met BOOLEAN,
  
  technician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN (
    'NEW', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD_PARTS', 'RESOLVED', 'CLOSED', 'CANCELLED', 'DUPLICATE'
  )),
  resolution_summary TEXT,
  parts_used JSONB NOT NULL DEFAULT '[]'::jsonb, -- detail items picker
  client_signature_path TEXT,
  sign_name TEXT,
  
  chargeable_quote_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.client_invoices(id) ON DELETE SET NULL,
  source_conversation_id TEXT, -- whatsapp channel link
  
  created_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.service_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select on service_tickets" ON public.service_tickets
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'technician'
    OR
    technician_id = auth.uid()
  );

CREATE POLICY "Allow update on service_tickets" ON public.service_tickets
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'technician'
    OR
    technician_id = auth.uid()
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'technician'
    OR
    technician_id = auth.uid()
  );

CREATE POLICY "Allow coordinator write on service_tickets" ON public.service_tickets
  FOR ALL TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'technician')
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'technician');

-- ============================================================
-- 10. TICKET EVENTS (Comments thread)
-- ============================================================

CREATE TABLE public.ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.service_tickets(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('STATUS_CHANGE', 'COMMENT', 'ASSIGNMENT', 'SLA_WARNING', 'CLIENT_UPDATE_SENT')),
  body TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.ticket_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select on ticket_events" ON public.ticket_events
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'technician'
    OR
    ticket_id IN (SELECT id FROM public.service_tickets WHERE technician_id = auth.uid())
  );

CREATE POLICY "Allow insert on ticket_events" ON public.ticket_events
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'technician'
    OR
    ticket_id IN (SELECT id FROM public.service_tickets WHERE technician_id = auth.uid())
  );

-- ============================================================
-- 10B. LATE POLICIES (Moved to resolve forward references)
-- ============================================================

-- Technician can select only contracts they have assigned visits/tickets for
CREATE POLICY "Allow technician select assigned contracts" ON public.amc_contracts
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'technician'
    OR
    id IN (
      SELECT contract_id FROM public.ppm_visits WHERE technician_id = auth.uid() OR second_technician_id = auth.uid()
      UNION
      SELECT contract_id FROM public.service_tickets WHERE technician_id = auth.uid()
    )
  );

-- All other roles can select and write on contracts
CREATE POLICY "Allow staff write on amc_contracts" ON public.amc_contracts
  FOR ALL TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'technician')
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'technician');

CREATE POLICY "Allow technician select assigned equipment" ON public.amc_equipment
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'technician'
    OR
    contract_id IN (
      SELECT contract_id FROM public.ppm_visits WHERE technician_id = auth.uid() OR second_technician_id = auth.uid()
      UNION
      SELECT contract_id FROM public.service_tickets WHERE technician_id = auth.uid()
    )
  );

CREATE POLICY "Allow staff write on amc_equipment" ON public.amc_equipment
  FOR ALL TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'technician')
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'technician');

-- ============================================================
-- 11. AUTONUMBERING TRIGGERS & FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_amc_contract_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
BEGIN
  IF NEW.contract_number IS NOT NULL AND NEW.contract_number <> '' THEN
    RETURN NEW;
  END IF;

  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  LOCK TABLE public.amc_contract_sequences IN SHARE ROW EXCLUSIVE MODE;

  INSERT INTO public.amc_contract_sequences (year, last_number)
  VALUES (current_year, 1)
  ON CONFLICT (year) DO UPDATE
  SET last_number = amc_contract_sequences.last_number + 1
  RETURNING last_number INTO next_number;

  NEW.contract_number := 'JI-AMC-' || current_year::TEXT || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_set_amc_contract_number
  BEFORE INSERT ON public.amc_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_amc_contract_number();


CREATE OR REPLACE FUNCTION public.set_service_ticket_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
BEGIN
  IF NEW.ticket_number IS NOT NULL AND NEW.ticket_number <> '' THEN
    RETURN NEW;
  END IF;

  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  LOCK TABLE public.service_ticket_sequences IN SHARE ROW EXCLUSIVE MODE;

  INSERT INTO public.service_ticket_sequences (year, last_number)
  VALUES (current_year, 1)
  ON CONFLICT (year) DO UPDATE
  SET last_number = service_ticket_sequences.last_number + 1
  RETURNING last_number INTO next_number;

  NEW.ticket_number := 'JI-SRV-' || current_year::TEXT || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_set_service_ticket_number
  BEFORE INSERT ON public.service_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_service_ticket_number();

-- ============================================================
-- 12. PERFORMANCE INDEXES
-- ============================================================

CREATE INDEX idx_amc_contracts_client ON public.amc_contracts (client_id);
CREATE INDEX idx_amc_contracts_status ON public.amc_contracts (status);
CREATE INDEX idx_amc_contracts_dates ON public.amc_contracts (start_date, end_date);

CREATE INDEX idx_amc_equipment_contract ON public.amc_equipment (contract_id);
CREATE INDEX idx_amc_equipment_system ON public.amc_equipment (system);

CREATE INDEX idx_ppm_visits_contract ON public.ppm_visits (contract_id);
CREATE INDEX idx_ppm_visits_tech ON public.ppm_visits (technician_id);
CREATE INDEX idx_ppm_visits_status ON public.ppm_visits (status);
CREATE INDEX idx_ppm_visits_date ON public.ppm_visits (scheduled_date);

CREATE INDEX idx_service_tickets_contract ON public.service_tickets (contract_id);
CREATE INDEX idx_service_tickets_client ON public.service_tickets (client_id);
CREATE INDEX idx_service_tickets_tech ON public.service_tickets (technician_id);
CREATE INDEX idx_service_tickets_status ON public.service_tickets (status);
CREATE INDEX idx_service_tickets_dues ON public.service_tickets (sla_response_due, sla_resolution_due);
