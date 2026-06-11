-- ============================================================
-- JEET ERP — Platform Layer: Notification Engine Schema
-- Notification dispatch rules, delivery queues, preferences, escalations
-- ============================================================

-- Reset tables safely
DROP TABLE IF EXISTS public.escalation_timers CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.user_notification_preferences CASCADE;
DROP TABLE IF EXISTS public.notification_rules CASCADE;

-- 1. NOTIFICATION RULES (Event mapping configurations)
CREATE TABLE public.notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL REFERENCES public.event_types(event_type) ON DELETE CASCADE,
  recipient_strategy TEXT NOT NULL CHECK (recipient_strategy IN ('ROLE', 'PROJECT_ROLE', 'SPECIFIC_USER_FROM_PAYLOAD', 'PREPARED_BY')),
  recipient_value TEXT, -- e.g. 'manager', 'site_engineer', 'prepared_by', 'next_approver_id'
  channels TEXT[] NOT NULL DEFAULT '{IN_APP,EMAIL}'::TEXT[],
  severity TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'ACTION_REQUIRED', 'CRITICAL')),
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  link_template TEXT NOT NULL, -- deep link template, e.g. '/quotations/{{payload.quotation_id}}'
  is_digest_eligible BOOLEAN DEFAULT false NOT NULL,
  escalation_hours INTEGER, -- Null means no escalation
  escalation_to_role TEXT, -- Role to escalate to
  is_active BOOLEAN DEFAULT true NOT NULL
);

-- Enable RLS for Notification Rules
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to notification_rules"
  ON public.notification_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin write to notification_rules"
  ON public.notification_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed Notification Rules
INSERT INTO public.notification_rules (event_type, recipient_strategy, recipient_value, channels, severity, title_template, body_template, link_template, is_digest_eligible, escalation_hours, escalation_to_role) VALUES
-- Quotations
('quotation.submitted', 'ROLE', 'manager', '{IN_APP,EMAIL}', 'ACTION_REQUIRED', 'Quotation {{payload.quotation_number}} Submitted', 'Quotation for {{payload.client_name}} ({{payload.subtotal_after_discount}} AED) prepared by {{payload.prepared_by_name}} is pending review.', '/quotations/{{entity_id}}', false, 48, 'admin'),
('quotation.approved', 'PREPARED_BY', 'prepared_by', '{IN_APP}', 'INFO', 'Quotation {{payload.quotation_number}} Approved', 'Your quotation for {{payload.client_name}} has been approved by {{payload.approver_name}}.', '/quotations/{{entity_id}}', true, null, null),
('quotation.rejected', 'PREPARED_BY', 'prepared_by', '{IN_APP,EMAIL}', 'CRITICAL', 'Quotation {{payload.quotation_number}} Returned', 'Quotation returned for revision by {{payload.approver_name}}. Comment: {{payload.comment}}', '/quotations/{{entity_id}}', false, null, null),
('quotation.accepted_by_client', 'ROLE', 'manager', '{IN_APP}', 'INFO', 'Quotation {{payload.quotation_number}} Accepted by Client', 'Quotation has been accepted by {{payload.client_name}} with PO {{payload.client_po_number}}.', '/quotations/{{entity_id}}', true, null, null),

-- Comparisons
('comparison.submitted', 'ROLE', 'manager', '{IN_APP,EMAIL}', 'ACTION_REQUIRED', 'Comparison {{payload.comparison_number}} Awaiting Approval', 'Comparison sheet for project {{payload.project_name}} (Total: {{payload.total}} AED) requires review.', '/procurement/comparisons/{{entity_id}}', false, 48, 'admin'),
('comparison.approved', 'PREPARED_BY', 'prepared_by', '{IN_APP}', 'INFO', 'Comparison {{payload.comparison_number}} Approved', 'Your supplier comparison has been approved and compiled.', '/procurement/comparisons/{{entity_id}}', true, null, null),

-- Projects
('project.created', 'ROLE', 'engineer', '{IN_APP}', 'INFO', 'New Project {{payload.project_number}} Created', 'Project {{payload.name}} has been initialized.', '/projects/{{entity_id}}', true, null, null),
('project.status_changed', 'PROJECT_ROLE', 'project_manager', '{IN_APP}', 'INFO', 'Project {{payload.project_number}} Status Updated', 'Project status transitioned from {{payload.from}} to {{payload.to}}.', '/projects/{{entity_id}}', true, null, null),
('project.dlp_expiring', 'PROJECT_ROLE', 'project_manager', '{IN_APP,EMAIL}', 'CRITICAL', 'DLP Period Expiring for Project {{payload.project_number}}', 'Project warranty (DLP) ends in {{payload.days_remaining}} days.', '/projects/{{entity_id}}', false, null, null),

