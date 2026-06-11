// ============================================================
// JEET ERP — Goods Receipt Note (GRN) Type Definitions
// ============================================================

export type GRNStatus = 'DRAFT' | 'RECEIVED' | 'CANCELLED';

export type GRNLocation = 'SITE' | 'STORE';

export type GRNRejectionReason =
  | 'DAMAGED'
  | 'WRONG_ITEM'
  | 'WRONG_BRAND'
  | 'SHORT_EXPIRY'
  | 'SPEC_MISMATCH'
  | 'OTHER';

export type GRNReturnStatus =
  | 'PENDING_COLLECTION'
  | 'COLLECTED'
  | 'REPLACED'
  | 'CREDITED';

export interface GoodsReceiptNote {
  id: string;
  grn_number: string;
  po_id: string;
  project_id?: string | null;
  received_by: string;
  received_at: string;
  delivery_note_ref: string;
  delivery_note_document_id?: string | null;
  vehicle_no?: string | null;
  driver_name?: string | null;
  location: GRNLocation;
  status: GRNStatus;
  notes?: string | null;
  is_stock_item?: boolean;
  stock_location_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // Joined/Virtual properties
  items?: GRNItem[];
  po_number?: string;
  supplier_name?: string;
  project_number?: string;
  project_name?: string;
  receiver_name?: string;
}

export interface GRNItem {
  id: string;
  grn_id: string;
  po_item_id: string;
  qty_received: number;
  qty_rejected: number;
  rejection_reason?: GRNRejectionReason | null;
  rejection_photos: string[];
  notes?: string | null;
  created_at: string;

  // Joined/Virtual from po_items
  description?: string;
  brand?: string;
  unit?: string;
  po_qty?: number;
  po_qty_received?: number;
  po_qty_rejected?: number;
  item_code?: string;
  system?: string;
  unit_price?: number;
  line_total?: number;
  discount_pct?: number;
  vat_applicable?: boolean;
}

export interface GRNReturn {
  id: string;
  grn_item_id: string;
  qty: number;
  reason: string;
  status: GRNReturnStatus;
  expected_resolution_date?: string | null;
  resolved_at?: string | null;
  resolution_notes?: string | null;
  created_at: string;

  // Joined/Virtual
  grn_number?: string;
  po_number?: string;
  supplier_name?: string;
  item_description?: string;
  unit?: string;
}
