-- ============================================================
-- JEET ERP — Document Management System (DMS) Database Schema
-- AI-Powered classification, version control, expiry tracking
-- ============================================================

-- Reset tables safely
DROP TABLE IF EXISTS public.document_activity CASCADE;
DROP TABLE IF EXISTS public.document_expiry_alerts CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.document_categories CASCADE;

-- ============================================================
-- 1. DOCUMENT CATEGORIES (Extensible taxonomy — not hardcoded)
-- ============================================================
CREATE TABLE public.document_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  description_for_ai TEXT NOT NULL, -- Injected into Gemini prompt
  default_expiry_alert_days INTEGER[] DEFAULT '{60,30,7}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true NOT NULL,
  CONSTRAINT unique_cat_subcat UNIQUE (category, subcategory)
);

ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to document_categories"
  ON public.document_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin write to document_categories"
  ON public.document_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed the full taxonomy
INSERT INTO public.document_categories (category, subcategory, description_for_ai, sort_order) VALUES
-- COMMERCIAL
('COMMERCIAL', 'QUOTATION', 'A price quotation or proposal sent to or received from a client or supplier, containing itemized pricing and terms', 1),
('COMMERCIAL', 'CLIENT_LPO', 'A Local Purchase Order (LPO) or contract award letter received from a client, authorizing work to begin', 2),
('COMMERCIAL', 'SUPPLIER_QUOTE', 'A price quotation received from a material/equipment supplier', 3),
('COMMERCIAL', 'SUPPLIER_INVOICE', 'An invoice received from a supplier or subcontractor for payment', 4),
('COMMERCIAL', 'CLIENT_INVOICE', 'An invoice issued to a client for payment of delivered work or materials', 5),
('COMMERCIAL', 'PAYMENT_CERTIFICATE', 'A payment certificate or interim payment claim document', 6),
('COMMERCIAL', 'VARIATION_ORDER', 'A variation order (VO) or change order document modifying the original contract scope or value', 7),
('COMMERCIAL', 'PAYMENT_RECEIPT', 'A receipt confirming payment was made or received', 8),
('COMMERCIAL', 'BANK_GUARANTEE', 'A bank guarantee or letter of credit related to project financial security', 9),
-- CONTRACTUAL
('CONTRACTUAL', 'CONTRACT', 'A main contract or agreement between client and contractor', 10),
('CONTRACTUAL', 'SUBCONTRACT', 'A subcontract agreement with a third-party service provider', 11),
('CONTRACTUAL', 'NDA', 'A non-disclosure or confidentiality agreement', 12),
('CONTRACTUAL', 'WARRANTY_CERTIFICATE', 'A warranty certificate for equipment, materials, or workmanship', 13),
('CONTRACTUAL', 'HANDOVER_CERTIFICATE', 'A project handover or completion certificate signed by client and contractor', 14),
('CONTRACTUAL', 'INSURANCE_POLICY', 'An insurance policy covering the project, equipment, or third-party liability', 15),
-- TECHNICAL
('TECHNICAL', 'SHOP_DRAWING', 'A shop drawing or fabrication drawing for approval', 16),
('TECHNICAL', 'AS_BUILT', 'An as-built drawing reflecting the final installed configuration', 17),
('TECHNICAL', 'SCHEMATIC', 'A schematic or single-line diagram for system design', 18),
('TECHNICAL', 'DATASHEET', 'A product or equipment technical datasheet with specifications', 19),
('TECHNICAL', 'MATERIAL_SUBMITTAL', 'A material submittal for consultant or client approval', 20),
('TECHNICAL', 'METHOD_STATEMENT', 'A method statement describing work procedures and safety measures', 21),
('TECHNICAL', 'RISK_ASSESSMENT', 'A risk assessment document for health, safety, or project risks', 22),
('TECHNICAL', 'TC_REPORT', 'A testing and commissioning (T&C) report for system verification', 23),
('TECHNICAL', 'PROGRAMME', 'A project schedule, programme, or Gantt chart', 24),
-- COMPLIANCE
('COMPLIANCE', 'SIRA_CERTIFICATE', 'A SIRA (Security Industry Regulatory Agency) approval or operator certificate', 25),
('COMPLIANCE', 'SIRA_EGUARD', 'A SIRA eGuard system registration or license document', 26),
('COMPLIANCE', 'DCD_NOC', 'A Dubai Civil Defence No Objection Certificate for fire alarm systems', 27),
('COMPLIANCE', 'DM_APPROVAL', 'A Dubai Municipality approval or permit document', 28),
('COMPLIANCE', 'DEWA_NOC', 'A DEWA No Objection Certificate for electrical works', 29),
('COMPLIANCE', 'TRADE_LICENSE', 'A company trade license or business registration document', 30),
('COMPLIANCE', 'ESTABLISHMENT_CARD', 'A company establishment card or labor card', 31),
('COMPLIANCE', 'THIRD_PARTY_CERT', 'A third-party inspection or certification document (e.g. TUV, UL)', 32),
-- CORRESPONDENCE
('CORRESPONDENCE', 'CLIENT_LETTER', 'A formal letter or correspondence to or from a client', 33),
('CORRESPONDENCE', 'CONSULTANT_LETTER', 'A letter or correspondence to or from a project consultant', 34),
('CORRESPONDENCE', 'EMAIL', 'An email correspondence relevant to the project', 35),
('CORRESPONDENCE', 'RFI', 'A Request for Information (RFI) document', 36),
('CORRESPONDENCE', 'MEETING_MINUTES', 'Minutes of a project meeting', 37),
('CORRESPONDENCE', 'SITE_INSTRUCTION', 'A site instruction or directive issued during construction', 38),
-- SITE
('SITE', 'SITE_PHOTO', 'A photograph taken at the project site showing progress or conditions', 39),
('SITE', 'DELIVERY_NOTE', 'A delivery note confirming receipt of materials or equipment at site', 40),
('SITE', 'SITE_REPORT', 'A daily, weekly, or monthly site progress report', 41),
('SITE', 'SNAG_LIST', 'A snag list or punch list documenting defects for rectification', 42),
('SITE', 'INSPECTION_REPORT', 'A site inspection or quality control report', 43),
-- OTHER
('OTHER', 'UNCLASSIFIED', 'A document that does not fit any specific category and requires manual classification', 44)
ON CONFLICT (category, subcategory) DO NOTHING;

