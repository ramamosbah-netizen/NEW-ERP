-- ============================================================
-- JEET ERP — AMC, PPM & Service Tickets Event Seeding
-- ============================================================

-- Seed Event Types
INSERT INTO public.event_types (event_type, module, description, default_severity) VALUES
('amc.activated', 'FINANCE', 'AMC contract officially activated', 'INFO'),
('amc.renewal_due', 'FINANCE', 'AMC contract is approaching its expiration date', 'ACTION_REQUIRED'),
('amc.suspension_warning', 'FINANCE', 'AMC contract suspension warning due to non-payment', 'CRITICAL'),
('amc.terminated', 'FINANCE', 'AMC contract terminated', 'CRITICAL'),
('amc.billing_due', 'FINANCE', 'AMC billing installment invoice generation trigger', 'INFO'),
('ppm.visit_scheduled', 'OPERATIONS', 'PPM maintenance visit scheduled', 'INFO'),
('ppm.visit_reminder', 'OPERATIONS', 'Upcoming PPM maintenance visit reminder (T-1 Day)', 'INFO'),
('ppm.completed', 'OPERATIONS', 'PPM maintenance visit successfully completed by technician', 'INFO'),
('ppm.defects_found', 'OPERATIONS', 'Defect items logged during PPM visit', 'ACTION_REQUIRED'),
('ppm.visit_missed', 'OPERATIONS', 'Scheduled PPM visit date passed without execution', 'CRITICAL'),
('ticket.created', 'OPERATIONS', 'New call-out service ticket logged', 'INFO'),
('ticket.assigned', 'OPERATIONS', 'Service ticket assigned to technician', 'INFO'),
('ticket.technician_dispatched', 'OPERATIONS', 'Technician dispatched to client site', 'INFO'),
('ticket.sla_warning', 'OPERATIONS', 'Service ticket is approaching SLA response/resolution limit', 'ACTION_REQUIRED'),
('ticket.sla_breached', 'OPERATIONS', 'Service ticket has breached its SLA response/resolution limit', 'CRITICAL'),
('ticket.resolved', 'OPERATIONS', 'Service ticket resolved by technician', 'INFO'),
('ticket.closed', 'OPERATIONS', 'Service ticket reviewed and officially closed', 'INFO')
ON CONFLICT (event_type) DO UPDATE SET 
  description = EXCLUDED.description,
  default_severity = EXCLUDED.default_severity;

-- Seed Notification Rules
INSERT INTO public.notification_rules (event_type, recipient_strategy, recipient_value, channels, severity, title_template, body_template, link_template, is_digest_eligible, escalation_hours, escalation_to_role) VALUES
-- AMC Rules
('amc.activated', 'ROLE', 'coordinator', '{IN_APP}', 'INFO', 'AMC Contract Activated: {{payload.contract_number}}', 'Contract for client {{payload.client_name}} covers {{payload.visits_per_year}} visits/yr.', '/amc/{{entity_id}}', true, null, null),
('amc.renewal_due', 'ROLE', 'coordinator', '{IN_APP,EMAIL}', 'ACTION_REQUIRED', 'AMC Renewal Due: {{payload.contract_number}}', 'AMC contract for client {{payload.client_name}} expires on {{payload.end_date}}. SIRA link: {{payload.sira_linked}}.', '/amc/renewal', false, 72, 'manager'),
('amc.suspension_warning', 'ROLE', 'account', '{IN_APP,EMAIL}', 'CRITICAL', 'SUSPENSION WARNING: {{payload.contract_number}}', 'Contract for client {{payload.client_name}} is at risk of suspension due to unpaid invoices.', '/amc/{{entity_id}}', false, null, null),
('amc.terminated', 'ROLE', 'manager', '{IN_APP,EMAIL}', 'CRITICAL', 'AMC Contract Terminated: {{payload.contract_number}}', 'AMC for {{payload.client_name}} terminated. Reason: {{payload.termination_reason}}', '/amc/{{entity_id}}', false, null, null),
('amc.billing_due', 'ROLE', 'account', '{IN_APP}', 'INFO', 'AMC Billing Due: {{payload.contract_number}}', 'Draft standalone client invoice generated for sequence {{payload.sequence}}.', '/finance/ar', true, null, null),

