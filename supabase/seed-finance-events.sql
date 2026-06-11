-- ============================================================
-- JEET ERP — Finance Event Types and Notification Rules
-- ============================================================

-- Seed Event Types
INSERT INTO public.event_types (event_type, module, description, default_severity) VALUES
('invoice.submitted', 'FINANCE', 'Client invoice draft submitted for approval', 'ACTION_REQUIRED'),
('invoice.approved', 'FINANCE', 'Client invoice approved and ready to send', 'INFO'),
('invoice.sent', 'FINANCE', 'Client invoice officially sent to client', 'INFO'),
('invoice.payment_received', 'FINANCE', 'Payment received and allocated to client invoice', 'INFO'),
('invoice.overdue', 'FINANCE', 'Client invoice has passed its due date without payment', 'CRITICAL'),
('invoice.written_off', 'FINANCE', 'Client invoice written off by management', 'CRITICAL'),
('supplier_invoice.match_exception', 'FINANCE', 'Supplier invoice 3-way match failed (qty/price exception)', 'ACTION_REQUIRED'),
('project.margin_erosion', 'FINANCE', 'Project actual/committed cost exceeds BOQ budget margin threshold', 'CRITICAL')
ON CONFLICT (event_type) DO UPDATE SET 
  description = EXCLUDED.description,
  default_severity = EXCLUDED.default_severity;

-- Seed Notification Rules
INSERT INTO public.notification_rules (event_type, recipient_strategy, recipient_value, channels, severity, title_template, body_template, link_template, is_digest_eligible, escalation_hours, escalation_to_role) VALUES
-- Client Invoices
('invoice.submitted', 'ROLE', 'manager', '{IN_APP,EMAIL}', 'ACTION_REQUIRED', 'Invoice {{payload.invoice_number}} Submitted for Approval', 'Invoice for client {{payload.client_name}} ({{payload.net_due}} AED) is pending review.', '/finance/ar/{{entity_id}}', false, 48, 'admin'),
('invoice.approved', 'PREPARED_BY', 'prepared_by', '{IN_APP}', 'INFO', 'Invoice {{payload.invoice_number}} Approved', 'Your invoice for client {{payload.client_name}} has been approved by {{payload.approved_by_name}}.', '/finance/ar/{{entity_id}}', true, null, null),
('invoice.sent', 'ROLE', 'account', '{IN_APP}', 'INFO', 'Invoice {{payload.invoice_number}} Sent', 'Invoice has been marked as SENT to client {{payload.client_name}}.', '/finance/ar/{{entity_id}}', true, null, null),
('invoice.payment_received', 'ROLE', 'account', '{IN_APP}', 'INFO', 'Payment Received: {{payload.payment_number}}', 'Payment of {{payload.amount}} AED received and allocated to {{payload.invoice_number}}.', '/finance/ar/{{entity_id}}', true, null, null),
('invoice.overdue', 'ROLE', 'account', '{IN_APP,EMAIL}', 'CRITICAL', 'OVERDUE: Invoice {{payload.invoice_number}}', 'Invoice for client {{payload.client_name}} ({{payload.net_due}} AED) was due on {{payload.due_date}} and remains unpaid.', '/finance/ar/{{entity_id}}', false, 72, 'manager'),
('invoice.written_off', 'ROLE', 'manager', '{IN_APP,EMAIL}', 'CRITICAL', 'Invoice {{payload.invoice_number}} Written Off', 'Invoice for client {{payload.client_name}} has been written off. Reason: {{payload.write_off_reason}}', '/finance/ar/{{entity_id}}', false, null, null),

-- Supplier Invoices
('supplier_invoice.match_exception', 'ROLE', 'account', '{IN_APP,EMAIL}', 'ACTION_REQUIRED', '3-Way Match Exception: {{payload.supplier_invoice_number}}', 'Supplier invoice {{payload.supplier_invoice_number}} from {{payload.supplier_name}} failed 3-way match. Exceptions: {{payload.exceptions}}', '/finance/ap/match/{{entity_id}}', false, 24, 'manager'),

-- Project Financials
('project.margin_erosion', 'PROJECT_ROLE', 'project_manager', '{IN_APP,EMAIL}', 'CRITICAL', 'Margin Erosion Alert: Project {{payload.project_number}}', 'Project {{payload.project_name}} margin has eroded. Committed cost + actual cost exceeds 95% of contract value.', '/projects/{{entity_id}}', false, null, null)
ON CONFLICT (event_type) DO NOTHING;
