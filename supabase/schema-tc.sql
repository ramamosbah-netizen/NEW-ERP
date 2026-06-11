-- ============================================================
-- JEET ERP — Testing & Commissioning, Snag List, & Handover Module
-- Tables, sequences, triggers, and Row Level Security
-- ============================================================

-- Reset tables safely (dependencies order)
DROP TABLE IF EXISTS public.handover_checklist_items CASCADE;
DROP TABLE IF EXISTS public.handover_packages CASCADE;
DROP TABLE IF EXISTS public.tc_witnesses CASCADE;
DROP TABLE IF EXISTS public.tc_test_results CASCADE;
DROP TABLE IF EXISTS public.tc_devices CASCADE;
DROP TABLE IF EXISTS public.tc_test_scripts CASCADE;
DROP TABLE IF EXISTS public.tc_packages CASCADE;
DROP TABLE IF EXISTS public.tc_script_template_items CASCADE;
DROP TABLE IF EXISTS public.tc_script_templates CASCADE;
DROP TABLE IF EXISTS public.snags CASCADE;

DROP TABLE IF EXISTS public.tc_package_sequences CASCADE;

-- 1. WHATSAPP SEQUENCES & TRIGGERS
CREATE TABLE public.tc_package_sequences (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.tc_package_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on tc_package_sequences" ON public.tc_package_sequences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on tc_package_sequences" ON public.tc_package_sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. T&C SCRIPT TEMPLATES (Admin-configurable templates)
CREATE TABLE public.tc_script_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  system TEXT NOT NULL, -- CCTV, ACS, FIRE_ALARM, GATE_BARRIER, STRUCTURED_CABLING, BMS etc.
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.tc_script_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on tc_script_templates" ON public.tc_script_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin write on tc_script_templates" ON public.tc_script_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.tc_script_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.tc_script_templates(id) ON DELETE CASCADE NOT NULL,
  script_type TEXT NOT NULL CHECK (script_type IN ('DEVICE_LEVEL', 'SYSTEM_LEVEL', 'INTEGRATION')),
  test_item TEXT NOT NULL,
  expected TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.tc_script_template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on tc_script_template_items" ON public.tc_script_template_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin write on tc_script_template_items" ON public.tc_script_template_items FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 3. T&C COMMISSIONING PACKAGES
CREATE TABLE public.tc_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_number TEXT UNIQUE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE RESTRICT NOT NULL,
  system TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'READY', 'IN_PROGRESS', 'INTERNAL_PASSED', 'WITNESS_SCHEDULED', 'CONSULTANT_APPROVED', 'CLIENT_APPROVED', 'COMPLETED', 'FAILED_RETEST'
  )),
  assigned_engineer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  witness_required TEXT NOT NULL DEFAULT 'INTERNAL_ONLY' CHECK (witness_required IN ('INTERNAL_ONLY', 'CONSULTANT', 'CLIENT', 'BOTH')),
  scheduled_witness_date TIMESTAMP WITH TIME ZONE,
  method_statement_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  completion_pct NUMERIC(5,2) DEFAULT 0.00 NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.tc_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on tc_packages" ON public.tc_packages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on tc_packages" ON public.tc_packages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Auto-numbering Trigger for T&C packages
CREATE OR REPLACE FUNCTION public.set_tc_package_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
BEGIN
  IF NEW.package_number IS NOT NULL AND NEW.package_number <> '' THEN
    RETURN NEW;
  END IF;

  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  LOCK TABLE public.tc_package_sequences IN SHARE ROW EXCLUSIVE MODE;

  INSERT INTO public.tc_package_sequences (year, last_number)
  VALUES (current_year, 1)
  ON CONFLICT (year) DO UPDATE
  SET last_number = tc_package_sequences.last_number + 1
  RETURNING last_number INTO next_number;

  NEW.package_number := 'JI-TC-' || current_year::TEXT || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_set_tc_package_number
  BEFORE INSERT ON public.tc_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tc_package_number();


