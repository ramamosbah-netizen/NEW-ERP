-- ============================================================
-- JEET ERP — Supplier Comparison Sheet Module Database Schema
-- React 18 + TypeScript + Vite + Tailwind CSS + Supabase
-- ============================================================

-- Reset tables safely
DROP TABLE IF EXISTS public.comparison_approvals CASCADE;
DROP TABLE IF EXISTS public.comparison_scoring_weights CASCADE;
DROP TABLE IF EXISTS public.supplier_performance_history CASCADE;
DROP TABLE IF EXISTS public.supplier_offers CASCADE;
DROP TABLE IF EXISTS public.comparison_items CASCADE;
DROP TABLE IF EXISTS public.supplier_comparisons CASCADE;

-- 1. SUPPLIER COMPARISONS TABLE
CREATE TABLE public.supplier_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comparison_number TEXT NOT NULL,
  revision INTEGER DEFAULT 0 NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'PRICING_IN_PROGRESS', 'PENDING_COMMERCIAL', 'PENDING_GM', 'APPROVED', 'REVISED', 'SUPERSEDED', 'REJECTED'
  )),
  quotation_id UUID REFERENCES public.quotations(id) ON DELETE RESTRICT NOT NULL,
  boq_id UUID REFERENCES public.boqs(id) ON DELETE RESTRICT NOT NULL,
  project_id UUID REFERENCES public.tenders(id) ON DELETE RESTRICT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE RESTRICT NOT NULL,
  
  -- Snapshot metadata for export reliability
  project_ref TEXT NOT NULL,
  project_name TEXT NOT NULL,
  project_address TEXT,
  tender_ref TEXT,
  quotation_ref TEXT,
  client_name TEXT NOT NULL,
  client_address TEXT,
  client_contact_person TEXT,
  client_contact_email TEXT,
  client_contact_phone TEXT,
  
  comparison_date DATE DEFAULT CURRENT_DATE NOT NULL,
  target_margin_pct NUMERIC(5,2) DEFAULT 15.00 NOT NULL,
  approval_threshold NUMERIC(14,2) DEFAULT 50000.00 NOT NULL,
  currency TEXT DEFAULT 'AED' NOT NULL,
  
  -- Overall Cost & Margin Summaries
  total_boq_material_cost NUMERIC(14,2) DEFAULT 0 NOT NULL,
  total_quotation_material_revenue NUMERIC(14,2) DEFAULT 0 NOT NULL,
  total_selected_supplier_cost NUMERIC(14,2) DEFAULT 0 NOT NULL,
  total_lowest_supplier_cost NUMERIC(14,2) DEFAULT 0 NOT NULL,
  total_savings_vs_boq NUMERIC(14,2) DEFAULT 0 NOT NULL,
  total_savings_pct NUMERIC(6,2) DEFAULT 0 NOT NULL,
  overall_margin_amount NUMERIC(14,2) DEFAULT 0 NOT NULL,
  overall_margin_pct NUMERIC(6,2) DEFAULT 0 NOT NULL,
  margin_status TEXT DEFAULT 'HEALTHY' CHECK (margin_status IN ('HEALTHY', 'WARNING', 'CRITICAL')),
  
  -- KPI Counts
  override_count INTEGER DEFAULT 0 NOT NULL,
  exception_count INTEGER DEFAULT 0 NOT NULL,
  potential_extra_savings NUMERIC(14,2) DEFAULT 0 NOT NULL,
  
  -- Approval workflows
  prepared_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  prepared_by_name TEXT NOT NULL,
  
  commercial_approver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  commercial_approved_at TIMESTAMP WITH TIME ZONE,
  commercial_comment TEXT,
  
  gm_approver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  gm_approved_at TIMESTAMP WITH TIME ZONE,
  gm_comment TEXT,
  
  notes TEXT,
  is_locked BOOLEAN DEFAULT false NOT NULL,
  previous_comparison_id UUID REFERENCES public.supplier_comparisons(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT unique_cmp_rev UNIQUE (comparison_number, revision)
);

-- Enable RLS for Comparisons
ALTER TABLE public.supplier_comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to supplier_comparisons" 
  ON public.supplier_comparisons FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated write to supplier_comparisons" 
  ON public.supplier_comparisons FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. COMPARISON ITEMS TABLE
