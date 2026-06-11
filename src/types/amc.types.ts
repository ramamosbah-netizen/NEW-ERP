// ============================================================
// JEET ERP — AMC Contract Module Type Definitions
// ============================================================

export type AMCContractStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'ACTIVE'
  | 'EXPIRING'
  | 'EXPIRED'
  | 'RENEWED'
  | 'TERMINATED'
  | 'SUSPENDED';

export type AMCContractType = 'COMPREHENSIVE' | 'NON_COMPREHENSIVE' | 'LABOUR_ONLY';

export type SLATier = 'STANDARD' | 'PRIORITY' | 'CRITICAL';

export type BillingFrequency = 'ANNUAL_ADVANCE' | 'SEMI_ANNUAL' | 'QUARTERLY' | 'MONTHLY';

export type AMCEquipmentCondition = 'GOOD' | 'FAIR' | 'POOR' | 'FAULTY';

export type AMCContract = {
  id: string;
  contract_number: string;
  client_id: string;
  client_name: string;
  client_trn?: string;
  client_address?: string;
  site_name: string;
  site_address: string;
  emirate: 'DUBAI' | 'ABU_DHABI' | 'SHARJAH' | 'AJMAN' | 'UMM_AL_QUWAIN' | 'RAS_AL_KHAIMAH' | 'FUJAIRAH';
  origin_project_id?: string;
  origin_quotation_id?: string;
  contract_type: AMCContractType;
  systems: string[];
  coverage_matrix: Record<string, any>;
  parts_included: boolean;
  parts_cap_aed?: number;
  visits_per_year: number;
  sla_tier: SLATier;
  response_hours: number;
  resolution_hours: number;
  emergency_callouts_included?: number;
  annual_value: number;
  billing_frequency: BillingFrequency;
  start_date: string;
  end_date: string;
  auto_renewal: boolean;
  sira_linked: boolean;
  sira_expiry_date?: string;
  status: AMCContractStatus;
  renewed_to_id?: string;
  renewed_from_id?: string;
  termination_reason?: string;
  contract_document_id?: string;
  notes?: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;

  // Populated fields (joins)
  equipment?: AMCEquipment[];
  billing_schedule?: AMCBillingSchedule[];
};

export type AMCEquipment = {
  id: string;
  contract_id: string;
  system: string;
  equipment_type: string;
  brand: string;
  model: string;
  serial_no?: string;
  location_label: string;
  install_date?: string;
  condition: AMCEquipmentCondition;
  notes?: string;
  created_at: string;
};

export type AMCBillingSchedule = {
  id: string;
  contract_id: string;
  sequence: number;
  due_date: string;
  amount: number;
  status: 'PENDING' | 'INVOICED' | 'PAID';
  invoice_id?: string;
  created_at: string;
};
