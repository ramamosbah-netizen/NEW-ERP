-- ============================================================
-- JEET ERP — HR, Timesheets, and WPS Payroll Module Schema
-- Handles: Employee Master, Document Compliance, Certifications,
-- Timesheets, Project Labour Costs, Leave, Air Tickets, and Payroll.
-- ============================================================

-- Reset tables safely
DROP TABLE IF EXISTS public.payroll_adjustments CASCADE;
DROP TABLE IF EXISTS public.payroll_lines CASCADE;
DROP TABLE IF EXISTS public.payroll_runs CASCADE;
DROP TABLE IF EXISTS public.project_labour_costs CASCADE;
DROP TABLE IF EXISTS public.timesheet_entries CASCADE;
DROP TABLE IF EXISTS public.timesheets CASCADE;
DROP TABLE IF EXISTS public.air_ticket_entitlements CASCADE;
DROP TABLE IF EXISTS public.leave_requests CASCADE;
DROP TABLE IF EXISTS public.leave_balances CASCADE;
DROP TABLE IF EXISTS public.employee_documents CASCADE;
DROP TABLE IF EXISTS public.employee_certifications CASCADE;
DROP TABLE IF EXISTS public.employee_compensation CASCADE;
DROP TABLE IF EXISTS public.employees CASCADE;
DROP TABLE IF EXISTS public.employee_number_sequences CASCADE;

-- Update profiles role check constraint to include 'hr' and 'gm'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'manager', 'account', 'engineer', 'storekeeper', 'hr', 'gm'));

-- Update documents entity_type check constraint to include 'EMPLOYEE'
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_entity_type_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_entity_type_check CHECK (entity_type IN ('PROJECT', 'CLIENT', 'SUPPLIER', 'COMPANY', 'AMC', 'EMPLOYEE'));

-- ============================================================
-- 1. EMPLOYEE MASTER
-- ============================================================

-- Sequence for Employee Numbers (JI-EMP-001, JI-EMP-002...)
CREATE TABLE public.employee_number_sequences (
  prefix TEXT PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.employee_number_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read on employee_number_sequences" ON public.employee_number_sequences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow privileged write on employee_number_sequences" ON public.employee_number_sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Employees Master Table
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Nullable link to login
  full_name_en TEXT NOT NULL,
  full_name_ar TEXT NOT NULL,
  nationality TEXT NOT NULL,
  dob DATE NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('MALE', 'FEMALE', 'OTHER')),
  mobile TEXT NOT NULL,
  personal_email TEXT NOT NULL,
  photo_path TEXT,
  designation TEXT NOT NULL,
  department TEXT NOT NULL CHECK (department IN ('PROJECTS', 'SERVICE', 'ESTIMATION', 'PROCUREMENT', 'FINANCE', 'ADMIN', 'MANAGEMENT')),
  employment_type TEXT NOT NULL CHECK (employment_type IN ('FULL_TIME', 'LIMITED_CONTRACT', 'OUTSOURCED')),
  join_date DATE NOT NULL,
  probation_end_date DATE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ON_LEAVE', 'NOTICE_PERIOD', 'EXITED')),
  exit_date DATE,
  exit_type TEXT CHECK (exit_type IN ('RESIGNATION', 'TERMINATION', 'CONTRACT_END')),
  
  -- UAE Documents Compliance
  passport_no TEXT NOT NULL,
  passport_expiry DATE NOT NULL,
  emirates_id_no TEXT NOT NULL,
  emirates_id_expiry DATE NOT NULL,
  visa_no TEXT NOT NULL,
  visa_expiry DATE NOT NULL,
  visa_sponsor TEXT NOT NULL DEFAULT 'JEET' CHECK (visa_sponsor IN ('JEET', 'OTHER')),
  labour_card_no TEXT NOT NULL,
  labour_card_expiry DATE NOT NULL,
  mohre_person_code TEXT NOT NULL, -- Required for WPS SIF
  iloe_insurance_expiry DATE, -- Unemployment insurance
  medical_insurance_expiry DATE NOT NULL,
  driving_license_expiry DATE,
  
  -- Bank Details (WPS Compliant)
  bank_name TEXT NOT NULL,
  iban TEXT NOT NULL, -- Verified with checksum
  routing_code TEXT NOT NULL, -- Bank/Agent routing
  agent_id TEXT NOT NULL, -- WPS Salary Card provider agent ID
  
  -- Publicly visible hourly rate (burdened snapshot rate for PMs, no salary leakage)
  current_hourly_cost_rate NUMERIC(8,2) DEFAULT 0.00 NOT NULL,
  
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Auto-numbering Trigger for Employee Number
CREATE OR REPLACE FUNCTION public.set_employee_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  IF NEW.employee_number IS NOT NULL AND NEW.employee_number <> '' THEN
    RETURN NEW;
  END IF;

  LOCK TABLE public.employee_number_sequences IN SHARE ROW EXCLUSIVE MODE;
  
  INSERT INTO public.employee_number_sequences (prefix, last_number)
  VALUES ('JI-EMP', 1)
  ON CONFLICT (prefix) DO UPDATE
  SET last_number = employee_number_sequences.last_number + 1
  RETURNING last_number INTO next_num;

  NEW.employee_number := 'JI-EMP-' || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_set_employee_number
  BEFORE INSERT ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.set_employee_number();

