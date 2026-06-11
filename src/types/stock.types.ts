// ============================================================
// JEET ERP — Stores & Inventory Module Type Definitions
// ============================================================

export type StockLocationType = 'MAIN_STORE' | 'SUB_STORE' | 'PROJECT_SITE' | 'VAN';

export type StockTransactionType =
  | 'GRN_RECEIPT'
  | 'ISSUE_TO_PROJECT'
  | 'ISSUE_TO_TICKET'
  | 'RETURN_FROM_SITE'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'WRITE_OFF';

export type StockTransactionSource = 'GRN' | 'MRF' | 'TICKET' | 'VISIT' | 'TRANSFER' | 'COUNT' | 'MANUAL';

export type MRFStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PARTIALLY_ISSUED' | 'ISSUED' | 'REJECTED';

export type StockCountStatus = 'IN_PROGRESS' | 'PENDING_REVIEW' | 'POSTED' | 'CANCELLED';

export interface StockLocation {
  id: string;
  location_code: string;
  name: string;
  type: StockLocationType;
  project_id?: string | null;
  custodian_id?: string | null;
  address?: string | null;
  is_active: boolean;
  created_at: string;
  
  // Joined fields
  project_name?: string;
  custodian_name?: string;
}

export interface StockItem {
  id: string;
  pricing_item_id: string;
  is_serialized: boolean;
  reorder_level?: number | null;
  reorder_qty?: number | null;
  preferred_supplier_id?: string | null;
  is_active: boolean;
  created_at: string;

  // Joined catalog fields
  item_code?: string;
  description?: string;
  brand?: string;
  unit?: string;
  category?: string;
  part_number?: string;
  supplier_name?: string;
}

export interface StockBalance {
  id: string;
  stock_item_id: string;
  location_id: string;
  qty_on_hand: number;
  avg_unit_cost: number;
  qty_reserved: number;
  qty_available: number; // computed
  last_movement_at: string;

  // Joined fields
  item_code?: string;
  description?: string;
  unit?: string;
  location_name?: string;
  location_code?: string;
}

export interface StockTransaction {
  id: string;
  transaction_number: string;
  type: StockTransactionType;
  stock_item_id: string;
  location_id: string;
  qty: number;
  unit_cost: number;
  total_value: number;
  source_type: StockTransactionSource;
  source_id?: string | null;
  project_id?: string | null;
  counterparty_location_id?: string | null;
  reason?: string | null;
  performed_by: string;
  created_at: string;

  // Joined fields
  item_code?: string;
  item_description?: string;
  unit?: string;
  location_name?: string;
  project_number?: string;
  performer_name?: string;
}

export interface SerialUnit {
  id: string;
  stock_item_id: string;
  serial_no: string;
  status: 'IN_STORE' | 'ISSUED' | 'INSTALLED' | 'FAULTY' | 'RETURNED';
  current_location_id?: string | null;
  project_id?: string | null;
  grn_id?: string | null;
  installed_ticket_id?: string | null;
  warranty_expiry?: string | null;
  notes?: string | null;

  // Joined
  location_name?: string;
  project_name?: string;
}

export interface MaterialRequisition {
  id: string;
  mrf_number: string;
  project_id: string;
  requested_by: string;
  location_id: string;
  status: MRFStatus;
  needed_by: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;

  // Joined
  project_name?: string;
  project_number?: string;
  requester_name?: string;
  location_name?: string;
  items?: MRFItem[];
}

export interface MRFItem {
  id: string;
  mrf_id: string;
  stock_item_id: string;
  qty_requested: number;
  qty_approved: number;
  qty_issued: number;
  notes?: string | null;

  // Joined
  item_code?: string;
  description?: string;
  unit?: string;
  qty_available?: number; // available in source warehouse
}

export interface StockCount {
  id: string;
  count_number: string;
  location_id: string;
  status: StockCountStatus;
  counted_by: string;
  count_date: string;
  created_at: string;
  updated_at: string;

  // Joined
  location_name?: string;
  counter_name?: string;
  lines?: StockCountLine[];
}

export interface StockCountLine {
  id: string;
  stock_count_id: string;
  stock_item_id: string;
  system_qty: number;
  counted_qty: number;
  variance: number;
  variance_value: number;
  recount_flag: boolean;

  // Joined
  item_code?: string;
  description?: string;
  unit?: string;
  avg_unit_cost?: number;
}
