// ============================================================
// JEET ERP — Client Invoice Math Engine
// Handles: FTA-compliant line VAT (round half-up), advance recovery,
// retention deduction, and net due calculation.
// ============================================================

import type { ClientInvoiceItem } from '@/types/finance.types';

/**
 * Rounds a number to exactly 2 decimal places (half-up rounding).
 */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Rounds a number to exactly 4 decimal places for unit prices.
 */
export function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

interface CalcLineInput {
  quantity: number;
  unit_price: number;
  vat_rate?: number; // defaults to 5.00
}

interface CalcLineOutput {
  taxable_amount: number;
  vat_amount: number;
  line_total: number;
}

/**
 * Computes taxable, VAT, and total for a single invoice line item.
 * As per FTA regulations, VAT must be computed at the line level and rounded.
 */
export function calculateInvoiceLine(line: CalcLineInput): CalcLineOutput {
  const quantity = Math.max(0, line.quantity);
  const unit_price = Math.max(0, line.unit_price);
  const vat_rate = line.vat_rate !== undefined ? line.vat_rate : 5.00;

  const taxable_amount = round2(quantity * unit_price);
  const vat_amount = round2(taxable_amount * (vat_rate / 100));
  const line_total = round2(taxable_amount + vat_amount);

  return {
    taxable_amount,
    vat_amount,
    line_total
  };
}

interface InvoiceMathInput {
  items: Array<CalcLineInput>;
  contract_value?: number; // Total contract value for advance recovery pct
  total_advance_amount?: number; // Initial advance payment given
  advance_recovery_rate?: number; // Optional override for recovery rate (e.g. 0.2 for 20%)
  retention_rate?: number; // e.g. 0.1 for 10%
  gross_claim_override?: number; // Optional direct gross claim override
}

interface InvoiceMathOutput {
  gross_claim: number;
  advance_recovery: number;
  retention_held: number;
  taxable_amount: number;
  vat_amount: number;
  total_incl_vat: number;
  net_due: number;
}

/**
 * Computes the overall invoice metrics based on items and project conditions.
 */
export function calculateInvoiceTotals(input: InvoiceMathInput): InvoiceMathOutput {
  let totalTaxable = 0;
  let totalVat = 0;

  // Calculate items line by line
  const calculatedItems = input.items.map(item => calculateInvoiceLine(item));
  
  for (const item of calculatedItems) {
    totalTaxable += item.taxable_amount;
    totalVat += item.vat_amount;
  }

  // Round cumulative results
  totalTaxable = round2(totalTaxable);
  totalVat = round2(totalVat);
  const totalInclVat = round2(totalTaxable + totalVat);

  // Gross progress claim defaults to total taxable of standard items in the list
  const grossClaim = input.gross_claim_override !== undefined 
    ? round2(input.gross_claim_override) 
    : totalTaxable;

  // Advance recovery calculation
  let advanceRecovery = 0;
  if (input.total_advance_amount && input.total_advance_amount > 0) {
    if (input.advance_recovery_rate !== undefined) {
      advanceRecovery = round2(grossClaim * input.advance_recovery_rate);
    } else if (input.contract_value && input.contract_value > 0) {
      // recovery pct = gross_claim / contract_value
      const claimPercent = grossClaim / input.contract_value;
      advanceRecovery = round2(claimPercent * input.total_advance_amount);
    }
  }

  // Retention held calculation
  const retentionRate = input.retention_rate !== undefined ? input.retention_rate : 0.00;
  const retentionHeld = round2(grossClaim * retentionRate);

  // Net due = (Taxable + VAT) - Advance Recovery - Retention Held
  // Note: Netted deductions are applied after VAT computation
  const netDue = round2(totalInclVat - advanceRecovery - retentionHeld);

  return {
    gross_claim: grossClaim,
    advance_recovery: advanceRecovery,
    retention_held: retentionHeld,
    taxable_amount: totalTaxable,
    vat_amount: totalVat,
    total_incl_vat: totalInclVat,
    net_due: netDue
  };
}
