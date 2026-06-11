// ============================================================
// JEET ERP — Pure Margin & Savings Calculation Engine
// Handles item-level and sheet-level financial summaries
// ============================================================

export type ItemMarginInput = {
  quotation_total_sell: number;
  selected_total_cost: number;
  boq_total_material_cost: number;
  lowest_total_cost: number;
  offers_prices: number[]; // unit prices or total prices of offers to compute spread
};

export type ItemMarginOutput = {
  item_margin_amount: number;
  item_margin_pct: number;
  item_savings_vs_boq: number;
  override_cost_impact: number;
  price_spread_pct: number;
  item_margin_status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
};

export type SheetMarginInput = {
  items: {
    quotation_total_sell: number;
    selected_total_cost: number;
    boq_total_material_cost: number;
    lowest_total_cost: number;
  }[];
  target_margin_pct: number;
};

export type SheetMarginOutput = {
  total_boq_material_cost: number;
  total_quotation_material_revenue: number;
  total_selected_supplier_cost: number;
  total_lowest_supplier_cost: number;
  total_savings_vs_boq: number;
  total_savings_pct: number;
  overall_margin_amount: number;
  overall_margin_pct: number;
  potential_extra_savings: number;
  margin_status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
};

const round2 = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

/**
 * Calculate margin and savings details for a single comparison item row.
 */
export function calculateItemMargin(
  input: ItemMarginInput,
  targetMargin: number = 15.00
): ItemMarginOutput {
  const item_margin_amount = input.quotation_total_sell - input.selected_total_cost;
  const item_margin_pct = input.quotation_total_sell > 0
    ? (item_margin_amount / input.quotation_total_sell) * 100
    : 0;

  const item_savings_vs_boq = input.boq_total_material_cost - input.selected_total_cost;
  const override_cost_impact = Math.max(0, input.selected_total_cost - input.lowest_total_cost);

  // Price spread across all offers
  let price_spread_pct = 0;
  const validPrices = input.offers_prices.filter(p => p > 0);
  if (validPrices.length > 1) {
    const minOffer = Math.min(...validPrices);
    const maxOffer = Math.max(...validPrices);
    if (minOffer > 0) {
      price_spread_pct = ((maxOffer - minOffer) / minOffer) * 100;
    }
  }

  // Margin status
  let item_margin_status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
  if (item_margin_pct >= targetMargin) {
    item_margin_status = 'HEALTHY';
  } else if (item_margin_pct >= targetMargin - 5.0) {
    item_margin_status = 'WARNING';
  } else {
    item_margin_status = 'CRITICAL';
  }

  return {
    item_margin_amount: round2(item_margin_amount),
    item_margin_pct: round2(item_margin_pct),
    item_savings_vs_boq: round2(item_savings_vs_boq),
    override_cost_impact: round2(override_cost_impact),
    price_spread_pct: round2(price_spread_pct),
    item_margin_status
  };
}

/**
 * Calculate overall margin and savings details for the entire comparison sheet.
 */
export function calculateSheetMargin(
  input: SheetMarginInput
): SheetMarginOutput {
  let total_boq_material_cost = 0;
  let total_quotation_material_revenue = 0;
  let total_selected_supplier_cost = 0;
  let total_lowest_supplier_cost = 0;

  input.items.forEach(item => {
    total_boq_material_cost += item.boq_total_material_cost;
    total_quotation_material_revenue += item.quotation_total_sell;
    total_selected_supplier_cost += item.selected_total_cost;
    total_lowest_supplier_cost += item.lowest_total_cost;
  });

  const total_savings_vs_boq = total_boq_material_cost - total_selected_supplier_cost;
  const total_savings_pct = total_boq_material_cost > 0
    ? (total_savings_vs_boq / total_boq_material_cost) * 100
    : 0;

  const overall_margin_amount = total_quotation_material_revenue - total_selected_supplier_cost;
  const overall_margin_pct = total_quotation_material_revenue > 0
    ? (overall_margin_amount / total_quotation_material_revenue) * 100
    : 0;

  const potential_extra_savings = Math.max(0, total_selected_supplier_cost - total_lowest_supplier_cost);

  let margin_status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
  if (overall_margin_pct >= input.target_margin_pct) {
    margin_status = 'HEALTHY';
  } else if (overall_margin_pct >= input.target_margin_pct - 5.0) {
    margin_status = 'WARNING';
  } else {
    margin_status = 'CRITICAL';
  }

  return {
    total_boq_material_cost: round2(total_boq_material_cost),
    total_quotation_material_revenue: round2(total_quotation_material_revenue),
    total_selected_supplier_cost: round2(total_selected_supplier_cost),
    total_lowest_supplier_cost: round2(total_lowest_supplier_cost),
    total_savings_vs_boq: round2(total_savings_vs_boq),
    total_savings_pct: round2(total_savings_pct),
    overall_margin_amount: round2(overall_margin_amount),
    overall_margin_pct: round2(overall_margin_pct),
    potential_extra_savings: round2(potential_extra_savings),
    margin_status
  };
}