CREATE TABLE public.comparison_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comparison_id UUID REFERENCES public.supplier_comparisons(id) ON DELETE CASCADE NOT NULL,
  boq_line_id UUID NOT NULL, -- link to BOQ items list
  line_number INTEGER NOT NULL,
  item_code TEXT,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  system TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  
  -- Specifications/Brand compliance keys
  spec_reference TEXT,
  required_brand TEXT,
  
  -- Pricing bases
  boq_unit_material_cost NUMERIC(12,2) DEFAULT 0 NOT NULL,
  boq_total_material_cost NUMERIC(14,2) DEFAULT 0 NOT NULL,
  quotation_unit_sell NUMERIC(12,2) DEFAULT 0 NOT NULL,
  quotation_total_sell NUMERIC(14,2) DEFAULT 0 NOT NULL,
  
  -- Status Indicators
  offers_count INTEGER DEFAULT 0 NOT NULL,
  compliant_offers_count INTEGER DEFAULT 0 NOT NULL,
  
  -- Link to Supplier Offers
  selected_supplier_offer_id UUID,
  recommended_supplier_offer_id UUID,
  lowest_price_offer_id UUID,
  
  selection_matches_recommendation BOOLEAN DEFAULT true NOT NULL,
  override_reason TEXT,
  override_cost_impact NUMERIC(14,2) DEFAULT 0 NOT NULL,
  
  selected_unit_cost NUMERIC(12,2) DEFAULT 0 NOT NULL,
  selected_total_cost NUMERIC(14,2) DEFAULT 0 NOT NULL,
  
  -- Margin fields
  item_margin_amount NUMERIC(14,2) DEFAULT 0 NOT NULL,
  item_margin_pct NUMERIC(6,2) DEFAULT 0 NOT NULL,
  item_margin_status TEXT DEFAULT 'HEALTHY' CHECK (item_margin_status IN ('HEALTHY', 'WARNING', 'CRITICAL')),
  item_savings_vs_boq NUMERIC(14,2) DEFAULT 0 NOT NULL,
  price_spread_pct NUMERIC(6,2) DEFAULT 0 NOT NULL,
  
  is_optional BOOLEAN DEFAULT false NOT NULL,
  is_exception BOOLEAN DEFAULT false NOT NULL,
  exception_reason TEXT,
  notes TEXT,
  sort_order INTEGER NOT NULL
);

-- Enable RLS for Items
ALTER TABLE public.comparison_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to comparison_items" 
  ON public.comparison_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated write to comparison_items" 
  ON public.comparison_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. SUPPLIER OFFERS TABLE
CREATE TABLE public.supplier_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comparison_item_id UUID REFERENCES public.comparison_items(id) ON DELETE CASCADE NOT NULL,
  supplier_id UUID, -- Optional soft-link to profile/supplier list
  supplier_name TEXT NOT NULL,
  offer_source TEXT NOT NULL CHECK (offer_source IN ('MANUAL', 'EXTRACTED_PDF', 'EXTRACTED_EXCEL', 'EMAIL')),
  offer_document_url TEXT,
  extraction_confidence NUMERIC(5,2),
  offer_reference TEXT,
  offer_date DATE,
  
  -- Core figures
  unit_price NUMERIC(12,2) NOT NULL,
  total_price NUMERIC(14,2) NOT NULL,
  
  -- Parameters
  delivery_days INTEGER,
  payment_terms_days INTEGER DEFAULT 30 NOT NULL,
  warranty_months INTEGER,
  brand_offered TEXT,
  is_compliant BOOLEAN DEFAULT true NOT NULL,
  compliance_notes TEXT,
  validity_days INTEGER,
  valid_until DATE,
  moq NUMERIC(10,2) DEFAULT 0 NOT NULL,
  includes_delivery BOOLEAN DEFAULT true NOT NULL,
  
  -- Scoring matrix
  score_price NUMERIC(5,2) DEFAULT 0 NOT NULL,
  score_delivery NUMERIC(5,2) DEFAULT 0 NOT NULL,
  score_history NUMERIC(5,2) DEFAULT 0 NOT NULL,
  score_payment NUMERIC(5,2) DEFAULT 0 NOT NULL,
  score_compliance NUMERIC(5,2) DEFAULT 0 NOT NULL,
  score_total NUMERIC(6,2) DEFAULT 0 NOT NULL,
  
  rank INTEGER,
  is_recommended BOOLEAN DEFAULT false NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Offers
ALTER TABLE public.supplier_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to supplier_offers" 
  ON public.supplier_offers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated write to supplier_offers" 
  ON public.supplier_offers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. SUPPLIER PERFORMANCE HISTORY TABLE
CREATE TABLE public.supplier_performance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID UNIQUE, -- linked to profiles if applicable
  supplier_name TEXT NOT NULL,
  total_orders INTEGER DEFAULT 0 NOT NULL,
  total_value NUMERIC(14,2) DEFAULT 0 NOT NULL,
  on_time_delivery_pct NUMERIC(5,2) DEFAULT 100.00 NOT NULL,
  quality_rating NUMERIC(3,2) DEFAULT 5.00 NOT NULL,
  defect_rate_pct NUMERIC(5,2) DEFAULT 0.00 NOT NULL,
  avg_response_days NUMERIC(5,2) DEFAULT 1.00 NOT NULL,
  disputes_count INTEGER DEFAULT 0 NOT NULL,
  win_rate_pct NUMERIC(5,2) DEFAULT 0.00 NOT NULL,
  last_order_date DATE,
  composite_history_score NUMERIC(5,2) DEFAULT 80.00 NOT NULL, -- defaults to 80
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Performance History
ALTER TABLE public.supplier_performance_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to supplier_performance_history" 
  ON public.supplier_performance_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated write to supplier_performance_history" 
  ON public.supplier_performance_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. COMPARISON SCORING WEIGHTS
