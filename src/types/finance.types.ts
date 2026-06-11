// ============================================================
// JEET ERP — Finance Operations TS Types
// ============================================================

export type InvoiceType = 'ADVANCE' | 'PROGRESS' | 'FINAL' | 'RETENTION_RELEASE' | 'STANDALONE';

export type InvoiceStatus = 
  | 'DRAFT' 
  | 'PENDING_APPROVAL' 
  | 'APPROVED' 
  | 'SENT' 
  | 'PARTIALLY_PAID' 
  | 'PAID' 
  | 'OVERDUE' 
  | 'CANCELLED' 
  | 'WRITTEN_OFF';

export interface ClientInvoice {
  id: string;
  invoice_number: string;
  project_id: string | null;
  client_id: string;
  client_name: string;
  client_trn: string | null;
  client_address: string | null;
  invoice_type: InvoiceType;
  status: InvoiceStatus;
  invoice_date: string;
  supply_date: string;
  due_date: string;
  period_from: string | null;
  period_to: string | null;
  gross_claim: number;
  advance_recovery: number;
  retention_held: number;
  taxable_amount: number;
  vat_amount: number;
  total_incl_vat: number;
  net_due: number;
  amount_paid: number;
  payment_application_id: string | null;
  certified_amount: number | null;
  pdf_document_id: string | null;
  write_off_reason: string | null;
  notes: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ClientInvoiceItem {
  id: string;
  invoice_id: string;
  line_no: number;
  description: string;
  milestone_id: string | null;
  boq_reference: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  taxable_amount: number;
  vat_rate: number;
  vat_amount: number;
  line_total: number;
  created_at: string;
}

export type PaymentMethod = 'TRANSFER' | 'CHEQUE' | 'CASH' | 'CARD';

export interface ClientPayment {
  id: string;
  payment_number: string;
  client_id: string;
  amount: number;
  payment_date: string;
  method: PaymentMethod;
  reference: string | null;
  bank_account: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface PaymentAllocation {
  id: string;
  payment_id: string;
  invoice_id: string;
  allocated_amount: number;
  created_at: string;
}

export type CreditNoteStatus = 'DRAFT' | 'APPROVED' | 'CANCELLED';

export interface CreditNote {
  id: string;
  credit_note_number: string;
  original_invoice_id: string;
  reason: string;
  taxable_amount: number;
  vat_amount: number;
  total: number;
  status: CreditNoteStatus;
  pdf_document_id: string | null;
  created_by: string;
  created_at: string;
}

export interface ProjectRetentionRecord {
  id: string;
  project_id: string;
  invoice_id: string;
  direction: 'HELD' | 'RELEASED';
  amount: number;
  expected_release_date: string | null;
  created_at: string;
}

// --- AP Types ---

export type SupplierInvoiceType = 'PO_MATCHED' | 'DIRECT_EXPENSE';

export type SupplierInvoiceStatus = 
  | 'REGISTERED' 
  | 'PENDING_APPROVAL' 
  | 'APPROVED' 
  | 'SCHEDULED' 
  | 'PARTIALLY_PAID' 
  | 'PAID' 
  | 'DISPUTED' 
  | 'CANCELLED';

export type MatchStatus = 'MATCHED' | 'EXCEPTION' | 'OVERRIDDEN' | 'NA';

export interface ThreeWayMatchResults {
  priceExceptions?: Array<{
    poItemId: string;
    description: string;
    poPrice: number;
    invPrice: number;
    diffPercent: number;
  }>;
  qtyExceptions?: Array<{
    poItemId: string;
    description: string;
    grnQty: number;
    prevInvoiced: number;
    invQty: number;
  }>;
  trnValid?: boolean;
  trnError?: string;
}

export type ExpenseCategory = 'RENT' | 'UTILITIES' | 'SALARIES_PLACEHOLDER' | 'FUEL' | 'OTHER';

export interface SupplierInvoice {
  id: string;
  internal_ref: string;
  supplier_id: string;
  supplier_invoice_number: string;
  po_id: string | null;
  project_id: string | null;
  invoice_type: SupplierInvoiceType;
  invoice_date: string;
  received_date: string;
  due_date: string;
  taxable_amount: number;
  vat_amount: number;
  total: number;
  match_status: MatchStatus;
  match_results: ThreeWayMatchResults;
  override_reason: string | null;
  override_by: string | null;
  status: SupplierInvoiceStatus;
  amount_paid: number;
  source_document_id: string | null;
  expense_category: ExpenseCategory | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  supplier_name?: string;
}

export interface SupplierInvoiceItem {
  id: string;
  supplier_invoice_id: string;
  po_item_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  taxable_amount: number;
  vat_rate: number;
  vat_amount: number;
  created_at: string;
}

export interface SupplierPayment {
  id: string;
  payment_number: string;
  supplier_id: string;
  amount: number;
  payment_date: string;
  method: PaymentMethod;
  reference: string | null;
  bank_account: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface SupplierPaymentAllocation {
  id: string;
  payment_id: string;
  supplier_invoice_id: string;
  allocated_amount: number;
  created_at: string;
}
