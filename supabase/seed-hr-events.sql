-- ============================================================
-- JEET ERP — HR, Timesheets, and Payroll Event Seeding
-- ============================================================

-- 1. Seed Event Types
INSERT INTO public.event_types (event_type, module, description, default_severity) VALUES
('hr.document_expiring', 'OPERATIONS', 'UAE employee master document or certification approaching expiry', 'ACTION_REQUIRED'),
('hr.visa_expired_critical', 'OPERATIONS', 'CRITICAL: Visa or Labour Card expired for ACTIVE employee (legal violation risk)', 'CRITICAL'),
('timesheet.submitted', 'OPERATIONS', 'Employee timesheet submitted for approval', 'INFO'),
('timesheet.approved', 'OPERATIONS', 'Timesheet approved by department head or PM', 'INFO'),
('timesheet.rejected', 'OPERATIONS', 'Timesheet rejected with reasons provided', 'ACTION_REQUIRED'),
('leave.submitted', 'OPERATIONS', 'Leave request submitted for approval', 'INFO'),
('leave.approved', 'OPERATIONS', 'Leave request approved and balance updated', 'INFO'),
('leave.rejected', 'OPERATIONS', 'Leave request rejected', 'INFO'),
('payroll.approved', 'FINANCE', 'Monthly payroll run officially approved and locked', 'INFO')
ON CONFLICT (event_type) DO UPDATE SET 
  description = EXCLUDED.description,
  default_severity = EXCLUDED.default_severity;

-- 2. Seed Notification Rules
DELETE FROM public.notification_rules WHERE event_type IN (
  'hr.document_expiring', 'hr.visa_expired_critical',
  'timesheet.submitted', 'timesheet.approved', 'timesheet.rejected',
  'leave.submitted', 'leave.approved', 'leave.rejected',
  'payroll.approved'
);

INSERT INTO public.notification_rules (event_type, recipient_strategy, recipient_value, channels, severity, title_template, body_template, link_template, is_digest_eligible, escalation_hours, escalation_to_role) VALUES
-- HR Expiry Rules
('hr.document_expiring', 'ROLE', 'hr', '{IN_APP,EMAIL}', 'ACTION_REQUIRED', 'HR Compliance: {{payload.doc_type}} Expiring', 'Renew {{payload.doc_type}} for {{payload.employee_name}} — expires on {{payload.expiry_date}}.', '/hr/{{entity_id}}', true, null, null),
('hr.visa_expired_critical', 'ROLE', 'hr', '{IN_APP,EMAIL}', 'CRITICAL', 'CRITICAL VIOLATION: Visa/Labour Card Expired for {{payload.employee_name}}', 'ACTIVE employee {{payload.employee_name}} has an expired {{payload.doc_type}} (Expired {{payload.expiry_date}}). Immediate action required to avoid MOHRE fines.', '/hr/{{entity_id}}', false, 24, 'gm'),

-- Timesheet Rules
('timesheet.submitted', 'ROLE', 'manager', '{IN_APP}', 'INFO', 'Timesheet Submitted: {{payload.employee_name}}', 'Timesheet for week starting {{payload.week_start}} has been submitted for review.', '/timesheets/approvals', false, null, null),
('timesheet.approved', 'SPECIFIC_USER_FROM_PAYLOAD', 'user_id', '{IN_APP}', 'INFO', 'Timesheet Approved: Week {{payload.week_start}}', 'Your timesheet for week starting {{payload.week_start}} has been approved.', '/timesheets', true, null, null),
('timesheet.rejected', 'SPECIFIC_USER_FROM_PAYLOAD', 'user_id', '{IN_APP,EMAIL}', 'ACTION_REQUIRED', 'Timesheet REJECTED: Week {{payload.week_start}}', 'Your timesheet for week starting {{payload.week_start}} was rejected. Reason: {{payload.rejection_reason}}', '/timesheets', false, null, null),

-- Leave Rules
('leave.submitted', 'ROLE', 'manager', '{IN_APP}', 'INFO', 'Leave Request: {{payload.employee_name}}', 'Leave request for {{payload.days}} days ({{payload.leave_type}}) submitted from {{payload.from_date}} to {{payload.to_date}}.', '/hr/approvals', false, null, null),
('leave.approved', 'SPECIFIC_USER_FROM_PAYLOAD', 'user_id', '{IN_APP,EMAIL}', 'INFO', 'Leave Request Approved: {{payload.from_date}}', 'Your request for {{payload.leave_type}} leave from {{payload.from_date}} to {{payload.to_date}} has been approved.', '/hr/leave', true, null, null),
('leave.rejected', 'SPECIFIC_USER_FROM_PAYLOAD', 'user_id', '{IN_APP}', 'INFO', 'Leave Request Rejected: {{payload.from_date}}', 'Your request for {{payload.leave_type}} leave starting {{payload.from_date}} was rejected.', '/hr/leave', false, null, null),

-- Payroll Rules
('payroll.approved', 'ROLE', 'account', '{IN_APP,EMAIL}', 'INFO', 'Payroll Run Approved: {{payload.period_month}}', 'The payroll run for {{payload.period_month}} has been approved and locked. SIF file is ready for WPS submission.', '/payroll', false, null, null);