-- Documents
('document.needs_review', 'ROLE', 'manager', '{IN_APP}', 'ACTION_REQUIRED', 'DMS Document Needs Review: {{payload.title}}', 'Uploaded document {{payload.original_filename}} failed high-confidence AI check and requires manual audit.', '/documents/review', false, null, null),
('document.expiring', 'PROJECT_ROLE', 'project_manager', '{IN_APP,EMAIL}', 'CRITICAL', 'Compliance Document Expiring: {{payload.title}}', 'Compliance record {{payload.original_filename}} expires on {{payload.expiry_date}} ({{payload.days_remaining}} days remaining).', '/documents/expiry', false, null, null),

-- Tasks
('task.assigned', 'SPECIFIC_USER_FROM_PAYLOAD', 'assignee_id', '{IN_APP}', 'INFO', 'New Task Assigned: {{payload.title}}', 'You have been assigned a task: {{payload.description}}', '/tasks', true, null, null),
('task.due_soon', 'SPECIFIC_USER_FROM_PAYLOAD', 'assignee_id', '{IN_APP}', 'INFO', 'Task Due Soon: {{payload.title}}', 'Task is due on {{payload.due_date}}.', '/tasks', true, null, null),
('task.overdue', 'SPECIFIC_USER_FROM_PAYLOAD', 'assignee_id', '{IN_APP,EMAIL}', 'CRITICAL', 'Task OVERDUE: {{payload.title}}', 'Task was due on {{payload.due_date}} and is unresolved.', '/tasks', false, null, null),

-- Meetings
('meeting.scheduled', 'SPECIFIC_USER_FROM_PAYLOAD', 'attendees', '{IN_APP}', 'INFO', 'Meeting Scheduled: {{payload.title}}', 'You are invited to a meeting starting at {{payload.starts_at}}.', '/meetings', true, null, null),
('meeting.minutes_published', 'SPECIFIC_USER_FROM_PAYLOAD', 'attendees', '{IN_APP}', 'INFO', 'Minutes Published: {{payload.title}}', 'Meeting minutes and action items have been compiled.', '/meetings', true, null, null),

-- Escalations
('approval.escalation', 'ROLE', 'admin', '{IN_APP,EMAIL}', 'CRITICAL', 'ESCALATION: Pending approval action required', 'Approver failed to act within the business hours limit for quotation or comparison.', '/dashboard', false, null, null)
ON CONFLICT DO NOTHING;

-- 2. USER NOTIFICATION PREFERENCES
CREATE TABLE public.user_notification_preferences (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_module TEXT NOT NULL, -- e.g. 'QUOTATION', 'COMPARISON', 'PROJECTS', 'DMS', 'TASKS', 'MEETINGS'
  channel TEXT NOT NULL CHECK (channel IN ('IN_APP', 'EMAIL', 'WHATSAPP')),
  mode TEXT NOT NULL CHECK (mode IN ('INSTANT', 'DIGEST', 'OFF')),
  PRIMARY KEY (user_id, event_module, channel)
);

-- Enable RLS for Preferences
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to view own preferences"
  ON public.user_notification_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow users to update own preferences"
  ON public.user_notification_preferences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. NOTIFICATIONS DELIVERY TABLE
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES public.system_events(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('IN_APP', 'EMAIL', 'WHATSAPP')),
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'ACTION_REQUIRED', 'CRITICAL')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'DELIVERED', 'READ', 'ACTIONED', 'FAILED', 'SKIPPED_CHANNEL_INACTIVE')),
  read_at TIMESTAMP WITH TIME ZONE,
  actioned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Idempotency constraint: prevents sending same notification channel to same user multiple times
  CONSTRAINT unique_event_user_channel UNIQUE (event_id, user_id, channel)
);

-- Enable RLS for Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to read own notifications"
  ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow users to update own notifications"
  ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Indices
CREATE INDEX idx_notif_user_status ON public.notifications (user_id, status);
CREATE INDEX idx_notif_user_created ON public.notifications (user_id, created_at DESC);

-- 4. ESCALATION TIMERS
CREATE TABLE public.escalation_timers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.system_events(id) ON DELETE CASCADE NOT NULL,
  notification_rule_id UUID REFERENCES public.notification_rules(id) ON DELETE CASCADE NOT NULL,
  escalate_at TIMESTAMP WITH TIME ZONE NOT NULL,
  escalated BOOLEAN DEFAULT false NOT NULL,
  cancelled BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Escalation Timers
ALTER TABLE public.escalation_timers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to escalation_timers"
  ON public.escalation_timers FOR SELECT TO authenticated USING (true);

-- Indices
CREATE INDEX idx_et_due ON public.escalation_timers (escalate_at) WHERE escalated = false AND cancelled = false;
CREATE INDEX idx_et_event ON public.escalation_timers (event_id);