-- 4. T&C SCRIPTS (Instantiated checklist tasks per package)
CREATE TABLE public.tc_test_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID REFERENCES public.tc_packages(id) ON DELETE CASCADE NOT NULL,
  script_type TEXT NOT NULL CHECK (script_type IN ('DEVICE_LEVEL', 'SYSTEM_LEVEL', 'INTEGRATION')),
  title TEXT NOT NULL, -- Test item description
  expected TEXT NOT NULL, -- Expected results
  sort_order INTEGER NOT NULL
);
ALTER TABLE public.tc_test_scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on tc_test_scripts" ON public.tc_test_scripts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on tc_test_scripts" ON public.tc_test_scripts FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 5. T&C DEVICES (Equipment register imported per package)
CREATE TABLE public.tc_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID REFERENCES public.tc_packages(id) ON DELETE CASCADE NOT NULL,
  device_type TEXT NOT NULL,
  label TEXT NOT NULL, -- e.g., "CAM-GF-012"
  location TEXT NOT NULL,
  brand_model TEXT,
  serial TEXT,
  ip_address TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PASSED', 'FAILED', 'NA'))
);
ALTER TABLE public.tc_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on tc_devices" ON public.tc_devices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on tc_devices" ON public.tc_devices FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 6. SNAGS (Punch list sequential per project)
CREATE TABLE public.snags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snag_number TEXT NOT NULL, -- e.g., SNG-001
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('TC_FAIL', 'WITNESS', 'CLIENT_WALKTHROUGH', 'INTERNAL_QA', 'CONSULTANT')),
  system TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT NOT NULL,
  photo_paths TEXT[] NOT NULL DEFAULT '{}'::text[],
  severity TEXT NOT NULL CHECK (severity IN ('MINOR', 'MAJOR', 'CRITICAL')),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  subcontractor_name TEXT,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'READY_FOR_INSPECTION', 'CLOSED', 'DEFERRED_TO_DLP', 'DISPUTED')),
  closed_evidence_photos TEXT[] NOT NULL DEFAULT '{}'::text[],
  closed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_accepted BOOLEAN,
  deferral_justification TEXT,
  tc_test_result_id UUID, -- linked back to test result if source is TC_FAIL
  created_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_project_snag UNIQUE (project_id, snag_number)
);
ALTER TABLE public.snags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on snags" ON public.snags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on snags" ON public.snags FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Closer != Verifier Check Constraint / Enforcement Trigger
CREATE OR REPLACE FUNCTION public.check_snag_closer_verifier()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'CLOSED' AND NEW.closed_by = NEW.verified_by THEN
    RAISE EXCEPTION 'Closer cannot be the same user as the verifier on snag inspection audits.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_snag_closer_verifier
  BEFORE INSERT OR UPDATE OF status, closed_by, verified_by ON public.snags
  FOR EACH ROW
  EXECUTE FUNCTION public.check_snag_closer_verifier();

-- Sequential snag numbering within a project trigger
CREATE OR REPLACE FUNCTION public.generate_snag_number()
RETURNS TRIGGER AS $$
DECLARE
  next_seq INTEGER;
BEGIN
  -- We lock on project_id to avoid race conditions in sequential numbering per project
  PERFORM pg_advisory_xact_lock(hashtext('snag_seq_' || NEW.project_id::TEXT));
  
  SELECT COALESCE(MAX(SUBSTRING(snag_number FROM 5)::INTEGER), 0) + 1
  INTO next_seq
  FROM public.snags
  WHERE project_id = NEW.project_id;
  
  NEW.snag_number := 'SNG-' || LPAD(next_seq::TEXT, 3, '0');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_generate_snag_number
  BEFORE INSERT ON public.snags
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_snag_number();


-- 7. T&C TEST RESULTS (Device/system logs)
CREATE TABLE public.tc_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID REFERENCES public.tc_test_scripts(id) ON DELETE CASCADE NOT NULL,
  device_id UUID REFERENCES public.tc_devices(id) ON DELETE SET NULL, -- Null for system-level/integration tests
  test_item TEXT NOT NULL,
  expected TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('PASS', 'FAIL', 'NA')),
  measured_value TEXT,
  photo_paths TEXT[] NOT NULL DEFAULT '{}'::text[],
  tested_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT NOT NULL,
  tested_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  retest_of_id UUID REFERENCES public.tc_test_results(id) ON DELETE SET NULL,
  snag_id UUID REFERENCES public.snags(id) ON DELETE SET NULL
);
ALTER TABLE public.tc_test_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on tc_test_results" ON public.tc_test_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on tc_test_results" ON public.tc_test_results FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 8. T&C WITNESS SIGN-OFFS
CREATE TABLE public.tc_witnesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID REFERENCES public.tc_packages(id) ON DELETE CASCADE NOT NULL,
  witness_stage TEXT NOT NULL CHECK (witness_stage IN ('INTERNAL', 'CONSULTANT', 'CLIENT')),
  witness_name TEXT NOT NULL,
  designation TEXT NOT NULL,
  company TEXT NOT NULL,
  signature_path TEXT, -- private documents bucket path
  result TEXT NOT NULL CHECK (result IN ('APPROVED', 'APPROVED_WITH_COMMENTS', 'REJECTED')),
  comments TEXT,
  witnessed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.tc_witnesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on tc_witnesses" ON public.tc_witnesses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on tc_witnesses" ON public.tc_witnesses FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 9. HANDOVER CLOSEOUT PACKAGES
CREATE TABLE public.handover_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE RESTRICT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'IN_PREPARATION' CHECK (status IN ('IN_PREPARATION', 'READY', 'SIGNED', 'COMPLETED')),
  handover_date DATE,
  client_signatory_name TEXT,
  client_signatory_designation TEXT,
  signature_path TEXT, -- private signature documents storage
  certificate_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  dlp_start_confirmed BOOLEAN DEFAULT false NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.handover_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on handover_packages" ON public.handover_packages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on handover_packages" ON public.handover_packages FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.handover_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID REFERENCES public.handover_packages(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL, -- T&C, Snags, O&M, Warranty, SIRA, Training, Commercial etc.
  requirement TEXT NOT NULL,
  mandatory BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DONE', 'WAIVED')),
  evidence_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  waived_reason TEXT,
  waived_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sort INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.handover_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth read on handover_checklist_items" ON public.handover_checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write on handover_checklist_items" ON public.handover_checklist_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