-- ============================================================
-- 2. DOCUMENTS TABLE (Central Repository)
-- ============================================================
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Entity polymorphism
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'PROJECT', 'CLIENT', 'SUPPLIER', 'COMPANY', 'AMC'
  )),
  entity_id UUID, -- null only for COMPANY-level docs
  
  -- File metadata
  title TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_ext TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  file_hash TEXT NOT NULL, -- SHA-256 for duplicate detection
  storage_path TEXT NOT NULL,
  
  -- Classification
  category TEXT NOT NULL DEFAULT 'OTHER',
  subcategory TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
  
  -- AI metadata
  ai_confidence NUMERIC(5,2),
  ai_metadata JSONB, -- Full Gemini response
  ai_summary TEXT,
  
  -- Extracted data
  "references" TEXT[] DEFAULT '{}', -- Extracted document references (GIN-indexed)
  issue_date DATE,
  expiry_date DATE,
  amount_aed NUMERIC(14,2),
  
  -- Revision chain
  revision_label TEXT, -- "Rev 2", "Amendment 1"
  revision_number INTEGER DEFAULT 1,
  supersedes_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  is_latest_revision BOOLEAN DEFAULT true,
  
  -- Processing status
  status TEXT NOT NULL DEFAULT 'PROCESSING' CHECK (status IN (
    'PROCESSING', 'AUTO_FILED', 'NEEDS_REVIEW', 'VERIFIED', 'REJECTED'
  )),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  -- Optional deep link to specific record
  linked_record_type TEXT, -- quotation, comparison, po, invoice
  linked_record_id UUID,
  
  -- Access control
  tags TEXT[] DEFAULT '{}',
  is_confidential BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true NOT NULL, -- Soft delete
  
  -- Full-text search
  extracted_text TEXT, -- Truncated at 100k chars
  search_vector TSVECTOR, -- GIN-indexed for full-text search
  
  -- Audit
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for Documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to documents"
  ON public.documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated write to documents"
  ON public.documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Performance indexes
