// ============================================================
// JEET ERP — Testing & Commissioning (T&C) Module Type Definitions
// ============================================================

export type TCPackageStatus =
  | 'DRAFT'
  | 'READY'
  | 'IN_PROGRESS'
  | 'INTERNAL_PASSED'
  | 'WITNESS_SCHEDULED'
  | 'CONSULTANT_APPROVED'
  | 'CLIENT_APPROVED'
  | 'COMPLETED'
  | 'FAILED_RETEST';

export type WitnessRequired = 'INTERNAL_ONLY' | 'CONSULTANT' | 'CLIENT' | 'BOTH';

export type ScriptType = 'DEVICE_LEVEL' | 'SYSTEM_LEVEL' | 'INTEGRATION';

export interface TCPackage {
  id: string;
  package_number: string;
  project_id: string;
  system: string;
  title: string;
  status: TCPackageStatus;
  assigned_engineer_id?: string;
  witness_required: WitnessRequired;
  scheduled_witness_date?: string;
  method_statement_document_id?: string;
  completion_pct: number;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;

  // Joined fields
  project_name?: string;
  project_number?: string;
  assigned_engineer_name?: string;
  created_by_name?: string;
}

export interface TCScriptTemplate {
  id: string;
  name: string;
  system: string;
  description?: string;
  created_at: string;
}

export interface TCScriptTemplateItem {
  id: string;
  template_id: string;
  script_type: ScriptType;
  test_item: string;
  expected: string;
  sort_order: number;
  created_at: string;
}

export interface TCTestScript {
  id: string;
  package_id: string;
  script_type: ScriptType;
  title: string;
  expected: string;
  sort_order: number;
}

export interface TCDevice {
  id: string;
  package_id: string;
  device_type: string;
  label: string;
  location: string;
  brand_model?: string;
  serial?: string;
  ip_address?: string;
  status: 'PENDING' | 'PASSED' | 'FAILED' | 'NA';
}

export interface TCTestResult {
  id: string;
  script_id: string;
  device_id?: string;
  test_item: string;
  expected: string;
  result: 'PASS' | 'FAIL' | 'NA';
  measured_value?: string;
  photo_paths: string[];
  tested_by: string;
  tested_at: string;
  retest_of_id?: string;
  snag_id?: string;
  measuring_instrument_id?: string;

  // Joined fields
  tested_by_name?: string;
  device_label?: string;
  device_location?: string;
}

export interface TCWitness {
  id: string;
  package_id: string;
  witness_stage: 'INTERNAL' | 'CONSULTANT' | 'CLIENT';
  witness_name: string;
  designation: string;
  company: string;
  signature_path?: string;
  result: 'APPROVED' | 'APPROVED_WITH_COMMENTS' | 'REJECTED';
  comments?: string;
  witnessed_at: string;
}
