-- ============================================================
-- JEET ERP — T&C, Snags, and Handover Event Seeding
-- ============================================================

-- 1. Seed Event Types
INSERT INTO public.event_types (event_type, module, description, default_severity) VALUES
('tc.ready_for_witness', 'OPERATIONS', 'T&C Package internal tests passed, awaiting witness scheduled validation', 'ACTION_REQUIRED'),
('tc.completed', 'OPERATIONS', 'T&C Package officially approved by consultant or client witness', 'INFO'),
('tc.witness_rejected', 'OPERATIONS', 'T&C witness validation failed, package returned with snags', 'CRITICAL'),
('snag.created', 'OPERATIONS', 'New snag logged on punch list', 'INFO'),
('snag.overdue', 'OPERATIONS', 'Snag resolution target date passed', 'ACTION_REQUIRED'),
('snag.critical_open', 'OPERATIONS', 'Daily digest alert for pending critical snags blocking handover', 'CRITICAL'),
('snag.all_closed', 'OPERATIONS', 'All snags closed for project, unblocking handover closeout', 'INFO'),
('project.handed_over', 'FINANCE', 'Project handed over to client, DLP period started', 'INFO'),
('amc.opportunity', 'FINANCE', 'AMC sales proposal opportunity generated from DLP transition', 'INFO')
ON CONFLICT (event_type) DO UPDATE SET 
  description = EXCLUDED.description,
  default_severity = EXCLUDED.default_severity;

-- 2. Seed Notification Rules
DELETE FROM public.notification_rules WHERE event_type IN (
  'tc.ready_for_witness', 'tc.completed', 'tc.witness_rejected',
  'snag.created', 'snag.overdue', 'snag.critical_open', 'snag.all_closed',
  'project.handed_over', 'amc.opportunity'
);

INSERT INTO public.notification_rules (event_type, recipient_strategy, recipient_value, channels, severity, title_template, body_template, link_template, is_digest_eligible, escalation_hours, escalation_to_role) VALUES
-- T&C Rules
('tc.ready_for_witness', 'ROLE', 'coordinator', '{IN_APP}', 'ACTION_REQUIRED', 'T&C Witess Scheduled: {{payload.package_number}}', 'Package {{payload.package_number}} ({{payload.system}}) is ready for witness validation on {{payload.scheduled_witness_date}}.', '/tc/{{entity_id}}', false, null, null),
('tc.completed', 'ROLE', 'coordinator', '{IN_APP}', 'INFO', 'T&C Package Approved: {{payload.package_number}}', 'T&C package for {{payload.system}} approved by witness {{payload.witness_name}}.', '/tc/{{entity_id}}', true, null, null),
('tc.witness_rejected', 'ROLE', 'coordinator', '{IN_APP,EMAIL}', 'CRITICAL', 'T&C Witness REJECTED: {{payload.package_number}}', 'T&C witness validation failed for {{payload.system}}. Remarks: {{payload.comments}}.', '/tc/{{entity_id}}', false, 12, 'manager'),

-- Snags Rules
('snag.created', 'SPECIFIC_USER_FROM_PAYLOAD', 'assigned_to', '{IN_APP}', 'INFO', 'New Snag Assigned: {{payload.snag_number}}', 'You have been assigned snag {{payload.snag_number}} at {{payload.location}}: {{payload.description}}.', '/snags', true, null, null),
('snag.overdue', 'SPECIFIC_USER_FROM_PAYLOAD', 'assigned_to', '{IN_APP,EMAIL}', 'ACTION_REQUIRED', 'Snag OVERDUE: {{payload.snag_number}}', 'Target date {{payload.target_date}} for snag {{payload.snag_number}} has passed without verification.', '/snags', false, 24, 'manager'),
('snag.critical_open', 'PROJECT_ROLE', 'project_manager', '{IN_APP,EMAIL}', 'CRITICAL', 'BLOCKER: Open Critical Snags for {{payload.project_number}}', 'Your project has {{payload.open_critical_count}} critical open snags blocking closeout.', '/snags', false, null, null),
('snag.all_closed', 'PROJECT_ROLE', 'project_manager', '{IN_APP}', 'INFO', 'Handover Unblocked: All Snags Closed', 'All snags for project {{payload.project_name}} are closed. Handover closeout package is now unblocked.', '/handover', false, null, null),

-- Handover Rules
('project.handed_over', 'ROLE', 'account', '{IN_APP,EMAIL}', 'INFO', 'Project Handed Over: {{payload.project_number}}', 'Project {{payload.project_name}} has completed handover. DLP ends on {{payload.dlp_end_date}}. First retention release due.', '/handover', false, null, null),
('amc.opportunity', 'ROLE', 'manager', '{IN_APP}', 'INFO', 'AMC Pipeline: Opportunity for {{payload.project_number}}', 'Prepare AMC proposal proposal for project {{payload.project_name}}. DLP ends on {{payload.dlp_end_date}}.', '/amc/renewal', true, null, null);
