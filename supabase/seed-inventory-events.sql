-- ============================================================
-- JEET ERP — Inventory & Tools Module Event Seeding
-- ============================================================

-- 1. Seed Event Types
INSERT INTO public.event_types (event_type, module, description, default_severity) VALUES
('stock.reorder_needed', 'PROCUREMENT', 'Stock balance falls below reorder levels', 'ACTION_REQUIRED'),
('stock.consumption_over_boq', 'PROJECTS', 'Project issued materials exceed planned BOQ quantities', 'ACTION_REQUIRED'),
('tool.return_overdue', 'OPERATIONS', 'Issued tool/equipment return date has passed', 'ACTION_REQUIRED'),
('tool.calibration_due', 'OPERATIONS', 'Measuring instrument calibration expiration date approaching', 'ACTION_REQUIRED')
ON CONFLICT (event_type) DO UPDATE SET 
  description = EXCLUDED.description,
  default_severity = EXCLUDED.default_severity;

-- 2. Seed Notification Rules
DELETE FROM public.notification_rules WHERE event_type IN (
  'stock.reorder_needed', 'stock.consumption_over_boq',
  'tool.return_overdue', 'tool.calibration_due'
);

INSERT INTO public.notification_rules (
  event_type, recipient_strategy, recipient_value, channels, severity, 
  title_template, body_template, link_template, is_digest_eligible, 
  escalation_hours, escalation_to_role
) VALUES
-- Stock Reorder Alert
(
  'stock.reorder_needed', 
  'ROLE', 
  'procurement', 
  '{IN_APP,EMAIL}', 
  'ACTION_REQUIRED', 
  'Stock Reorder: {{payload.item_name}}', 
  'Reorder {{payload.item_name}}, suggested qty {{payload.reorder_qty}} {{payload.unit}}. Preferred Supplier: {{payload.supplier_name}}.', 
  '/stores/items/{{entity_id}}', 
  true, 
  null, 
  null
),

-- BOQ Over-consumption Alert
(
  'stock.consumption_over_boq', 
  'ROLE', 
  'pm', 
  '{IN_APP,EMAIL}', 
  'ACTION_REQUIRED', 
  'BOQ Over-consumption: Project {{payload.project_number}}', 
  'Material {{payload.item_name}} has exceeded its BOQ budget by {{payload.variance_qty}} {{payload.unit}}. Actual Issued: {{payload.issued_qty}}, Planned BOQ: {{payload.boq_qty}}.', 
  '/stores/variance', 
  false, 
  24, 
  'commercial_mgr'
),

-- Tool Return Overdue Alert
(
  'tool.return_overdue', 
  'ROLE', 
  'storekeeper', 
  '{IN_APP,EMAIL}', 
  'ACTION_REQUIRED', 
  'Overdue Return: Tool {{payload.tool_number}}', 
  'Tool {{payload.tool_number}} ({{payload.tool_name}}) assigned to {{payload.custodian_name}} was expected back on {{payload.expected_return_date}}.', 
  '/tools/{{entity_id}}', 
  false, 
  48, 
  'manager'
),

-- Tool Calibration Due Alert
(
  'tool.calibration_due', 
  'ROLE', 
  'storekeeper', 
  '{IN_APP,EMAIL}', 
  'ACTION_REQUIRED', 
  'Calibration Required: Tool {{payload.tool_number}}', 
  'Test instrument {{payload.tool_number}} ({{payload.tool_name}}) calibration is due on {{payload.next_calibration_due}}. Days remaining: {{payload.days_remaining}}.', 
  '/tools/calibration', 
  true, 
  null, 
  null
);