CREATE INDEX idx_docs_entity ON public.documents (entity_type, entity_id);
CREATE INDEX idx_docs_category ON public.documents (category, subcategory);
CREATE INDEX idx_docs_status ON public.documents (status);
CREATE INDEX idx_docs_expiry ON public.documents (expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX idx_docs_hash ON public.documents (file_hash);
CREATE INDEX idx_docs_refs ON public.documents USING GIN ("references");
CREATE INDEX idx_docs_search ON public.documents USING GIN (search_vector);
CREATE INDEX idx_docs_active ON public.documents (is_active, status);
CREATE INDEX idx_docs_uploaded_by ON public.documents (uploaded_by);

-- Auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION public.update_document_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.ai_summary, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(LEFT(NEW.extracted_text, 50000), '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW."references", ' '), '')), 'A');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_doc_search_vector
  BEFORE INSERT OR UPDATE OF title, ai_summary, extracted_text, "references"
  ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_document_search_vector();

-- Full-text search RPC function
CREATE OR REPLACE FUNCTION public.search_documents(search_query TEXT, max_results INTEGER DEFAULT 50)
RETURNS SETOF public.documents AS $$
BEGIN
  RETURN QUERY
    SELECT *
    FROM public.documents
    WHERE is_active = true
      AND search_vector @@ websearch_to_tsquery('english', search_query)
    ORDER BY ts_rank(search_vector, websearch_to_tsquery('english', search_query)) DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. DOCUMENT EXPIRY ALERTS
-- ============================================================
CREATE TABLE public.document_expiry_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  expiry_date DATE NOT NULL,
  alert_days_before INTEGER NOT NULL, -- 60, 30, 7
  alert_sent_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'SENT', 'ACKNOWLEDGED', 'EXPIRED'
  )),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.document_expiry_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to document_expiry_alerts"
  ON public.document_expiry_alerts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated write to document_expiry_alerts"
  ON public.document_expiry_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_dea_document ON public.document_expiry_alerts (document_id);
CREATE INDEX idx_dea_status ON public.document_expiry_alerts (status, expiry_date);

-- ============================================================
-- 4. DOCUMENT ACTIVITY LOG (Full audit)
-- ============================================================
CREATE TABLE public.document_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'UPLOADED', 'CLASSIFIED', 'REVIEWED', 'REVISED', 'DOWNLOADED',
    'LINKED', 'DELETED', 'RESTORED', 'METADATA_UPDATED'
  )),
  detail JSONB, -- Additional context
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.document_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to document_activity"
  ON public.document_activity FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated write to document_activity"
  ON public.document_activity FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_da_document ON public.document_activity (document_id);
CREATE INDEX idx_da_action ON public.document_activity (action);

-- ============================================================
-- 5. SUPABASE STORAGE BUCKET (Private documents)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false, -- Private bucket: signed URLs only
  52428800, -- 50 MB
  ARRAY[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/jpg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/octet-stream', -- DWG, ZIP, etc.
    'application/zip',
    'message/rfc822', -- EML
    'application/vnd.ms-outlook' -- MSG
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Allow authenticated upload to documents bucket" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Allow authenticated read from documents bucket" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'documents');

CREATE POLICY "Allow authenticated delete from documents bucket" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'documents');
