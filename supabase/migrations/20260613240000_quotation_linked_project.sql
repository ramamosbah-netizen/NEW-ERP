-- ============================================================
-- JEET ERP — Link quotations to a single owning project
--
-- A project can own many quotations (and tenders, BOQs, LPOs,
-- invoices…), but each quotation belongs to exactly one project.
-- quotations.project_id already references TENDERS (legacy
-- naming), so a dedicated linked_project_id is added to point at
-- the real project. Set when a project is created from the
-- quotation, or when the quotation is associated to an existing
-- project.
-- ============================================================

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS linked_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotations_linked_project ON public.quotations (linked_project_id);

-- Backfill from existing project -> quotation links so already-converted
-- quotations are associated to their project.
UPDATE public.quotations q
   SET linked_project_id = p.id
  FROM public.projects p
 WHERE p.quotation_id = q.id
   AND q.linked_project_id IS NULL;
