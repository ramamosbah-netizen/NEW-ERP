// ============================================================
// JEET ERP — Variation Order (VO) Module Type Definitions
// Location: src/types/vo.types.ts
// ============================================================

export type VOType =
  | 'ADDITION'
  | 'OMISSION'
  | 'SUBSTITUTION'
  | 'RATE_CHANGE'
  | 'DAYWORKS'
  | 'PROVISIONAL_SUM_ADJ';

export type VOOrigin =
  | 'CLIENT_INSTRUCTION'
  | 'SITE_INSTRUCTION'
  | 'CONSULTANT'
  | 'RFI'
  | 'DESIGN_CHANGE'
  | 'SITE_CONDITION';

export type VOStatus =
  | 'DRAFT'
  | 'PRICED'
  | 'PENDING_INTERNAL'
  | 'INTERNALLY_APPROVED'
  | 'SUBMITTED_TO_CLIENT'
  | 'CLIENT_APPROVED'
  | 'CLIENT_REJECTED'
  | 'REVISED'
  | 'SUPERSEDED'
  | 'CANCELLED';

export type VOPricingBasis =
  | 'BOQ_RATES'
  | 'NEW_RATES'
  | 'DAYWORKS'
  | 'NEGOTIATED';

export type VOWorkStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED';

export interface VariationOrder {
  id: string;
  vo_number: string;
  project_vo_sequence: number;
  project_id: string;
  title: string;
  vo_type: VOType;
  origin: VOOrigin;
  instruction_reference: string;
  instruction_date: string;
  instruction_document_id: string | null;
  description: string | null;
  justification: string | null;
  status: VOStatus;
  pricing_basis: VOPricingBasis;
  cost_amount: number;
  sell_amount: number;
  vat_amount: number;
  total_incl_vat: number;
  time_impact_days: number;
  work_status: VOWorkStatus;
  proceed_at_risk: boolean;
  client_approval_ref: string | null;
  client_approval_date: string | null;
  client_approval_document_id: string | null;
  rejection_reason: string | null;
  cancel_reason: string | null;
  pdf_document_id: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;

  // Joined properties
  project_number?: string;
  project_name?: string;
  client_name?: string;
  items?: VOItem[];
  status_history?: VOStatusHistory[];
}

export interface VOItem {
  id: string;
  vo_id: string;
  line_no: number;
  action: 'ADD' | 'OMIT' | 'RE_RATE';
  pricing_item_id: string | null;
  boq_item_ref: string | null;
  description: string;
  unit: string;
  quantity: number; // negative for omissions
  unit_cost: number;
  unit_sell: number;
  line_cost: number;
  line_sell: number;
  system: string | null;
  notes: string | null;
  created_at?: string;
}

export interface VOStatusHistory {
  id: string;
  vo_id: string;
  from_status: VOStatus;
  to_status: VOStatus;
  comment: string | null;
  changed_by: string;
  changed_at: string;
  changed_by_name?: string;
}

export interface VOFilters {
  status?: VOStatus;
  vo_type?: VOType;
  project_id?: string;
  origin?: VOOrigin;
  proceed_at_risk?: boolean;
  search?: string;
}