-- RLS Policies for Employees
CREATE POLICY "Allow select on employees for authenticated" 
  ON public.employees FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow write on employees for HR, GM, Admin" 
  ON public.employees FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('hr', 'gm', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('hr', 'gm', 'admin')
    )
  );

-- ============================================================
-- 2. EMPLOYEE COMPENSATION (RLS-Restricted Salary Info)
-- ============================================================

CREATE TABLE public.employee_compensation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  effective_from DATE NOT NULL,
  basic_salary NUMERIC(12,2) NOT NULL CHECK (basic_salary >= 0),
  housing_allowance NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (housing_allowance >= 0),
  transport_allowance NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (transport_allowance >= 0),
  other_allowance NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (other_allowance >= 0),
  
  -- Computations
  burden_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.25 CHECK (burden_multiplier >= 1.0),
  hourly_cost_rate NUMERIC(8,2) NOT NULL, -- computed as (total / 30 / 8) * burden_multiplier
  notes TEXT,
  
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.employee_compensation ENABLE ROW LEVEL SECURITY;

-- Trigger to calculate hourly_cost_rate BEFORE save
CREATE OR REPLACE FUNCTION public.before_compensation_save()
RETURNS TRIGGER AS $$
DECLARE
  total_sal NUMERIC(12,2);
BEGIN
  total_sal := NEW.basic_salary + NEW.housing_allowance + NEW.transport_allowance + NEW.other_allowance;
  NEW.hourly_cost_rate := ROUND((total_sal / 30 / 8) * NEW.burden_multiplier, 2);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_before_compensation_save
  BEFORE INSERT OR UPDATE ON public.employee_compensation
  FOR EACH ROW
  EXECUTE FUNCTION public.before_compensation_save();

-- Trigger to sync latest hourly_cost_rate to employees table AFTER save
CREATE OR REPLACE FUNCTION public.after_compensation_save()
RETURNS TRIGGER AS $$
DECLARE
  latest_rate NUMERIC(8,2);
  target_emp_id UUID;
BEGIN
  target_emp_id := COALESCE(NEW.employee_id, OLD.employee_id);
  
  -- Query the latest rate by effective_from DESC, created_at DESC
  SELECT hourly_cost_rate INTO latest_rate
  FROM public.employee_compensation
  WHERE employee_id = target_emp_id
  ORDER BY effective_from DESC, created_at DESC
  LIMIT 1;

  UPDATE public.employees
  SET current_hourly_cost_rate = COALESCE(latest_rate, 0.00)
  WHERE id = target_emp_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_after_compensation_save
  AFTER INSERT OR UPDATE OR DELETE ON public.employee_compensation
  FOR EACH ROW
  EXECUTE FUNCTION public.after_compensation_save();

-- RLS Policies for employee_compensation (Privileged Only)
CREATE POLICY "Allow compensation select for Accountant" 
  ON public.employee_compensation FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'account'
    )
  );

