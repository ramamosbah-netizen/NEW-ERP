-- Create BOQ status enum type safely
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'boq_status') THEN
    CREATE TYPE boq_status AS ENUM (
      'draft', 
      'submitted', 
      'engineer_approved', 
      'manager_approved', 
      'finance_approved', 
      'finalized', 
      'exported'
    );
  END IF;
END $$;

-- Create BOQs table
CREATE TABLE IF NOT EXISTS public.boqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID REFERENCES public.tenders(id) ON DELETE CASCADE UNIQUE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status boq_status NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  
  -- Core items stored as JSONB array: [{id, name, quantity, material_unit_cost, wastage_pct, wastage_cost, labor_unit_cost, labor_total_cost, transport_unit_cost, transport_total_cost, overhead_pct, overhead_cost, profit_pct, profit_value, unit_price, total_price}]
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Cost elements: {wastage_pct, overhead_pct, logistics_cost, risk_cost, labor: {engineers: {count, hours, rate}, ...}, equipment_cost, subcontract_cost}
  cost_elements JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Financial calculations: {site_factor, direct_total, indirect_total, profit_pct, profit_value, unit_selling_price, total_selling_price}
  financials JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Approval log tracking: [{stage, approved_by, email, approved_at, note}]
  approval_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for BOQs
ALTER TABLE public.boqs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid duplicate issues
DROP POLICY IF EXISTS "Allow authenticated read to BOQs" ON public.boqs;
DROP POLICY IF EXISTS "Allow creator insert BOQs" ON public.boqs;
DROP POLICY IF EXISTS "Allow updates to BOQs" ON public.boqs;

-- Allow authenticated users to view BOQs (collaborative ERP rule)
CREATE POLICY "Allow authenticated read to BOQs" ON public.boqs
  FOR SELECT
  TO authenticated
  USING (true);

-- Creator can insert BOQs
CREATE POLICY "Allow creator insert BOQs" ON public.boqs
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = created_by);

-- Authenticated users can update BOQs (role enforcement done in app layer)
CREATE POLICY "Allow updates to BOQs" ON public.boqs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create BOQ versions snapshot table
CREATE TABLE IF NOT EXISTS public.boq_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boq_id UUID REFERENCES public.boqs(id) ON DELETE CASCADE NOT NULL,
  version INTEGER NOT NULL,
  items JSONB NOT NULL,
  cost_elements JSONB NOT NULL,
  financials JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for BOQ versions
ALTER TABLE public.boq_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read to BOQ versions" ON public.boq_versions;
DROP POLICY IF EXISTS "Allow insert to BOQ versions" ON public.boq_versions;

CREATE POLICY "Allow authenticated read to BOQ versions" ON public.boq_versions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert to BOQ versions" ON public.boq_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