CREATE TABLE public.comparison_scoring_weights (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  weight_price NUMERIC(5,2) NOT NULL CHECK (weight_price >= 0),
  weight_delivery NUMERIC(5,2) NOT NULL CHECK (weight_delivery >= 0),
  weight_history NUMERIC(5,2) NOT NULL CHECK (weight_history >= 0),
  weight_payment NUMERIC(5,2) NOT NULL CHECK (weight_payment >= 0),
  weight_compliance NUMERIC(5,2) NOT NULL CHECK (weight_compliance >= 0),
  updated_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT sum_weights CHECK (weight_price + weight_delivery + weight_history + weight_payment + weight_compliance = 100.00)
);

-- Enable RLS for Weights
ALTER TABLE public.comparison_scoring_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to comparison_scoring_weights" 
  ON public.comparison_scoring_weights FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated write to comparison_scoring_weights" 
  ON public.comparison_scoring_weights FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. COMPARISON APPROVALS TABLE
CREATE TABLE public.comparison_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comparison_id UUID REFERENCES public.supplier_comparisons(id) ON DELETE CASCADE NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('COMMERCIAL', 'GM')),
  action TEXT NOT NULL CHECK (action IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'RETURNED')),
  actor_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_title TEXT NOT NULL,
  comment TEXT,
  acted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Approvals
ALTER TABLE public.comparison_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to comparison_approvals" 
  ON public.comparison_approvals FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated write to comparison_approvals" 
  ON public.comparison_approvals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- Foreign Keys Post-Table Creation
-- ============================================================
ALTER TABLE public.comparison_items ADD CONSTRAINT fk_ci_selected_offer FOREIGN KEY (selected_supplier_offer_id) REFERENCES public.supplier_offers (id) ON DELETE SET NULL;
ALTER TABLE public.comparison_items ADD CONSTRAINT fk_ci_recommended_offer FOREIGN KEY (recommended_supplier_offer_id) REFERENCES public.supplier_offers (id) ON DELETE SET NULL;
ALTER TABLE public.comparison_items ADD CONSTRAINT fk_ci_lowest_offer FOREIGN KEY (lowest_price_offer_id) REFERENCES public.supplier_offers (id) ON DELETE SET NULL;


-- ============================================================
-- Auto-Increment Triggers & Functions
-- ============================================================

-- Format: JI-CMP-YYYY-NNN
CREATE OR REPLACE FUNCTION public.generate_comparison_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year integer;
  next_seq integer;
BEGIN
  -- Extract year from comparison_date
  current_year := EXTRACT(YEAR FROM COALESCE(NEW.comparison_date, CURRENT_DATE));
  
  -- Lock table to prevent sequence race conditions
  LOCK TABLE public.supplier_comparisons IN SHARE ROW EXCLUSIVE MODE;
  
  -- Find the next sequence number for the current year
  SELECT COALESCE(MAX(CAST(SUBSTRING(comparison_number FROM 12) AS INTEGER)), 0) + 1
  INTO next_seq
  FROM public.supplier_comparisons
  WHERE EXTRACT(YEAR FROM comparison_date) = current_year AND revision = 0;
  
  NEW.comparison_number := 'JI-CMP-' || current_year || '-' || LPAD(next_seq::text, 3, '0');
  NEW.revision := 0;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_generate_comparison_number
BEFORE INSERT ON public.supplier_comparisons
FOR EACH ROW
WHEN (NEW.comparison_number IS NULL OR NEW.comparison_number = '')
EXECUTE FUNCTION public.generate_comparison_number();


-- ============================================================
-- Seed Data
-- ============================================================

-- Seed Default Weights
INSERT INTO public.comparison_scoring_weights (weight_price, weight_delivery, weight_history, weight_payment, weight_compliance)
VALUES (45.00, 20.00, 20.00, 10.00, 5.00)
ON CONFLICT (id) DO NOTHING;

-- Seed Performance History for common mock suppliers
INSERT INTO public.supplier_performance_history (supplier_name, total_orders, total_value, on_time_delivery_pct, quality_rating, win_rate_pct, composite_history_score) VALUES
('Alpha Tech Distributors', 14, 250000.00, 95.00, 4.80, 40.00, 92.00),
('Gulf Cable Manufacturer', 32, 1200000.00, 90.00, 4.50, 65.00, 88.00),
('Beta Security Systems', 8, 85000.00, 85.00, 4.20, 30.00, 78.00),
('Omni channel IT Trading', 3, 15000.00, 100.00, 4.00, 50.00, 82.00),
('Amana MEP Solutions', 22, 450000.00, 78.00, 3.80, 45.00, 68.00);
