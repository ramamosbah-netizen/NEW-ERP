// ============================================================
// JEET ERP — Document Management System Type Definitions
// ============================================================

export type DocumentEntityType = 'PROJECT' | 'CLIENT' | 'SUPPLIER' | 'COMPANY' | 'AMC';

export type DocumentStatus = 'PROCESSING' | 'AUTO_FILED' | 'NEEDS_REVIEW' | 'VERIFIED' | 'REJECTED';

export type DocumentAction =
  | 'UPLOADED'
  | 'CLASSIFIED'
  | 'REVIEWED'
  | 'REVISED'
  | 'DOWNLOADED'
  | 'LINKED'
  | 'DELETED'
  | 'RESTORED'
  | 'METADATA_UPDATED';

export type ExpiryAlertStatus = 'PENDING' | 'SENT' | 'ACKNOWLEDGED' | 'EXPIRED';

export type DocumentCategory = {
  id: string;
  category: string;
  subcategory: string;
  description_for_ai: string;
  default_expiry_alert_days: number[];
  sort_order: number;
  is_active: boolean;
};

export type Document = {
  id: string;
  entity_type: DocumentEntityType;
  entity_id?: string | null;
  title: string;
  original_filename: string;
  file_ext: string;
  mime_type: string;
  file_size_bytes: number;
  file_hash: string;
  storage_path: string;
  category: string;
  subcategory: string;
  ai_confidence?: number | null;
  ai_metadata?: GeminiClassificationResponse | null;
  ai_summary?: string | null;
  references: string[];
  issue_date?: string | null;
  expiry_date?: string | null;
  amount_aed?: number | null;
  revision_label?: string | null;
  revision_number: number;
  supersedes_id?: string | null;
  is_latest_revision: boolean;
  status: DocumentStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  linked_record_type?: string | null;
  linked_record_id?: string | null;
  tags: string[];
  is_confidential: boolean;
  is_active: boolean;
  uploaded_by: string;
  created_at: string;
  updated_at: string;

  // Joined data
  uploader_name?: string;
  reviewer_name?: string;
  project_name?: string;
  activity?: DocumentActivityRecord[];
  revisions?: Document[];
};

export type GeminiClassificationResponse = {
  category: string;
  subcategory: string;
  confidence: number;
  title_suggestion: string;
  references: string[];
  issue_date: string | null;
  expiry_date: string | null;
  parties: string[];
  amount_aed: number | null;
  revision: string | null;
  summary: string;
};

export type DocumentExpiryAlert = {
  id: string;
  document_id: string;
  expiry_date: string;
  alert_days_before: number;
  alert_sent_at?: string;
  acknowledged_by?: string;
  acknowledged_at?: string;
  status: ExpiryAlertStatus;
  created_at: string;

  // Joined
  document?: Document;
};

export type DocumentActivityRecord = {
  id: string;
  document_id: string;
  action: DocumentAction;
  detail?: Record<string, any>;
  user_id: string;
  created_at: string;
  user_name?: string;
};

export type DocumentFilters = {
  entity_type?: DocumentEntityType;
  entity_id?: string;
  category?: string;
  subcategory?: string;
  status?: DocumentStatus;
  expiry_from?: string;
  expiry_to?: string;
  uploaded_by?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  is_confidential?: boolean;
  is_active?: boolean;
};

// Upload queue item tracking
export type UploadQueueItem = {
  id: string;
  file: File;
  filename: string;
  fileSize: number;
  status: 'queued' | 'uploading' | 'extracting' | 'classifying' | 'filed' | 'review' | 'error';
  progress: number; // 0-100
  documentId?: string;
  error?: string;
  aiConfidence?: number | null;
  category?: string;
  subcategory?: string;
};
