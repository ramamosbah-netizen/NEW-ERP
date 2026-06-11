-- ============================================================
-- JEET ERP — Quotation Module Database Schema
-- React 18 + TypeScript + Vite + Tailwind CSS + Supabase
-- ============================================================

-- Reset tables safely
DROP TABLE IF EXISTS public.quotation_approvals CASCADE;
DROP TABLE IF EXISTS public.quotation_lines CASCADE;
DROP TABLE IF EXISTS public.quotation_templates CASCADE;
DROP TABLE IF EXISTS public.quotations CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;

-- 1. CLIENTS TABLE
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  country TEXT DEFAULT 'UAE' NOT NULL,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to clients" 
  ON public.clients FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated write to clients" 
  ON public.clients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. QUOTATIONS TABLE
CREATE TABLE public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number TEXT NOT NULL,
  revision INTEGER DEFAULT 0 NOT NULL,
  revision_label TEXT NOT NULL DEFAULT 'Rev.0',
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'PENDING_COMMERCIAL', 'PENDING_GM', 'APPROVED', 'SENT_TO_CLIENT', 
    'ACCEPTED', 'REJECTED', 'REVISED', 'SUPERSEDED'
  )),
  boq_id UUID REFERENCES public.boqs(id) ON DELETE RESTRICT NOT NULL,
  project_id UUID REFERENCES public.tenders(id) ON DELETE RESTRICT NOT NULL,
  project_ref TEXT NOT NULL,
  tender_ref TEXT,
  previous_quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE RESTRICT NOT NULL,
  client_name TEXT NOT NULL,
  client_address_line1 TEXT,
  client_address_line2 TEXT,
  client_city TEXT,
  client_country TEXT DEFAULT 'UAE' NOT NULL,
  client_contact_person TEXT,
  client_contact_email TEXT,
  client_contact_phone TEXT,
  client_po_number TEXT,
  quotation_date DATE DEFAULT CURRENT_DATE NOT NULL,
  valid_until DATE NOT NULL,
  subject TEXT NOT NULL,
  scope_summary TEXT,
  currency TEXT DEFAULT 'AED' NOT NULL,
  subtotal_ex_vat NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(14,2) DEFAULT 0 NOT NULL,
  subtotal_after_discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) DEFAULT 5.00 NOT NULL,
  vat_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  grand_total_with_vat NUMERIC(14,2) NOT NULL DEFAULT 0,
  grand_total_in_words TEXT,
  payment_terms TEXT,
  delivery_period TEXT,
  warranty_terms TEXT,
  terms_and_conditions TEXT,
  exclusions TEXT,
  inclusions TEXT,
  notes_internal TEXT,
  notes_client TEXT,
  
  -- Actor Snapshots
  prepared_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  prepared_by_name TEXT,
  prepared_by_title TEXT,
  
  commercial_reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  commercial_reviewed_at TIMESTAMP WITH TIME ZONE,
  commercial_comment TEXT,
  
  gm_approver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  gm_approved_at TIMESTAMP WITH TIME ZONE,
  gm_comment TEXT,
  gm_signature_ref TEXT,
  
  sent_to_client_at TIMESTAMP WITH TIME ZONE,
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  client_responded_at TIMESTAMP WITH TIME ZONE,
  client_response TEXT CHECK (client_response IN ('ACCEPTED', 'REJECTED', 'REVISED')),
  rejection_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  is_locked BOOLEAN DEFAULT false NOT NULL,
  
  -- Revisions Constraint: Can only have one of each revision for a quotation number
  CONSTRAINT unique_quote_rev UNIQUE (quotation_number, revision)
);

-- Enable RLS for Quotations
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to quotations" 
  ON public.quotations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated write to quotations" 
  ON public.quotations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. QUOTATION LINES TABLE
CREATE TABLE public.quotation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID REFERENCES public.quotations(id) ON DELETE CASCADE NOT NULL,
  line_number INTEGER NOT NULL,
  pricing_item_id UUID REFERENCES public.pricing_items(id) ON DELETE SET NULL,
  item_code TEXT,
  description TEXT NOT NULL,
  system TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit_sell_price NUMERIC(12,2) NOT NULL,
  discount_pct NUMERIC(5,2) DEFAULT 0 NOT NULL,
  unit_sell_price_after_discount NUMERIC(12,2) NOT NULL,
  line_total NUMERIC(14,2) NOT NULL,
  vat_applicable BOOLEAN DEFAULT true NOT NULL,
  is_optional BOOLEAN DEFAULT false NOT NULL,
  notes TEXT,
  sort_order INTEGER NOT NULL
);

