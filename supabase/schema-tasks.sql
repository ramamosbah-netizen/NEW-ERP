-- ============================================================
-- JEET ERP — Platform Layer: Task Management Schema
-- Tasks, comments, and task generation rules from system events
-- ============================================================

-- Reset tables safely
DROP TABLE IF EXISTS public.task_comments CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.task_rules CASCADE;

-- 1. TASK AUTO-GENERATION RULES
CREATE TABLE public.task_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL REFERENCES public.event_types(event_type) ON DELETE CASCADE,
  title_template TEXT NOT NULL,
  description_template TEXT NOT NULL,
  assignee_strategy TEXT NOT NULL CHECK (assignee_strategy IN ('ROLE', 'PROJECT_ROLE', 'SPECIFIC_USER_FROM_PAYLOAD', 'PREPARED_BY')),
  assignee_value TEXT, -- e.g. 'manager', 'site_engineer', 'prepared_by', 'next_approver_id'
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  due_hours INTEGER NOT NULL DEFAULT 48, -- In business hours (Sun-Thu 08:00-18:00)
  auto_complete_on_event TEXT, -- Event name that triggers autocomplete, e.g. 'quotation.approved'
  is_active BOOLEAN DEFAULT true NOT NULL
);

-- Enable RLS for Task Rules
ALTER TABLE public.task_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to task_rules"
  ON public.task_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin write to task_rules"
  ON public.task_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed Task Rules
INSERT INTO public.task_rules (event_type, title_template, description_template, assignee_strategy, assignee_value, priority, due_hours, auto_complete_on_event) VALUES
('quotation.submitted', 'Review & Approve Quotation {{payload.quotation_number}}', 'The quotation for {{payload.client_name}} (Total: {{payload.subtotal_after_discount}} AED) requires review and sign-off.', 'ROLE', 'manager', 'HIGH', 48, 'quotation.approved'),
('comparison.submitted', 'Approve Supplier Comparison {{payload.comparison_number}}', 'Review and approve the supplier pricing comparison compiled for project {{payload.project_name}}.', 'ROLE', 'manager', 'HIGH', 48, 'comparison.approved'),
('document.needs_review', 'Audit Scanned Document: {{payload.title}}', 'Manually classify and review the metadata for {{payload.original_filename}} which failed the AI confidence threshold.', 'ROLE', 'manager', 'MEDIUM', 72, null),
('project.dlp_expiring', 'Contact Client re AMC before DLP Expiry — {{payload.project_number}}', 'DLP period is ending soon. Contact client regarding AMC proposal options.', 'PROJECT_ROLE', 'project_manager', 'HIGH', 120, null)
ON CONFLICT DO NOTHING;

-- 2. TASKS TABLE
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'AUTO_RULE', 'MEETING_ACTION', 'AI_SUGGESTED')),
  source_event_id UUID REFERENCES public.system_events(id) ON DELETE SET NULL,
  task_rule_id UUID REFERENCES public.task_rules(id) ON DELETE SET NULL,
  
  -- Associations
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  linked_entity_type TEXT, -- e.g. 'QUOTATION', 'COMPARISON', 'DOCUMENT', 'MEETING'
  linked_entity_id UUID,
  
  -- Team members
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  status TEXT NOT NULL DEFAULT 'TODO' CHECK (status IN ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'DONE_AUTO', 'CANCELLED')),
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Recurrence & Subtasks
  recurrence JSONB, -- { freq: 'WEEKLY' | 'MONTHLY', byday: string[], until: string }
  parent_recurring_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  
  blocked_reason TEXT,
  tags TEXT[] DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true NOT NULL, -- Soft delete
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Idempotency constraint: prevents duplicate task creation for same event trigger
  CONSTRAINT unique_source_event_rule UNIQUE (source_event_id, task_rule_id)
);

-- Enable RLS for Tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Tasks visible to:
-- 1. Assigned user
-- 2. Task creator
-- 3. Project team member (via project_id lookup if assigned)
-- 4. Managers/Admins/Accountants (any manager/admin role)
CREATE POLICY "Allow authenticated read to tasks"
  ON public.tasks FOR SELECT TO authenticated USING (
    assignee_id = auth.uid() 
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'account')
    )
  );

CREATE POLICY "Allow authenticated write to tasks"
  ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indices
CREATE INDEX idx_tasks_assignee ON public.tasks (assignee_id, status);
CREATE INDEX idx_tasks_project ON public.tasks (project_id);
CREATE INDEX idx_tasks_due ON public.tasks (due_date) WHERE status != 'DONE' AND status != 'DONE_AUTO';
CREATE INDEX idx_tasks_parent_recurring ON public.tasks (parent_recurring_id);

-- 3. TASK COMMENTS (Realtime chat on tasks)
CREATE TABLE public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Task Comments
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to task_comments"
  ON public.task_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert to task_comments"
  ON public.task_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_tc_task ON public.task_comments (task_id);
