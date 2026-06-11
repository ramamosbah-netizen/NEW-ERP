-- ============================================================
-- JEET ERP — Platform Layer: Event Bus Schema
-- Core event ledger system. Modules emit events by INSERT.
-- ============================================================

-- Reset tables safely
DROP TABLE IF EXISTS public.system_events CASCADE;
DROP TABLE IF EXISTS public.event_types CASCADE;

-- 1. EVENT TYPES (Taxonomy registry)
CREATE TABLE public.event_types (
  event_type TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  description TEXT,
  default_severity TEXT NOT NULL DEFAULT 'INFO' CHECK (default_severity IN ('INFO', 'ACTION_REQUIRED', 'CRITICAL')),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS for Event Types
ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to event_types"
  ON public.event_types FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin write to event_types"
  ON public.event_types FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed Event Catalog
INSERT INTO public.event_types (event_type, module, description, default_severity) VALUES
('quotation.submitted', 'QUOTATION', 'Quotation prepared and submitted for internal review', 'ACTION_REQUIRED'),
('quotation.approved', 'QUOTATION', 'Quotation approved by a manager or GM', 'INFO'),
('quotation.rejected', 'QUOTATION', 'Quotation returned or rejected during review', 'INFO'),
('quotation.accepted_by_client', 'QUOTATION', 'Client officially accepted the quotation', 'INFO'),
('comparison.submitted', 'COMPARISON', 'Supplier pricing comparison sheet submitted for approval', 'ACTION_REQUIRED'),
('comparison.approved', 'COMPARISON', 'Supplier comparison approved by manager', 'INFO'),
('project.created', 'PROJECTS', 'New project master record generated', 'INFO'),
('project.status_changed', 'PROJECTS', 'Project workflow status transitioned', 'INFO'),
('project.dlp_expiring', 'PROJECTS', 'Project DLP warranty period nearing expiry', 'CRITICAL'),
('document.needs_review', 'DMS', 'Low-confidence document requires manual review/audit', 'ACTION_REQUIRED'),
('document.expiring', 'DMS', 'Filed compliance or contractual document nearing expiry', 'CRITICAL'),
('document.uploaded', 'DMS', 'New document uploaded to project or entity folder', 'INFO'),
('task.assigned', 'TASKS', 'New task assigned to a user', 'INFO'),
('task.due_soon', 'TASKS', 'Task deadline approaching', 'INFO'),
('task.overdue', 'TASKS', 'Task deadline has passed without completion', 'ACTION_REQUIRED'),
('meeting.scheduled', 'MEETINGS', 'New internal or project meeting scheduled', 'INFO'),
('meeting.starting_soon', 'MEETINGS', 'Meeting starts in 30 minutes', 'INFO'),
('meeting.minutes_published', 'MEETINGS', 'Meeting minutes published and action items created', 'INFO'),
('approval.escalation', 'ESCALATION', 'Escalation fired for long-pending approval action', 'CRITICAL')
ON CONFLICT (event_type) DO UPDATE SET 
  description = EXCLUDED.description,
  default_severity = EXCLUDED.default_severity;

-- 2. SYSTEM EVENTS LEDGER
CREATE TABLE public.system_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL REFERENCES public.event_types(event_type) ON DELETE RESTRICT,
  entity_type TEXT, -- Polymorphic relation (QUOTATION, COMPARISON, PROJECT, DOCUMENT, TASK, MEETING)
  entity_id UUID,
  project_id UUID, -- Denormalized helper for project context queries
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  processing_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for System Events
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to system_events"
  ON public.system_events FOR SELECT TO authenticated USING (true);

-- Write restricted to system service role / triggers, but we allow insertions from authenticated users
CREATE POLICY "Allow authenticated insert to system_events"
  ON public.system_events FOR INSERT TO authenticated WITH CHECK (true);

-- Performance indices
CREATE INDEX idx_se_event_type ON public.system_events (event_type);
CREATE INDEX idx_se_entity ON public.system_events (entity_type, entity_id);
CREATE INDEX idx_se_project ON public.system_events (project_id);
CREATE INDEX idx_se_created_at ON public.system_events (created_at DESC);
CREATE INDEX idx_se_unprocessed ON public.system_events (created_at) WHERE processed_at IS NULL;