-- Enable RLS for Quotation Lines
ALTER TABLE public.quotation_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to quotation lines" 
  ON public.quotation_lines FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated write to quotation lines" 
  ON public.quotation_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. QUOTATION APPROVALS (AUDIT TRAIL)
CREATE TABLE public.quotation_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID REFERENCES public.quotations(id) ON DELETE CASCADE NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('COMMERCIAL', 'GM', 'ESTIMATOR')),
  action TEXT NOT NULL CHECK (action IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'RETURNED')),
  actor_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_title TEXT NOT NULL,
  comment TEXT,
  acted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Approvals
ALTER TABLE public.quotation_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to quotation approvals" 
  ON public.quotation_approvals FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated write to quotation approvals" 
  ON public.quotation_approvals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. QUOTATION TEMPLATES
CREATE TABLE public.quotation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('TERMS', 'EXCLUSIONS', 'INCLUSIONS', 'PAYMENT', 'WARRANTY', 'SCOPE')),
  content TEXT NOT NULL,
  applicable_systems TEXT[] DEFAULT '{}'::text[] NOT NULL,
  is_default BOOLEAN DEFAULT false NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Templates
ALTER TABLE public.quotation_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to quotation templates" 
  ON public.quotation_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated write to quotation templates" 
  ON public.quotation_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ============================================================
-- Triggers & Automations
-- ============================================================

-- Trigger function to auto-increment and format quotation number (JI-QT-YYYY-NNN)
CREATE OR REPLACE FUNCTION public.generate_quotation_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year integer;
  next_seq integer;
BEGIN
  -- Extract year from quotation_date (default to today if null)
  current_year := EXTRACT(YEAR FROM COALESCE(NEW.quotation_date, CURRENT_DATE));
  
  -- Lock quotations table in SHARE ROW EXCLUSIVE mode to prevent race conditions during sequence generation
  LOCK TABLE public.quotations IN SHARE ROW EXCLUSIVE MODE;
  
  -- Find the next sequence number for the current year (revision 0 only to establish base number)
  SELECT COALESCE(MAX(CAST(SUBSTRING(quotation_number FROM 12) AS INTEGER)), 0) + 1
  INTO next_seq
  FROM public.quotations
  WHERE EXTRACT(YEAR FROM quotation_date) = current_year AND revision = 0;
  
  -- Format: JI-QT-YYYY-NNN
  NEW.quotation_number := 'JI-QT-' || current_year || '-' || LPAD(next_seq::text, 3, '0');
  NEW.revision := 0;
  NEW.revision_label := 'Rev.0';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_generate_quotation_number
BEFORE INSERT ON public.quotations
FOR EACH ROW
WHEN (NEW.quotation_number IS NULL OR NEW.quotation_number = '')
EXECUTE FUNCTION public.generate_quotation_number();


-- ============================================================
-- Seed Data: Clause Templates Library
-- ============================================================

INSERT INTO public.quotation_templates (template_name, template_type, content, is_default) VALUES
(
  'Standard ELV — Payment Terms',
  'PAYMENT',
  '30% advance payment upon LPO, 60% upon system installation completion, 10% upon final handover and sign-off. All payments within 30 days of invoice.',
  true
),
(
  'Standard ELV — Warranty',
  'WARRANTY',
  'All supplied equipment and installation works carry a 12-month warranty from the date of system handover. Warranty covers defects in materials and workmanship under normal operating conditions.',
  true
),
(
  'Standard ELV — Terms & Conditions',
  'TERMS',
  '1. This quotation is valid for 30 days from the date of issue.
2. Prices are in UAE Dirhams (AED) and are exclusive of VAT unless stated otherwise.
3. VAT at 5% will be charged in accordance with UAE Federal Tax Authority requirements.
4. A formal LPO or signed acceptance is required to proceed.
5. Any variations to the agreed scope will be subject to a Variation Order with revised pricing.
6. Title to goods remains with JEET INTECH L.L.C until full payment is received.
7. Force majeure events are not within the scope of this agreement.',
  true
),
(
  'Standard ELV — Exclusions',
  'EXCLUSIONS',
  '- Civil works, core drilling, and wall chasing unless explicitly stated in the BOQ
- False ceiling works, painting, and plastering
- Main power supply to equipment (assumed provided by client/MEP contractor)
- Network infrastructure beyond ELV system scope
- Authority approval fees unless explicitly included
- Furniture, fixtures, and finishes
- Works outside the defined project boundary',
  true
),
(
  'Standard ELV — Inclusions',
  'INCLUSIONS',
  '- Supply, installation, testing, and commissioning of all items listed in the BOQ
- As-built drawings upon project completion
- Operation and maintenance manuals
- Training session for client''s designated personnel (up to 2 hours)
- SIRA / DCD submission support where applicable',
  true
);