-- PPM Rules
('ppm.visit_scheduled', 'PROJECT_ROLE', 'project_manager', '{IN_APP}', 'INFO', 'PPM Visit Scheduled: {{payload.visit_number}}', 'Visit scheduled for {{payload.scheduled_date}} by technician {{payload.tech_name}}.', '/ppm/calendar', true, null, null),
('ppm.visit_reminder', 'ROLE', 'coordinator', '{IN_APP}', 'INFO', 'PPM Visit Reminder: {{payload.visit_number}}', 'Visit tomorrow at site {{payload.site_name}}.', '/ppm/calendar', true, null, null),
('ppm.completed', 'ROLE', 'coordinator', '{IN_APP}', 'INFO', 'PPM Visit Completed: {{payload.visit_number}}', 'Visit at {{payload.site_name}} finished. Report document filed.', '/amc/{{payload.contract_id}}', true, null, null),
('ppm.defects_found', 'ROLE', 'coordinator', '{IN_APP}', 'ACTION_REQUIRED', 'PPM Defects Found: {{payload.visit_number}}', 'Defect checks failed during PPM maintenance. Service ticket created.', '/service', false, 24, 'manager'),
('ppm.visit_missed', 'ROLE', 'coordinator', '{IN_APP,EMAIL}', 'CRITICAL', 'MISSED VISIT: {{payload.visit_number}}', 'Scheduled date {{payload.scheduled_date}} passed without execution.', '/ppm/calendar', false, null, null),

-- Service Tickets Rules
('ticket.created', 'ROLE', 'coordinator', '{IN_APP}', 'INFO', 'Service Ticket Logged: {{payload.ticket_number}}', 'Ticket: {{payload.title}} (SLA Tier: {{payload.sla_tier}}).', '/service/{{entity_id}}', true, null, null),
('ticket.assigned', 'PREPARED_BY', 'prepared_by', '{IN_APP}', 'INFO', 'Ticket Assigned: {{payload.ticket_number}}', 'Ticket {{payload.ticket_number}} has been assigned to you.', '/service/{{entity_id}}', false, null, null),
('ticket.technician_dispatched', 'ROLE', 'coordinator', '{IN_APP}', 'INFO', 'Tech Dispatched: {{payload.ticket_number}}', 'Technician has dispatched to site {{payload.site_address}}.', '/service/{{entity_id}}', true, null, null),
('ticket.sla_warning', 'ROLE', 'coordinator', '{IN_APP}', 'ACTION_REQUIRED', 'SLA Warning: Ticket {{payload.ticket_number}}', 'Ticket {{payload.ticket_number}} is approaching SLA limit (75% elapsed).', '/service/{{entity_id}}', false, null, null),
('ticket.sla_breached', 'ROLE', 'manager', '{IN_APP,EMAIL}', 'CRITICAL', 'SLA BREACHED: Ticket {{payload.ticket_number}}', 'Ticket {{payload.ticket_number}} has breached response/resolution SLA times.', '/service/{{entity_id}}', false, 12, 'admin'),
('ticket.resolved', 'ROLE', 'coordinator', '{IN_APP}', 'INFO', 'Ticket Resolved: {{payload.ticket_number}}', 'Ticket {{payload.ticket_number}} resolved by technician.', '/service/{{entity_id}}', true, null, null),
('ticket.closed', 'ROLE', 'account', '{IN_APP}', 'INFO', 'Ticket Closed: {{payload.ticket_number}}', 'Ticket closed. Chargeable invoice generated: {{payload.invoice_number}}.', '/finance/ar', true, null, null)
ON CONFLICT (event_type) DO NOTHING;