CREATE POLICY "Allow compensation CRUD for HR, GM, Admin" 
  ON public.employee_compensation FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('hr', 'gm', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('hr', 'gm', 'admin')
    )
  );

-- ============================================================
-- 3. CERTIFICATIONS & DMS DOCUMENT LINKS
-- ============================================================

CREATE TABLE public.employee_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  cert_type TEXT NOT NULL CHECK (cert_type IN ('SIRA_INSTALLATION', 'SIRA_CCTV_OPERATOR', 'MANUFACTURER', 'FIRST_AID', 'WORK_AT_HEIGHT', 'OTHER')),
  cert_number TEXT NOT NULL,
  issue_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL, -- link to PDF in DMS
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.employee_certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select certifications for authenticated" ON public.employee_certifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write certifications for HR, GM, Admin" ON public.employee_certifications FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'gm', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'gm', 'admin')));

-- Thin Link table for Employee Documents (Passport, EID, Visa, etc.)
CREATE TABLE public.employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('PASSPORT', 'EMIRATES_ID', 'VISA', 'LABOUR_CARD', 'MOHRE_CONTRACT', 'SIRA_CERT', 'INSURANCE', 'OTHER')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (employee_id, document_type, document_id)
);

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select employee_documents for authenticated" ON public.employee_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write employee_documents for HR, GM, Admin" ON public.employee_documents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'gm', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'gm', 'admin')));

-- ============================================================
-- 4. LEAVE & ATTENDANCE
-- ============================================================

CREATE TABLE public.leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  year INTEGER NOT NULL,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('ANNUAL', 'SICK', 'MATERNITY', 'PARENTAL')),
  entitled_days NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  taken_days NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (employee_id, year, leave_type)
);

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select leave_balances for own or managers" ON public.leave_balances FOR SELECT TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'gm', 'admin', 'manager'))
  );
CREATE POLICY "Allow write leave_balances for HR, GM, Admin" ON public.leave_balances FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'gm', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'gm', 'admin')));

CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('ANNUAL', 'SICK', 'UNPAID', 'MATERNITY', 'PARENTAL', 'HAJJ', 'COMPASSIONATE')),
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  days NUMERIC(5,2) NOT NULL CHECK (days > 0),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  approver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL, -- Medical certificate link
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow leave_requests select/insert for own" ON public.leave_requests FOR ALL TO authenticated
  USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()))
  WITH CHECK (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));

CREATE POLICY "Allow leave_requests select/update for managers" ON public.leave_requests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('manager', 'hr', 'gm', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('manager', 'hr', 'gm', 'admin')));

-- Air Ticket entitlements
CREATE TABLE public.air_ticket_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  frequency_months INTEGER NOT NULL DEFAULT 12 CHECK (frequency_months IN (12, 24)),
  destination TEXT NOT NULL,
  last_availed_date DATE,
  next_due_date DATE NOT NULL,
  estimated_cost NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.air_ticket_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow ticket select for own and managers" ON public.air_ticket_entitlements FOR SELECT TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'gm', 'admin'))
  );
CREATE POLICY "Allow ticket write for HR, GM, Admin" ON public.air_ticket_entitlements FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'gm', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'gm', 'admin')));

-- ============================================================
-- 5. TIMESHEETS AND PROJECT LABOUR FEED
-- ============================================================

CREATE TABLE public.timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL, -- Always Sunday
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'LOCKED')),
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  total_regular_hours NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  total_ot_hours NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (employee_id, week_start)
);

ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow timesheets access for own" ON public.timesheets FOR ALL TO authenticated
  USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()))
  WITH CHECK (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));

CREATE POLICY "Allow timesheets view/update for managers & HR" ON public.timesheets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('manager', 'hr', 'gm', 'admin', 'account')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('manager', 'hr', 'gm', 'admin', 'account')));

