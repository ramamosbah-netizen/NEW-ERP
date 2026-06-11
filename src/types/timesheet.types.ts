// ============================================================
// JEET ERP — Timesheet and Project Cost Types
// ============================================================

export type TimesheetStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'LOCKED';
export type AllocationType = 'PROJECT' | 'SERVICE_TICKET' | 'PPM_VISIT' | 'OVERHEAD' | 'LEAVE';
export type OvertimeType = 'WEEKDAY_OT' | 'RESTDAY_OT' | 'HOLIDAY_OT';

export interface Timesheet {
  id: string;
  employee_id: string;
  week_start: string; // ISO date (always Sunday) YYYY-MM-DD
  status: TimesheetStatus;
  submitted_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  total_regular_hours: number;
  total_ot_hours: number;
  created_at: string;
  updated_at: string;
  
  // Optional join fields
  employee?: {
    full_name_en: string;
    employee_number: string;
    department: string;
  };
}

export interface TimesheetEntry {
  id: string;
  timesheet_id: string;
  work_date: string; // ISO date YYYY-MM-DD
  allocation_type: AllocationType;
  project_id: string | null;
  ticket_id: string | null;
  visit_id: string | null;
  hours: number;
  is_overtime: boolean;
  ot_type: OvertimeType | null;
  description: string | null;
  site_location: string | null;
  created_at: string;
  
  // Optional join fields
  project_name?: string;
  project_number?: string;
  ticket_number?: string;
  visit_number?: string;

  project?: {
    name: string;
    project_number: string;
  };
  ticket?: {
    ticket_number: string;
    subject: string;
  };
  visit?: {
    visit_number: string;
    title: string;
  };
}

export interface ProjectLabourCost {
  id: string;
  project_id: string;
  employee_id: string;
  timesheet_entry_id: string;
  work_date: string;
  hours: number;
  cost_rate: number;
  cost_amount: number;
  system: string | null;
  created_at: string;
}
