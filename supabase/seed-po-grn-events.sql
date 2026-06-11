INSERT INTO public.event_types (event_type, module, description, default_severity) VALUES
('po.created', 'PROCUREMENT', 'Local Purchase Order draft created', 'INFO'),
('po.submitted', 'PROCUREMENT', 'Local Purchase Order submitted for manager approval', 'ACTION_REQUIRED'),
('po.approved', 'PROCUREMENT', 'Local Purchase Order approved and signed off', 'INFO'),
('po.rejected', 'PROCUREMENT', 'Local Purchase Order rejected during sign-off review', 'INFO'),
('po.sent', 'PROCUREMENT', 'LPO officially sent to supplier', 'INFO'),
('po.acknowledged', 'PROCUREMENT', 'Supplier acknowledged and confirmed delivery date', 'INFO'),
('po.cancelled', 'PROCUREMENT', 'Local Purchase Order cancelled', 'INFO'),
('po.fully_delivered', 'PROCUREMENT', 'All materials on the LPO successfully received at site/store', 'INFO'),
('po.partially_delivered', 'PROCUREMENT', 'Partial materials on the LPO received', 'INFO'),
('po.revised', 'PROCUREMENT', 'Purchase Order revised and a new revision created', 'INFO'),
('grn.recorded', 'PROCUREMENT', 'Goods Receipt Note logged at site or warehouse', 'INFO'),
('grn.returned', 'PROCUREMENT', 'Defective materials returned or credit ticket updated', 'ACTION_REQUIRED')
ON CONFLICT (event_type) DO UPDATE SET 
  description = EXCLUDED.description,
  default_severity = EXCLUDED.default_severity;