CREATE TABLE public.timesheet_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id UUID REFERENCES public.timesheets(id) ON DELETE CASCADE NOT NULL,
  work_date DATE NOT NULL,
  allocation_type TEXT NOT NULL CHECK (allocation_type IN ('PROJECT', 'SERVICE_TICKET', 'PPM_VISIT', 'OVERHEAD', 'LEAVE')),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES public.service_tickets(id) ON DELETE SET NULL,
  visit_id UUID REFERENCES public.ppm_visits(id) ON DELETE SET NULL,
  hours NUMERIC(4,2) NOT NULL CHECK (hours >= 0.00 AND hours <= 24.00),
  is_overtime BOOLEAN NOT NULL DEFAULT false,
  ot_type TEXT CHECK (ot_type IN ('WEEKDAY_OT', 'RESTDAY_OT', 'HOLIDAY_OT')),
  description TEXT,
  site_location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.timesheet_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow entries access for timesheet owner" ON public.timesheet_entries FOR ALL TO authenticated
  USING (timesheet_id IN (SELECT id FROM public.timesheets WHERE employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())))
  WITH CHECK (timesheet_id IN (SELECT id FROM public.timesheets WHERE employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())));

CREATE POLICY "Allow entries view/update for managers" ON public.timesheet_entries FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('manager', 'hr', 'gm', 'admin', 'account')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('manager', 'hr', 'gm', 'admin', 'account')));

-- Project Labour Costs (The P&L Feed)
CREATE TABLE public.project_labour_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE RESTRICT NOT NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE RESTRICT NOT NULL,
  timesheet_entry_id UUID REFERENCES public.timesheet_entries(id) ON DELETE CASCADE UNIQUE NOT NULL,
  work_date DATE NOT NULL,
  hours NUMERIC(4,2) NOT NULL,
  cost_rate NUMERIC(8,2) NOT NULL,
  cost_amount NUMERIC(10,2) NOT NULL,
  system TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.project_labour_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select on project_labour_costs for authenticated" ON public.project_labour_costs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin write on project_labour_costs" ON public.project_labour_costs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger to feed project_labour_costs upon timesheet approval
CREATE OR REPLACE FUNCTION public.process_timesheet_approval()
RETURNS TRIGGER AS $$
DECLARE
  entry RECORD;
  emp_rate NUMERIC(8,2);
BEGIN
  -- If status changed to APPROVED
  IF NEW.status = 'APPROVED' AND OLD.status <> 'APPROVED' THEN
    -- Get current burdened rate for employee
    SELECT current_hourly_cost_rate INTO emp_rate
    FROM public.employees
    WHERE id = NEW.employee_id;
    
    IF emp_rate IS NULL THEN
      emp_rate := 0.00;
    END IF;

    -- Delete any existing project labor costs for this timesheet just in case
    DELETE FROM public.project_labour_costs
    WHERE timesheet_entry_id IN (
      SELECT id FROM public.timesheet_entries WHERE timesheet_id = NEW.id
    );

    -- Insert new project labor costs for entries of type PROJECT, SERVICE_TICKET, PPM_VISIT
    FOR entry IN 
      SELECT id, project_id, work_date, hours, allocation_type, ticket_id, visit_id
      FROM public.timesheet_entries
      WHERE timesheet_id = NEW.id 
        AND allocation_type IN ('PROJECT', 'SERVICE_TICKET', 'PPM_VISIT')
        AND hours > 0
    LOOP
      DECLARE
        resolved_proj_id UUID := entry.project_id;
        resolved_system TEXT := NULL;
      BEGIN
        IF resolved_proj_id IS NULL THEN
          -- Resolve project_id from service ticket or ppm visit
          IF entry.allocation_type = 'SERVICE_TICKET' THEN
            SELECT project_id, (systems[1]) INTO resolved_proj_id, resolved_system 
            FROM public.service_tickets WHERE id = entry.ticket_id;
          ELSIF entry.allocation_type = 'PPM_VISIT' THEN
            -- Check ppm visit's contract and get project_id if it's linked
            SELECT c.project_id, c.system INTO resolved_proj_id, resolved_system 
            FROM public.amc_contracts c
            JOIN public.ppm_visits v ON v.contract_id = c.id
            WHERE v.id = entry.visit_id;
          END IF;
        END IF;

        IF resolved_proj_id IS NOT NULL THEN
          INSERT INTO public.project_labour_costs (
            project_id,
            employee_id,
            timesheet_entry_id,
            work_date,
            hours,
            cost_rate,
            cost_amount,
            system
          ) VALUES (
            resolved_proj_id,
            NEW.employee_id,
            entry.id,
            entry.work_date,
            entry.hours,
            emp_rate,
            ROUND(entry.hours * emp_rate, 2),
            resolved_system
          );
        END IF;
      END;
    END LOOP;
  
  -- If status changed from APPROVED back to something else
  ELSIF OLD.status = 'APPROVED' AND NEW.status <> 'APPROVED' THEN
    -- Delete project labor costs
    DELETE FROM public.project_labour_costs
    WHERE timesheet_entry_id IN (
      SELECT id FROM public.timesheet_entries WHERE timesheet_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_timesheet_approval
  AFTER UPDATE OF status ON public.timesheets
  FOR EACH ROW
  EXECUTE FUNCTION public.process_timesheet_approval();

-- ============================================================
-- 6. PAYROLL + WPS SIF GENERATION
-- ============================================================

CREATE TABLE public.payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month DATE NOT NULL, -- First day of month
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'REVIEW', 'APPROVED', 'PAID')),
  gross_total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  net_total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  sif_generated_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (period_month)
);

ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow payroll CRUD for accountant, gm, admin" ON public.payroll_runs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('account', 'gm', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('account', 'gm', 'admin')));

