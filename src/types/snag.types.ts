// ============================================================
// JEET ERP — Snag / Punch List Module Type Definitions
// ============================================================

export type SnagSource =
  | 'TC_FAIL'
  | 'WITNESS'
  | 'CLIENT_WALKTHROUGH'
  | 'INTERNAL_QA'
  | 'CONSULTANT';

export type SnagSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL';

export type SnagStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'READY_FOR_INSPECTION'
  | 'CLOSED'
  | 'DEFERRED_TO_DLP'
  | 'DISPUTED';

export interface Snag {
  id: string;
  snag_number: string;
  project_id: string;
  source: SnagSource;
  system: string;
  location: string;
  description: string;
  photo_paths: string[];
  severity: SnagSeverity;
  assigned_to?: string;
  subcontractor_name?: string;
  target_date?: string;
  status: SnagStatus;
  closed_evidence_photos: string[];
  closed_by?: string;
  verified_by?: string;
  client_accepted?: boolean;
  deferral_justification?: string;
  tc_test_result_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;

  // Joined fields
  project_name?: string;
  project_number?: string;
  assigned_to_name?: string;
  closed_by_name?: string;
  verified_by_name?: string;
  created_by_name?: string;
}
