-- ============================================================
-- JEET ERP — Purchase Requests (PR)
-- A PR is raised (optionally without a project, e.g. tools, IT,
-- furniture, office consumables, samples), validated/approved,
-- then converted into an LPO. An LPO can be linked back to its
-- originating PR (purchase_orders.pr_id).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_number TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CONVERTED', 'CANCELLED')),
  category TEXT NOT NULL DEFAULT 'PROJECT_MATERIAL'
    CHECK (category IN ('PROJECT_MATERIAL', 'TOOLS', 'IT_EQUIPMENT', 'FURNITURE', 'CONSUMABLES', 'SAMPLE', 'SERVICES', 'OTHER')),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,  -- null for overhead/non-project
  title TEXT NOT NULL,
  justification TEXT,
  required_by_date DATE,
  preferred_supplier_id UUID REFERENCES public.pricing_suppliers(id) ON DELETE SET NULL,
  estimated_total NUMERIC(14,2) DEFAULT 0 NOT NULL,
  notes TEXT,
  -- lifecycle
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_by_name TEXT,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  converted_po_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  converted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.purchase_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id UUID REFERENCES public.purchase_requests(id) ON DELETE CASCADE NOT NULL,
  line_no INTEGER NOT NULL,
  description TEXT NOT NULL,
  brand TEXT,
  unit TEXT NOT NULL DEFAULT 'Pcs',
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  estimated_unit_cost NUMERIC(14,4) DEFAULT 0 NOT NULL,
  estimated_line_total NUMERIC(14,2) DEFAULT 0 NOT NULL,
  system TEXT DEFAULT 'OTHER',
  pricing_item_id UUID REFERENCES public.pricing_items(id) ON DELETE SET NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_pr_status ON public.purchase_requests (status);
CREATE INDEX IF NOT EXISTS idx_pr_project ON public.purchase_requests (project_id);
CREATE INDEX IF NOT EXISTS idx_pr_items_pr ON public.purchase_request_items (pr_id);

-- Link an LPO back to the PR it was created from
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS pr_id UUID REFERENCES public.purchase_requests(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_request_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pr_read" ON public.purchase_requests;
CREATE POLICY "pr_read" ON public.purchase_requests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pr_write" ON public.purchase_requests;
CREATE POLICY "pr_write" ON public.purchase_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pr_items_read" ON public.purchase_request_items;
CREATE POLICY "pr_items_read" ON public.purchase_request_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pr_items_write" ON public.purchase_request_items;
CREATE POLICY "pr_items_write" ON public.purchase_request_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
