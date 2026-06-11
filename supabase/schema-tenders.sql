-- Create tender status ENUM type if it does not exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tender_status') THEN
    CREATE TYPE tender_status AS ENUM ('Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Completed');
  END IF;
END $$;

-- Create tenders table
CREATE TABLE IF NOT EXISTS public.tenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  project_name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  location TEXT NOT NULL,
  deadline_date DATE NOT NULL,
  budget NUMERIC,
  status tender_status NOT NULL DEFAULT 'Draft',
  scope_of_work TEXT NOT NULL,
  
  -- Technical specs stored as structured columns
  tech_discipline TEXT, -- Electrical, IT, Mechanical, etc.
  tech_equipment_list TEXT,
  tech_standards TEXT, -- IEC, ISO, etc.
  tech_notes TEXT,
  
  -- Client requirements
  client_special_requests TEXT,
  client_compliance TEXT,
  client_delivery_expectations TEXT,
  client_warranty TEXT,
  
  -- Status change log for history tracking
  status_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.tenders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid duplicate errors
DROP POLICY IF EXISTS "Users can view own tenders" ON public.tenders;
DROP POLICY IF EXISTS "Users can insert own tenders" ON public.tenders;
DROP POLICY IF EXISTS "Users can update own tenders" ON public.tenders;
DROP POLICY IF EXISTS "Users can delete own tenders" ON public.tenders;

-- RLS policies: Users can only see and manage their own created tenders (user-scoped)
CREATE POLICY "Users can view own tenders" ON public.tenders
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own tenders" ON public.tenders
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own tenders" ON public.tenders
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own tenders" ON public.tenders
  FOR DELETE USING (auth.uid() = created_by);

-- Create tender documents table to link files
CREATE TABLE IF NOT EXISTS public.tender_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID REFERENCES public.tenders(id) ON DELETE CASCADE, -- Nullable initially if uploaded during creation
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Path in Supabase storage bucket
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
);

-- Enable RLS for tender documents
ALTER TABLE public.tender_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tender documents" ON public.tender_documents;
DROP POLICY IF EXISTS "Users can insert own tender documents" ON public.tender_documents;
DROP POLICY IF EXISTS "Users can delete own tender documents" ON public.tender_documents;

CREATE POLICY "Users can view own tender documents" ON public.tender_documents
  FOR SELECT USING (auth.uid() = uploaded_by);

CREATE POLICY "Users can insert own tender documents" ON public.tender_documents
  FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete own tender documents" ON public.tender_documents
  FOR DELETE USING (auth.uid() = uploaded_by);

-- Setup Supabase Storage Buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('tender-documents', 'tender-documents', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage bucket 'tender-documents'
DROP POLICY IF EXISTS "Allow public select on tender documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload on tender documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow owner delete on tender documents" ON storage.objects;

CREATE POLICY "Allow public select on tender documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'tender-documents');

CREATE POLICY "Allow authenticated upload on tender documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'tender-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Allow owner delete on tender documents" ON storage.objects
  FOR DELETE USING (bucket_id = 'tender-documents' AND auth.uid() = owner);
