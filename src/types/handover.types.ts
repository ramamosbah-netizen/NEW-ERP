// ============================================================
// JEET ERP — Handover / Closeout Module Type Definitions
// ============================================================

export type HandoverPackageStatus = 'IN_PREPARATION' | 'READY' | 'SIGNED' | 'COMPLETED';

export interface HandoverPackage {
  id: string;
  project_id: string;
  status: HandoverPackageStatus;
  handover_date?: string;
  client_signatory_name?: string;
  client_signatory_designation?: string;
  signature_path?: string;
  certificate_document_id?: string;
  dlp_start_confirmed: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;

  // Joined fields
  project_name?: string;
  project_number?: string;
  created_by_name?: string;
  checklist_items?: HandoverChecklistItem[];
}

export interface HandoverChecklistItem {
  id: string;
  package_id: string;
  category: 'T&C' | 'Snags' | 'O&M' | 'Warranty' | 'SIRA' | 'Training' | 'Commercial' | string;
  requirement: string;
  mandatory: boolean;
  status: 'PENDING' | 'DONE' | 'WAIVED';
  evidence_document_id?: string;
  waived_reason?: string;
  waived_by?: string;
  sort: number;

  // Joined fields
  waived_by_name?: string;
  evidence_document_name?: string;
}

export interface HandoverGateStatus {
  can_handover: boolean;
  blockers: string[];
  tc_completed: boolean;
  tc_total: number;
  tc_completed_count: number;
  snags_clear: boolean;
  open_critical_snags: number;
  open_major_snags: number;
  open_minor_snags: number;
  dms_files_uploaded: boolean;
  missing_categories: string[];
  retention_release_calculated: boolean;
}
