// ============================================================
// JEET ERP — Purchase Orders (LPO) Type Definitions
// ============================================================

export type POStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SENT'
  | 'ACKNOWLEDGED'
  | 'PARTIALLY_DELIVERED'
  | 'DELIVERED'
  | 'CLOSED'
  | 'CANCELLED'
  | 'REVISED'
  | 'SUPERSEDED';

export type POOrigin = 'FROM_COMPARISON' | 'MANUAL';

export type POType =
  | 'PROJECT_MATERIAL'
  | 'SUBCONTRACT'
  | 'SERVICES'
  | 'CONSUMABLES'
  | 'OVERHEAD';

export type PODeliveryStatus = 'NOT_DELIVERED' | 'PARTIAL' | 'COMPLETE';

export type POItemReceiptStatus = 'PENDING' | 'PARTIAL' | 'COMPLETE' | 'CLOSED_SHORT';

export type POApprovalStage = 'COMMERCIAL' | 'GM';
export type POApprovalAction = 'APPROVED' | 'REJECTED';

export interface PurchaseOrder {
  id: string;
  po_number: string;
  revision_number: number;
  supersedes_id?: string | null;
  is_latest: boolean;
  origin: POOrigin;
  comparison_id?: string | null;
  project_id?: string | null; // Null only for OVERHEAD
  po_type: POType;
  
  supplier_id: string;
  supplier_name: string;
  supplier_trn?: string | null;
  supplier_contact?: string | null;
  supplier_email?: string | null;
  supplier_phone?: string | null;
  
  delivery_address?: string | null;
  required_delivery_date?: string | null;
  promised_delivery_days?: number | null;
  payment_terms_days: number;
  payment_terms_text?: string | null;
  
  currency: string;
  exchange_rate: number;
  
  subtotal: number;
  discount_amount: number;
  vat_amount: number;
  total: number;
  
  no_comparison_justification?: string | null;
  terms_conditions?: string | null;
  notes_to_supplier?: string | null;
  internal_notes?: string | null;
  
  status: POStatus;
  cancel_reason?: string | null;
  closed_short_reason?: string | null;
  
  sent_at?: string | null;
  acknowledged_at?: string | null;
  supplier_ack_reference?: string | null;
  pdf_document_id?: string | null;
  delivery_status: PODeliveryStatus;
  
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;

  // Joined/Virtual properties
  items?: POItem[];
  approvals?: POApproval[];
  project_number?: string;
  project_name?: string;
  creator_name?: string;
}

export interface POItem {
  id: string;
  po_id: string;
  line_no: number;
  comparison_item_id?: string | null;
  pricing_item_id?: string | null;
  item_code?: string | null;
  description: string;
  brand?: string | null;
  unit: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  vat_applicable: boolean;
  line_total: number;
  
  // Receipt progress
  qty_received: number;
  qty_rejected: number;
  receipt_status: POItemReceiptStatus;
  
  system?: string | null; // ELV system code for cost division
  notes?: string | null;
  created_at: string;
}

export interface POApproval {
  id: string;
  po_id: string;
  stage: POApprovalStage;
  action: POApprovalAction;
  comment?: string | null;
  approver_id: string;
  created_at: string;
  
  // Joined
  approver_name?: string;
}
