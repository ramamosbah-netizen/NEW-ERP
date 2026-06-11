// ============================================================
// JEET ERP — Payroll and WPS SIF Generation Types
// ============================================================

export type PayrollRunStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PAID';
export type PayrollAdjustmentType = 'BONUS' | 'DEDUCTION' | 'ADVANCE_RECOVERY' | 'OTHER';
export type PayrollAdjustmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PayrollRun {
  id: string;
  period_month: string; // ISO Date (first of month) YYYY-MM-DD
  status: PayrollRunStatus;
  gross_total: number;
  net_total: number;
  sif_generated_at: string | null;
  approved_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayrollLine {
  id: string;
  run_id: string;
  employee_id: string;
  
  // Salary Snapshots
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  other_allowance: number;
  
  // Components
  ot_hours: number;
  ot_amount: number;
  leave_deductions: number;
  adjustments: Array<{
    id: string;
    adjustment_type: PayrollAdjustmentType;
    amount: number;
    reason: string;
  }>;
  
  gross_pay: number;
  net_pay: number;
  days_worked: number;
  
  // Bank details snapshots
  bank_name: string | null;
  iban: string | null;
  routing_code: string | null;
  agent_id: string | null;
  mohre_person_code: string | null;
  
  created_at: string;
  
  // Optional join fields
  employee?: {
    full_name_en: string;
    employee_number: string;
    designation: string;
    department: string;
  };
}

export interface PayrollAdjustment {
  id: string;
  employee_id: string;
  period_month: string; // YYYY-MM-DD
  adjustment_type: PayrollAdjustmentType;
  amount: number;
  reason: string;
  status: PayrollAdjustmentStatus;
  approved_by: string | null;
  created_by: string | null;
  created_at: string;
  
  // Optional join fields
  employee?: {
    full_name_en: string;
    employee_number: string;
  };
}

export interface SifValidationIssue {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  field: string;
  value: string;
  severity: 'BLOCKER' | 'WARNING';
  message: string;
}

export interface EosbCalculation {
  serviceDays: number;
  unpaidLeaveDays: number;
  effectiveServiceDays: number;
  gratuityAmount: number;
  leaveEncashmentDays: number;
  leaveEncashmentAmount: number;
  pendingSalary: number;
  outstandingAdvances: number;
  totalSettlement: number;
  joinDate: string;
  exitDate: string;
  basicSalary: number;
  totalSalary: number;
}
