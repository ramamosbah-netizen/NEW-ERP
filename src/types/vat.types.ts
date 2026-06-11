// ============================================================
// JEET ERP — VAT and Accounting Export Types
// ============================================================

export type VATPeriodStatus = 'OPEN' | 'LOCKED';

export interface VATPeriod {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  filing_deadline: string;
  status: VATPeriodStatus;
  is_active: boolean;
  locked_by: string | null;
  locked_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface VATBoxDetails {
  taxable_amount: number;
  vat_amount: number;
}

export interface VATForm201 {
  period_id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  
  // Box 1: Standard rated supplies by Emirate (Output VAT)
  box1_abu_dhabi: VATBoxDetails;
  box1_dubai: VATBoxDetails;
  box1_sharjah: VATBoxDetails;
  box1_ajman: VATBoxDetails;
  box1_umm_al_quwain: VATBoxDetails;
  box1_ras_al_khaimah: VATBoxDetails;
  box1_fujairah: VATBoxDetails;
  
  // Other Outputs
  box2_tourist_refunds: VATBoxDetails; // Usually 0 or negative
  box3_reverse_charge: VATBoxDetails; // Reverse charge input/output
  box4_zero_rated: number;            // Amount only
  box5_exempt: number;                // Amount only
  box6_goods_imported: VATBoxDetails;
  box7_adjustments: VATBoxDetails;
  
  // Output Totals
  box8_total_outputs: VATBoxDetails;
  
  // Expenses (Input VAT)
  box9_standard_rated_expenses: VATBoxDetails;
  box10_reverse_charge_expenses: VATBoxDetails;
  
  // Input Totals
  box11_total_inputs: VATBoxDetails;
  
  // Calculation Net
  box12_total_output_tax: number;
  box13_total_input_tax: number;
  box14_net_vat_due: number; // Positive = payable to FTA, Negative = recoverable refund
}

export interface JournalLine {
  date: string;
  reference: string;
  description: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  project_code: string | null;
  partner_name: string | null;
}
