-- ============================================================
-- JEET ERP — Project Master Module Database Schema
-- Central hub linking Tender → BOQ → Quotation → Comparison
-- ============================================================

-- Reset tables safely (order matters for FK deps)
DROP TABLE IF EXISTS public.project_milestones CASCADE;
DROP TABLE IF EXISTS public.project_contacts CASCADE;
DROP TABLE IF EXISTS public.project_status_history CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;

-- ============================================================
-- 0. EXTEND CLIENTS TABLE (add missing columns)
-- ============================================================
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS trn TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS emirate TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER DEFAULT 30;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(14,2);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS rating TEXT DEFAULT 'STANDARD' CHECK (rating IN ('PREMIUM', 'STANDARD', 'HIGH_RISK', 'BLOCKED'));
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================
-- 1. PROJECT NUMBER SEQUENCE (Race-safe, per-year)
-- ============================================================
-- We use a dedicated sequence table + PL/pgSQL function
-- instead of MAX()+1 to avoid race conditions.

CREATE TABLE IF NOT EXISTS public.project_number_sequences (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.generate_project_number()
RETURNS TEXT AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
  project_num TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  
  -- Advisory lock on year to prevent concurrent generation
  PERFORM pg_advisory_xact_lock(hashtext('project_number_' || current_year::TEXT));
  
  -- Upsert: create row for year if missing, then increment
  INSERT INTO public.project_number_sequences (year, last_number)
  VALUES (current_year, 1)
  ON CONFLICT (year) DO UPDATE SET last_number = project_number_sequences.last_number + 1
  RETURNING last_number INTO next_number;
  
  -- Format: DSC-YYYY-NNN (zero-padded to 3 digits)
  project_num := 'DSC-' || current_year::TEXT || '-' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN project_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. PROJECTS TABLE
-- ============================================================
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  
  -- Client reference
  client_id UUID REFERENCES public.clients(id) ON DELETE RESTRICT NOT NULL,
  client_name TEXT NOT NULL, -- Snapshot for display
  
  -- Site details
  site_address TEXT,
  emirate TEXT CHECK (emirate IN (
    'DUBAI', 'ABU_DHABI', 'SHARJAH', 'AJMAN', 'RAK', 'FUJAIRAH', 'UAQ'
  )),
  makani_or_plot TEXT,
  
  -- Classification
  project_type TEXT NOT NULL CHECK (project_type IN (
    'SUPPLY_INSTALL', 'SUPPLY_ONLY', 'INSTALL_ONLY', 'AMC', 'FITOUT', 'CONSULTANCY'
  )),
  systems TEXT[] DEFAULT '{}',
  
  -- Linked records (nullable for manual creation)
  tender_id UUID REFERENCES public.tenders(id) ON DELETE SET NULL,
  boq_id UUID REFERENCES public.boqs(id) ON DELETE SET NULL,
  quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
  
  -- Financial
  contract_value NUMERIC(14,2) DEFAULT 0 NOT NULL,
  original_contract_value NUMERIC(14,2) DEFAULT 0 NOT NULL, -- Immutable snapshot
  budget_cost NUMERIC(14,2) DEFAULT 0 NOT NULL,
  
  -- Client commercial terms
  client_lpo_number TEXT,
  client_lpo_date DATE,
  payment_terms TEXT,
  retention_pct NUMERIC(5,2) DEFAULT 5.00,
  advance_pct NUMERIC(5,2) DEFAULT 0,
  dlp_months INTEGER DEFAULT 12,
  
  -- Dates
  start_date DATE,
  planned_end_date DATE,
  actual_end_date DATE,
  dlp_start_date DATE,
  dlp_end_date DATE,
  
  -- Team
  project_manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  site_engineer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Status state machine
  status TEXT NOT NULL DEFAULT 'MOBILIZATION' CHECK (status IN (
    'MOBILIZATION', 'IN_PROGRESS', 'TESTING', 'HANDOVER', 'DLP', 'CLOSED',
    'ON_HOLD', 'CANCELLED'
  )),
  previous_status TEXT, -- For ON_HOLD resume
  on_hold_reason TEXT,
  on_hold_expected_resume DATE,
  cancel_reason TEXT,
  
  -- Compliance
  sira_applicable BOOLEAN DEFAULT false,
  
  -- External parties
  consultant_name TEXT,
  main_contractor_name TEXT,
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL, -- Soft delete
  
  created_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for Projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to projects"
  ON public.projects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated write to projects"
  ON public.projects FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_projects_status ON public.projects (status);
CREATE INDEX idx_projects_client_id ON public.projects (client_id);
CREATE INDEX idx_projects_pm ON public.projects (project_manager_id);
CREATE INDEX idx_projects_number ON public.projects (project_number);
CREATE INDEX idx_projects_quotation ON public.projects (quotation_id);
CREATE INDEX idx_projects_active ON public.projects (is_active, status);

-- ============================================================
-- 3. PROJECT STATUS HISTORY (Audit Trail)
-- ============================================================
CREATE TABLE public.project_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  comment TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.project_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to project_status_history"
  ON public.project_status_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated write to project_status_history"
  ON public.project_status_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_psh_project ON public.project_status_history (project_id);

-- ============================================================
-- 4. PROJECT CONTACTS (External stakeholders)
-- ============================================================
CREATE TABLE public.project_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN (
    'CLIENT_REP', 'CONSULTANT', 'MAIN_CONTRACTOR', 'FM', 
    'SECURITY_MANAGER', 'OTHER'
  )),
  phone TEXT,
  email TEXT,
  is_primary BOOLEAN DEFAULT false,
  whatsapp_optin BOOLEAN DEFAULT false, -- Future WhatsApp module
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.project_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to project_contacts"
  ON public.project_contacts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated write to project_contacts"
  ON public.project_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_pc_project ON public.project_contacts (project_id);

-- ============================================================
-- 5. PROJECT MILESTONES
-- ============================================================
CREATE TABLE public.project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  planned_date DATE,
  actual_date DATE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DONE', 'DELAYED')),
  payment_linked BOOLEAN DEFAULT false,
  payment_pct NUMERIC(5,2),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to project_milestones"
  ON public.project_milestones FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated write to project_milestones"
  ON public.project_milestones FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_pm_project ON public.project_milestones (project_id);