CREATE TABLE public.payroll_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.payroll_runs(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE RESTRICT NOT NULL,
  
  -- Salary Snapshots
  basic_salary NUMERIC(12,2) NOT NULL,
  housing_allowance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  transport_allowance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  other_allowance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  
  -- OT & Deductions
  ot_hours NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  ot_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  leave_deductions NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  adjustments JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  gross_pay NUMERIC(12,2) NOT NULL,
  net_pay NUMERIC(12,2) NOT NULL,
  days_worked INTEGER NOT NULL DEFAULT 30,
  
  -- Bank Details snapshot
  bank_name TEXT,
  iban TEXT,
  routing_code TEXT,
  agent_id TEXT,
  mohre_person_code TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (run_id, employee_id)
);

ALTER TABLE public.payroll_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow payroll_lines CRUD for accountant, gm, admin" ON public.payroll_lines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('account', 'gm', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('account', 'gm', 'admin')));

CREATE POLICY "Allow select own payslips" ON public.payroll_lines FOR SELECT TO authenticated
  USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));

CREATE TABLE public.payroll_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  period_month DATE NOT NULL, -- e.g. 2026-06-01
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('BONUS', 'DEDUCTION', 'ADVANCE_RECOVERY', 'OTHER')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount <> 0.00), -- positive or negative
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.payroll_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow adjustments CRUD for HR, GM, Admin, Accountant" ON public.payroll_adjustments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'gm', 'admin', 'account')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'gm', 'admin', 'account')));

-- Indexes for performance
CREATE INDEX idx_employees_status ON public.employees (status);
CREATE INDEX idx_employees_user_id ON public.employees (user_id);
CREATE INDEX idx_comp_emp ON public.employee_compensation (employee_id);
CREATE INDEX idx_cert_emp ON public.employee_certifications (employee_id);
CREATE INDEX idx_leave_emp ON public.leave_requests (employee_id);
CREATE INDEX idx_leave_dates ON public.leave_requests (from_date, to_date);
CREATE INDEX idx_timesheets_emp ON public.timesheets (employee_id, week_start);
CREATE INDEX idx_ts_entries_ts ON public.timesheet_entries (timesheet_id);
CREATE INDEX idx_labour_project ON public.project_labour_costs (project_id);
CREATE INDEX idx_labour_entry ON public.project_labour_costs (timesheet_entry_id);
CREATE INDEX idx_payroll_runs_month ON public.payroll_runs (period_month);
CREATE INDEX idx_payroll_lines_run ON public.payroll_lines (run_id);
CREATE INDEX idx_adjustments_emp ON public.payroll_adjustments (employee_id, period_month);
