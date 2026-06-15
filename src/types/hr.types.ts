// ============================================================
// JEET ERP — HR and Compliance TypeScript Types
// ============================================================

export type EmployeeStatus = 'ACTIVE' | 'ON_LEAVE' | 'NOTICE_PERIOD' | 'EXITED';
export type EmploymentType = 'FULL_TIME' | 'LIMITED_CONTRACT' | 'OUTSOURCED';
export type DepartmentType = 'PROJECTS' | 'SERVICE' | 'ESTIMATION' | 'PROCUREMENT' | 'FINANCE' | 'ADMIN' | 'MANAGEMENT';
export type GenderType = 'MALE' | 'FEMALE' | 'OTHER';
export type ExitType = 'RESIGNATION' | 'TERMINATION' | 'CONTRACT_END';

export interface Employee {
  id: string;
  employee_number: string;
  user_id: string | null;
  full_name_en: string;
  full_name_ar: string;
  nationality: string;
  dob: string; // ISO date YYYY-MM-DD
  gender: GenderType;
  mobile: string;
  personal_email: string;
  photo_path: string | null;
  designation: string;
  department: DepartmentType;
  assigned_project_id?: string | null; // home project for payroll cost fallback
  employment_type: EmploymentType;
  join_date: string; // ISO date YYYY-MM-DD
  probation_end_date: string | null;
  status: EmployeeStatus;
  exit_date: string | null;
  exit_type: ExitType | null;
  
  // UAE Compliance Documents
  passport_no: string;
  passport_expiry: string;
  emirates_id_no: string;
  emirates_id_expiry: string;
  visa_no: string;
  visa_expiry: string;
  visa_sponsor: 'JEET' | 'OTHER';
  labour_card_no: string;
  labour_card_expiry: string;
  mohre_person_code: string;
  iloe_insurance_expiry: string | null;
  medical_insurance_expiry: string;
  driving_license_expiry: string | null;
  
  // Bank Details
  bank_name: string;
  iban: string;
  routing_code: string;
  agent_id: string;
  
  // Public rates
  current_hourly_cost_rate: number;
  
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
}

export interface EmployeeCompensation {
  id: string;
  employee_id: string;
  effective_from: string; // YYYY-MM-DD
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  other_allowance: number;
  burden_multiplier: number;
  hourly_cost_rate: number; // calculated total/30/8 * burden
  notes: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export type CertType = 'SIRA_INSTALLATION' | 'SIRA_CCTV_OPERATOR' | 'MANUFACTURER' | 'FIRST_AID' | 'WORK_AT_HEIGHT' | 'OTHER';

export interface EmployeeCertification {
  id: string;
  employee_id: string;
  cert_type: CertType;
  cert_number: string;
  issue_date: string;
  expiry_date: string;
  document_id: string | null; // link to DMS
  created_at: string;
  updated_at: string;
}

export type EmployeeDocumentType = 'PASSPORT' | 'EMIRATES_ID' | 'VISA' | 'LABOUR_CARD' | 'MOHRE_CONTRACT' | 'SIRA_CERT' | 'INSURANCE' | 'OTHER';

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  document_id: string; // DMS ID
  document_type: EmployeeDocumentType;
  created_at: string;
}

export type LeaveType = 'ANNUAL' | 'SICK' | 'UNPAID' | 'MATERNITY' | 'PARENTAL' | 'HAJJ' | 'COMPASSIONATE';
export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface LeaveBalance {
  id: string;
  employee_id: string;
  year: number;
  leave_type: 'ANNUAL' | 'SICK' | 'MATERNITY' | 'PARENTAL';
  entitled_days: number;
  taken_days: number;
  created_at: string;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: LeaveType;
  from_date: string;
  to_date: string;
  days: number;
  reason: string | null;
  status: LeaveRequestStatus;
  approver_id: string | null;
  document_id: string | null; // e.g. sick certificate
  created_at: string;
  updated_at: string;
  
  // Optional join fields
  employee?: {
    full_name_en: string;
    employee_number: string;
    department?: string;
  };
}

export interface AirTicketEntitlement {
  id: string;
  employee_id: string;
  frequency_months: 12 | 24;
  destination: string;
  last_availed_date: string | null;
  next_due_date: string;
  estimated_cost: number;
  created_at: string;
  updated_at: string;
}
