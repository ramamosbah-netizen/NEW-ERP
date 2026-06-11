// ============================================================
// JEET ERP — Project Master Module Type Definitions
// ============================================================

export type ProjectStatus =
  | 'SUBMITTED'
  | 'MOBILIZATION'
  | 'IN_PROGRESS'
  | 'TESTING'
  | 'HANDOVER'
  | 'DLP'
  | 'CLOSED'
  | 'ON_HOLD'
  | 'CANCELLED'
  | 'LOST';

export type ProjectType =
  | 'SUPPLY_INSTALL'
  | 'SUPPLY_ONLY'
  | 'INSTALL_ONLY'
  | 'AMC'
  | 'FITOUT'
  | 'CONSULTANCY';

export type Emirate =
  | 'DUBAI'
  | 'ABU_DHABI'
  | 'SHARJAH'
  | 'AJMAN'
  | 'RAK'
  | 'FUJAIRAH'
  | 'UAQ';

export type ProjectSystem =
  | 'CCTV'
  | 'ACCESS_CONTROL'
  | 'FIRE_ALARM'
  | 'BMS'
  | 'STRUCTURED_CABLING'
  | 'PA_AV_BGM'
  | 'GATE_BARRIER'
  | 'KNX_SMART_HOME'
  | 'ELECTRICAL'
  | 'OTHER';

export type ContactRole =
  | 'CLIENT_REP'
  | 'CONSULTANT'
  | 'MAIN_CONTRACTOR'
  | 'FM'
  | 'SECURITY_MANAGER'
  | 'OTHER';

export type MilestoneStatus = 'PENDING' | 'DONE' | 'DELAYED';

export type Project = {
  id: string;
  project_number: string;
  name: string;
  client_id: string;
  client_name: string;
  site_address?: string;
  emirate?: Emirate;
  makani_or_plot?: string;
  project_type: ProjectType;
  systems: ProjectSystem[];
  tender_id?: string;
  boq_id?: string;
  quotation_id?: string;
  contract_value: number;
  original_contract_value: number;
  budget_cost: number;
  vo_total_cost?: number;
  vo_total_sell?: number;
  vo_count?: number;
  revised_contract_value?: number;
  revised_end_date?: string | null;
  client_lpo_number?: string;
  client_lpo_date?: string;
  payment_terms?: string;
  retention_pct: number;
  advance_pct: number;
  dlp_months: number;
  start_date?: string;
  planned_end_date?: string;
  actual_end_date?: string;
  dlp_start_date?: string;
  dlp_end_date?: string;
  project_manager_id?: string | null;
  site_engineer_id?: string | null;
  status: ProjectStatus;
  previous_status?: string;
  on_hold_reason?: string;
  on_hold_expected_resume?: string;
  cancel_reason?: string;
  sira_applicable: boolean;
  consultant_name?: string;
  main_contractor_name?: string;
  tags: string[];
  notes?: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;

  // Joined data (populated by service)
  milestones?: ProjectMilestone[];
  contacts?: ProjectContact[];
  status_history?: ProjectStatusHistory[];
  project_manager?: { full_name: string; email: string };
  site_engineer?: { full_name: string; email: string };
};

export type ProjectStatusHistory = {
  id: string;
  project_id: string;
  from_status: string;
  to_status: string;
  comment?: string;
  changed_by: string;
  changed_at: string;
  changed_by_name?: string;
};

export type ProjectContact = {
  id: string;
  project_id: string;
  name: string;
  role: ContactRole;
  phone?: string;
  email?: string;
  is_primary: boolean;
  whatsapp_optin: boolean;
  notes?: string;
  created_at: string;
};

export type ProjectMilestone = {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  planned_date?: string;
  actual_date?: string;
  status: MilestoneStatus;
  payment_linked: boolean;
  payment_pct?: number | null;
  sort_order: number;
  created_at: string;
};

export type ProjectFilters = {
  status?: ProjectStatus;
  emirate?: Emirate;
  system?: ProjectSystem;
  project_manager_id?: string;
  client_id?: string;
  year?: number;
  search?: string;
  is_active?: boolean;
  include_pre_award?: boolean;
};

export type Client = {
  id: string;
  name: string;
  trn?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  country: string;
  emirate?: string;
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  payment_terms_days: number;
  credit_limit?: number;
  rating: 'PREMIUM' | 'STANDARD' | 'HIGH_RISK' | 'BLOCKED';
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
};
