// ============================================================
// JEET ERP — Variation Order Contract Impact Calculation Engine
// Location: src/services/voContractImpactService.ts
// Pure, side-effect-free functions for contract value adjustments,
// margin calculations, EOT time adjustments, and over-claim guards.
// ============================================================

import { round2 } from './invoiceMathService';

interface VOPricingInput {
  sell_amount: number;
  cost_amount: number;
}

interface VOMarginResult {
  marginAmount: number;
  marginPct: number;
}

interface VOContractImpactInput {
  originalContractValue: number;
  plannedEndDate: string | Date | null;
  approvedVOs: Array<{
    sell_amount: number;
    time_impact_days: number;
  }>;
}

interface VOContractImpactResult {
  voTotalSell: number;
  voCount: number;
  revisedContractValue: number;
  revisedEndDate: string | null;
}

/**
 * Calculates the profit margin amount and percentage for a Variation Order.
 * VOs are often priced at different margins than the core contract.
 * Excludes VAT from calculations.
 */
export function calculateVOMargin(sellAmount: number, costAmount: number): VOMarginResult {
  const roundedSell = round2(sellAmount);
  const roundedCost = round2(costAmount);
  
  const marginAmount = round2(roundedSell - roundedCost);
  
  // Guard against division by zero if sell amount is 0 (omission or dayworks adjustment)
  let marginPct = 0;
  if (roundedSell !== 0) {
    marginPct = round2((marginAmount / roundedSell) * 100);
  }
  
  return {
    marginAmount,
    marginPct
  };
}

/**
 * Recomputes the project revised contract value and Target Completion End Date (EOT)
 * based on all approved variation orders.
 * Handles signed math (omission VOs are negative).
 */
export function calculateContractImpact(input: VOContractImpactInput): VOContractImpactResult {
  const originalVal = Number(input.originalContractValue || 0);
  
  let voTotalSell = 0;
  let totalTimeImpactDays = 0;
  let voCount = 0;
  
  for (const vo of input.approvedVOs) {
    voTotalSell += Number(vo.sell_amount || 0);
    totalTimeImpactDays += Number(vo.time_impact_days || 0);
    voCount++;
  }
  
  voTotalSell = round2(voTotalSell);
  const revisedContractValue = round2(originalVal + voTotalSell);
  
  let revisedEndDate: string | null = null;
  if (input.plannedEndDate) {
    const originalDate = new Date(input.plannedEndDate);
    if (!isNaN(originalDate.getTime())) {
      // Add days to original target date
      originalDate.setDate(originalDate.getDate() + totalTimeImpactDays);
      revisedEndDate = originalDate.toISOString().split('T')[0];
    }
  }
  
  return {
    voTotalSell,
    voCount,
    revisedContractValue,
    revisedEndDate
  };
}

/**
 * Validates if the sum of existing progress claims plus the new invoice gross claim
 * exceeds the revised contract value (the over-claim ceiling).
 * Formula: cumulativeInvoiced + currentInvoiceGross <= revisedContractValue
 */
export function validateInvoiceCeiling(
  revisedContractValue: number,
  cumulativeInvoiced: number,
  currentInvoiceGross: number
): {
  valid: boolean;
  ceiling: number;
  currentTotal: number;
  exceededBy: number;
} {
  const ceiling = round2(revisedContractValue);
  const currentTotal = round2(Number(cumulativeInvoiced || 0) + Number(currentInvoiceGross || 0));
  
  const exceededBy = round2(currentTotal - ceiling);
  const valid = exceededBy <= 0.01; // Allow float delta tolerance
  
  return {
    valid,
    ceiling,
    currentTotal,
    exceededBy: Math.max(0, exceededBy)
  };
}
