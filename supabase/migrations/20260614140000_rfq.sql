-- ============================================================
-- JEET ERP — Request for Quotation (RFQ) from BOQ
--
-- Sourcing step that precedes the supplier comparison: from a BOQ,
-- draft a quotation request, pick suppliers/subcontractors, edit the
-- item list, log it, export a PDF and open a pre-filled email. The
-- recorded RFQ is later the anchor for AI reply-reading + price
-- suggestions.
--
-- Items and suppliers are stored as JSONB (matching the boqs.items
-- convention) so a single row is the full record of who was asked
-- for what.
-- ============================================================

-- Per-year sequence for human-friendly RFQ numbers (JI-RFQ-YYYY-NNN)
CREATE TABLE IF NOT EXISTS public.rfq_sequences (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.rfqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_number TEXT UNIQUE NOT NULL,
  tender_id UUID REFERENCES public.tenders(id) ON DELETE SET NULL,
  boq_id UUID REFERENCES public.boqs(id) ON DELETE SET NULL,
  project_title TEXT,                       -- snapshot of tender/project for the log
  subject TEXT NOT NULL,
  message TEXT,
  due_date DATE,                            -- quote-by date requested of suppliers
  -- [{ item_code, description, unit, quantity }]
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{ id, name, email, type }]
  suppliers JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'AWAITING', 'CLOSED')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rfqs_tender ON public.rfqs(tender_id);
CREATE INDEX IF NOT EXISTS idx_rfqs_boq ON public.rfqs(boq_id);
CREATE INDEX IF NOT EXISTS idx_rfqs_status ON public.rfqs(status);

-- RFQ numbering (BEFORE INSERT) — mirrors the stock-transaction pattern
CREATE OR REPLACE FUNCTION public.set_rfq_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
BEGIN
  IF NEW.rfq_number IS NOT NULL AND NEW.rfq_number <> '' THEN
    RETURN NEW;
  END IF;

  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  LOCK TABLE public.rfq_sequences IN SHARE ROW EXCLUSIVE MODE;

  INSERT INTO public.rfq_sequences (year, last_number)
  VALUES (current_year, 1)
  ON CONFLICT (year) DO UPDATE
  SET last_number = rfq_sequences.last_number + 1
  RETURNING last_number INTO next_number;

  NEW.rfq_number := 'JI-RFQ-' || current_year::TEXT || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_rfq_number ON public.rfqs;
CREATE TRIGGER trg_set_rfq_number
  BEFORE INSERT ON public.rfqs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_rfq_number();

-- updated_at maintenance
CREATE OR REPLACE FUNCTION public.touch_rfq_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_rfq ON public.rfqs;
CREATE TRIGGER trg_touch_rfq
  BEFORE UPDATE ON public.rfqs
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_rfq_updated_at();

-- RLS (collaborative ERP rule, mirrors boqs)
ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read to rfqs" ON public.rfqs;
DROP POLICY IF EXISTS "Allow creator insert rfqs" ON public.rfqs;
DROP POLICY IF EXISTS "Allow updates to rfqs" ON public.rfqs;
CREATE POLICY "Allow authenticated read to rfqs" ON public.rfqs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow creator insert rfqs" ON public.rfqs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow updates to rfqs" ON public.rfqs FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
