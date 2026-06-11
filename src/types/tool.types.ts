// ============================================================
// JEET ERP — Tools & Equipment Register Type Definitions
// ============================================================

export type ToolCategory =
  | 'TEST_INSTRUMENT'
  | 'POWER_TOOL'
  | 'HAND_TOOL'
  | 'ACCESS_EQUIPMENT'
  | 'SAFETY'
  | 'IT_DEVICE';

export type ToolStatus =
  | 'AVAILABLE'
  | 'ISSUED'
  | 'UNDER_MAINTENANCE'
  | 'UNDER_CALIBRATION'
  | 'LOST'
  | 'RETIRED';

export type ToolCondition = 'GOOD' | 'FAIR' | 'NEEDS_REPAIR';

export interface Tool {
  id: string;
  tool_number: string;
  name: string;
  category: ToolCategory;
  brand_model?: string | null;
  serial_no?: string | null;
  purchase_date?: string | null;
  purchase_cost?: number | null;
  supplier_id?: string | null;
  status: ToolStatus;
  current_custodian_id?: string | null;
  current_location_id?: string | null;
  requires_calibration: boolean;
  calibration_interval_months?: number | null;
  last_calibration_date?: string | null;
  next_calibration_due?: string | null;
  calibration_cert_document_id?: string | null;
  condition: ToolCondition;
  photo_path?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // Joined
  custodian_name?: string;
  location_name?: string;
  supplier_name?: string;
  calibration_cert_name?: string;
}

export interface ToolAssignment {
  id: string;
  tool_id: string;
  issued_to: string;
  issued_by: string;
  issue_date: string;
  project_id?: string | null;
  expected_return_date?: string | null;
  returned_date?: string | null;
  issue_condition: ToolCondition;
  return_condition?: ToolCondition | null;
  issue_signature_path?: string | null;
  notes?: string | null;

  // Joined
  tool_number?: string;
  tool_name?: string;
  issued_to_name?: string;
  issued_by_name?: string;
  project_number?: string;
  project_name?: string;
}

export interface ToolMaintenance {
  id: string;
  tool_id: string;
  type: 'CALIBRATION' | 'REPAIR' | 'SERVICE';
  performed_date: string;
  vendor: string;
  cost: number;
  certificate_document_id?: string | null;
  next_due_date?: string | null;
  notes?: string | null;
  created_at: string;

  // Joined
  tool_number?: string;
  tool_name?: string;
  cert_document_name?: string;
}
