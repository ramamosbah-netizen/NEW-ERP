// ============================================================
// JEET ERP — PPM (Planned Preventive Maintenance) Type Definitions
// ============================================================

export type PPMVisitStatus =
  | 'UNSCHEDULED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'MISSED'
  | 'CANCELLED';

export type ChecklistItemType = 'PASS_FAIL' | 'VALUE' | 'TEXT' | 'PHOTO_REQUIRED';

export type PPMVisit = {
  id: string;
  contract_id: string;
  visit_number: string;
  target_month: string; // ISO date string (YYYY-MM-DD), representing first day of the targeted month
  scheduled_date?: string; // YYYY-MM-DD
  scheduled_slot?: 'AM' | 'PM';
  technician_id?: string;
  second_technician_id?: string;
  status: PPMVisitStatus;
  started_at?: string; // Timestamp
  completed_at?: string; // Timestamp
  client_notified_at?: string; // Timestamp
  report_document_id?: string;
  client_signature_storage_path?: string;
  client_sign_name?: string;
  client_sign_designation?: string;
  summary?: string;
  recommendations?: string;
  created_at: string;

  // Populated fields (joins)
  amc_contracts?: any;
  contract_number?: string;
  client_name?: string;
  site_name?: string;
  site_address?: string;
  emirate?: string;
  technician_name?: string;
  second_technician_name?: string;
};

export type ChecklistTemplate = {
  id: string;
  name: string;
  system: string;
  description?: string;
  created_at: string;
  items?: ChecklistTemplateItem[];
};

export type ChecklistTemplateItem = {
  id: string;
  template_id: string;
  item_text: string;
  item_type: ChecklistItemType;
  sort_order: number;
  created_at: string;
};

export type PPMVisitChecklistResult = {
  id: string;
  visit_id: string;
  template_item_id: string;
  equipment_id?: string;
  result: 'PASS' | 'FAIL' | 'NA';
  value?: string;
  photo_paths: string[];
  notes?: string;
  created_at: string;

  // Joined details
  item_text?: string;
  item_type?: ChecklistItemType;
  equipment_label?: string;
};
