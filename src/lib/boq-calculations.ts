// ============================================================
// BOQ Financial Calculation Engine
// Pure TypeScript — no side effects, fully testable
// ============================================================

// --- Type Definitions ---

export type BOQItem = {
  id: string;
  item_code?: string;
  name: string;
  unit?: string;
  quantity: number;
  material_unit_cost: number;
  net_purchase_cost_per_unit?: number;
  
  // Overrides flag
  override_settings?: boolean;

  // Rates and percentages (can be item-specific or inherited from global)
  wastage_pct: number;
  risk_pct?: number;
  site_overhead_pct?: number;
  profit_pct: number;

  // Granular labor breakdown per item
  labor_technician_hours?: number;
  labor_engineer_hours?: number;
  labor_pm_hours?: number;

  labor_technician_count?: number;
  labor_engineer_count?: number;
  labor_pm_count?: number;

  labor_technician_rate?: number;
  labor_engineer_rate?: number;
  labor_pm_rate?: number;

  // Calculated fields (per item)
  material_total_cost: number;
  
  labor_technician_cost?: number;
  labor_engineer_cost?: number;
  labor_pm_cost?: number;
  gross_labour_cost?: number; // Technician Cost + Engineer Cost + PM Cost
  
  subcontract_cost?: number;
  equipment_cost?: number;
  logistics_cost?: number;
  
  wastage_cost: number;       // material_total_cost * wastage_pct / 100
  direct_cost?: number;       // supply + gross labour + subcontract + equipment + logistics + wastage
  risk_cost: number;          // direct_cost * risk_pct / 100
  site_overhead_cost: number;  // direct_cost * site_overhead_pct / 100
  total_cost?: number;        // direct_cost + risk_cost + site_overhead_cost
  
  profit_value: number;       // total_cost * profit_pct / 100
  unit_price: number;         // Unit selling price (calculated)
  total_price: number;        // Total selling price (calculated)

  // Legacy fallback fields kept for compile compatibility
  labor_unit_cost?: number;
  transport_unit_cost?: number;
  labor_total_cost?: number;
  transport_total_cost?: number;
  overhead_pct?: number;
  overhead_cost?: number;
};

export type LaborEntry = {
  count: number;
  hours: number;
  rate: number;
};

export type LaborConfig = {
  laborers: LaborEntry; // Maps to Technician
  engineers: LaborEntry;
  project_manager: LaborEntry;
};

export type CostElements = {
  wastage_pct: number;       // default e.g. 5
  overhead_pct: number;      // default e.g. 10 (legacy/site overhead %)
  logistics_cost: number;    // legacy
  risk_cost: number;         // legacy
  labor: LaborConfig;
  equipment_cost: number;    // legacy
  subcontract_cost: number;  // legacy
  profit_pct: number;        // default profit %

  // New global settings
  risk_pct: number;
  site_overhead_pct: number;
  technician_rate: number;
  engineer_rate: number;
  pm_rate: number;
};

export type Financials = {
  supply_total: number;
  wastage_value: number;
  overhead_value: number;      // Site Overhead Amount total
  logistics_cost: number;      // Logistics Cost total
  risk_cost: number;           // Risk Amount total
  labor_total: number;         // Gross Labour total
  labor_breakdown: {
    technician: number;
    engineer: number;
    project_manager: number;
    laborers?: number;         // legacy compatibility
    engineers?: number;        // legacy compatibility
  };
  equipment_cost: number;      // Equipment Cost total
  subcontract_cost: number;    // Subcontract Cost total
  site_factor: number;         // legacy compatibility multiplier, default 1
  direct_total: number;        // Sum of itemized direct costs
  indirect_total: number;      // Sum of itemized indirect costs (e.g. risk + overhead)
  profit_pct: number;          // global display profit %
  profit_value: number;        // Grand Profit Amount total
  unit_selling_price: number;   // Grand Unit Selling Price average
  total_selling_price: number;  // Grand Selling Price total
};

// --- Calculation Functions ---

/**
 * Calculate individual item detailed financials and final prices
 */
export function calculateItemFinancials(
  item: BOQItem,
  globals?: {
    wastage_pct?: number;
    risk_pct?: number;
    site_overhead_pct?: number;
    profit_pct?: number;
    technician_rate?: number;
    engineer_rate?: number;
    pm_rate?: number;
  }
): BOQItem {
  const quantity = Number(item.quantity) || 0;
  const material_unit_cost = Number(item.material_unit_cost) || 0;
  
  // Net purchase cost per unit defaults to material_unit_cost if not set
  const net_purchase_cost_per_unit = Number(item.net_purchase_cost_per_unit) !== undefined && !isNaN(Number(item.net_purchase_cost_per_unit))
    ? Number(item.net_purchase_cost_per_unit)
    : material_unit_cost;

  // Determine configuration settings (local override vs global)
  const isOverride = !!item.override_settings;

  const wastage_pct = isOverride
    ? (Number(item.wastage_pct) || 0)
    : (globals?.wastage_pct !== undefined ? Number(globals.wastage_pct) : (Number(item.wastage_pct) || 5));

  const risk_pct = isOverride
    ? (Number(item.risk_pct) || 0)
    : (globals?.risk_pct !== undefined ? Number(globals.risk_pct) : (Number(item.risk_pct) || 2));

  const site_overhead_pct = isOverride
    ? (Number(item.site_overhead_pct) || 0)
    : (globals?.site_overhead_pct !== undefined ? Number(globals.site_overhead_pct) : (Number(item.site_overhead_pct) || 3));

  const profit_pct = isOverride
    ? (Number(item.profit_pct) || 0)
    : (globals?.profit_pct !== undefined ? Number(globals.profit_pct) : (Number(item.profit_pct) || 15));

  const tech_rate = isOverride
    ? (Number(item.labor_technician_rate) ?? 15.00)
    : (globals?.technician_rate !== undefined ? Number(globals.technician_rate) : 15.00);

  const eng_rate = isOverride
    ? (Number(item.labor_engineer_rate) ?? 25.00)
    : (globals?.engineer_rate !== undefined ? Number(globals.engineer_rate) : 25.00);

  const pm_rate = isOverride
    ? (Number(item.labor_pm_rate) ?? 45.00)
    : (globals?.pm_rate !== undefined ? Number(globals.pm_rate) : 45.00);

  // Get item labor breakdown
  const tech_hours = Number(item.labor_technician_hours) || 0;
  const eng_hours = Number(item.labor_engineer_hours) || 0;
  const pm_hours = Number(item.labor_pm_hours) || 0;

  const tech_count = Number(item.labor_technician_count) || 0;
  const eng_count = Number(item.labor_engineer_count) || 0;
  const pm_count = Number(item.labor_pm_count) || 0;

  // Calculate detailed labour costs
  // Formula: Hours * Count * Rate * Quantity
  const labor_technician_cost = round2(tech_hours * tech_count * tech_rate * quantity);
  const labor_engineer_cost = round2(eng_hours * eng_count * eng_rate * quantity);
  const labor_pm_cost = round2(pm_hours * pm_count * pm_rate * quantity);
  const gross_labour_cost = round2(labor_technician_cost + labor_engineer_cost + labor_pm_cost);

  // Subcontractor, Equipment, Logistics Cost
  const subcontract_cost = Number(item.subcontract_cost) || 0;
  const equipment_cost = Number(item.equipment_cost) || 0;
  const logistics_cost = Number(item.logistics_cost) || 0;

  // Material total supply cost = Qty * Unit Supply Cost
  const material_total_cost = round2(quantity * material_unit_cost);

  // Wastage Amount = Total Supply Cost * Wastage %
  const wastage_cost = round2(material_total_cost * (wastage_pct / 100));

  // Direct Cost = Total Supply Cost + Gross Labour + Subcontract Cost + Equipment Cost + Logistics Cost + Wastage Amount
  const direct_cost = round2(
    material_total_cost + gross_labour_cost + subcontract_cost + equipment_cost + logistics_cost + wastage_cost
  );

  // Risk Amount = Direct Cost * Risk %
  const risk_cost = round2(direct_cost * (risk_pct / 100));

  // Site Overhead Amount = Direct Cost * Site Overhead %
  const site_overhead_cost = round2(direct_cost * (site_overhead_pct / 100));

  // Total Cost = Direct Cost + Risk Amount + Site Overhead Amount
  const total_cost = round2(direct_cost + risk_cost + site_overhead_cost);

  // Profit Amount = Total Cost * Profit %
  const profit_value = round2(total_cost * (profit_pct / 100));

  // Selling Price
  const total_price = round2(total_cost + profit_value);
  const unit_price = quantity > 0 ? round2(total_price / quantity) : 0;

  return {
    ...item,
    item_code: item.item_code ?? '',
    unit: item.unit ?? 'Pcs',
    quantity,
    material_unit_cost,
    net_purchase_cost_per_unit,
    override_settings: isOverride,
    wastage_pct,
    risk_pct,
    site_overhead_pct,
    profit_pct,

    labor_technician_hours: tech_hours,
    labor_engineer_hours: eng_hours,
    labor_pm_hours: pm_hours,
    labor_technician_count: tech_count,
    labor_engineer_count: eng_count,
    labor_pm_count: pm_count,
    labor_technician_rate: tech_rate,
    labor_engineer_rate: eng_rate,
    labor_pm_rate: pm_rate,

    material_total_cost,
    labor_technician_cost,
    labor_engineer_cost,
    labor_pm_cost,
    gross_labour_cost,
    subcontract_cost,
    equipment_cost,
    logistics_cost,
    wastage_cost,
    direct_cost,
    risk_cost,
    site_overhead_cost,
    total_cost,
    profit_value,
    unit_price,
    total_price,

    // Legacy compatibility fields
    labor_unit_cost: quantity > 0 ? round2(gross_labour_cost / quantity) : 0,
    transport_unit_cost: quantity > 0 ? round2(logistics_cost / quantity) : 0,
    labor_total_cost: gross_labour_cost,
    transport_total_cost: logistics_cost,
    overhead_pct: site_overhead_pct,
    overhead_cost: site_overhead_cost,
  };
}

/**
 * Calculate individual item total price
 */
export function calculateItemTotal(item: BOQItem): number {
  return calculateItemFinancials(item).total_price;
}

/**
 * Calculate supply total from all items (sum of material total costs)
 */
export function calculateSupplyTotal(items: BOQItem[]): number {
  return round2(items.reduce((sum, item) => sum + (Number(item.quantity) * (Number(item.material_unit_cost) || 0)), 0));
}

/**
 * Master recalculation function.
 * Takes raw inputs, calculates detailed pricing for all items, and returns the complete financial breakdown.
 */
export function recalculateAll(
  items: BOQItem[],
  costElements: CostElements,
  profitPct: number, // global profit pct default
  siteFactor: number // legacy site factor, keep default 1
): Financials {
  // 1. Prepare global settings object
  const globals = {
    wastage_pct: costElements.wastage_pct,
    risk_pct: costElements.risk_pct,
    site_overhead_pct: costElements.site_overhead_pct,
    profit_pct: profitPct,
    technician_rate: costElements.technician_rate,
    engineer_rate: costElements.engineer_rate,
    pm_rate: costElements.pm_rate,
  };

  // 2. Calculate each item's financial fields
  const calculatedItems = items.map(item => calculateItemFinancials(item, globals));

  // 3. Aggregate sums across all items
  const supplyTotal = round2(calculatedItems.reduce((sum, item) => sum + item.material_total_cost, 0));
  const wastageValue = round2(calculatedItems.reduce((sum, item) => sum + item.wastage_cost, 0));
  const overheadValue = round2(calculatedItems.reduce((sum, item) => sum + item.site_overhead_cost, 0));
  const logisticsCost = round2(calculatedItems.reduce((sum, item) => sum + (item.logistics_cost || 0), 0));
  const laborTotal = round2(calculatedItems.reduce((sum, item) => sum + (item.gross_labour_cost || 0), 0));
  const profitValue = round2(calculatedItems.reduce((sum, item) => sum + item.profit_value, 0));
  
  const subcontractCost = round2(calculatedItems.reduce((sum, item) => sum + (item.subcontract_cost || 0), 0));
  const equipmentCost = round2(calculatedItems.reduce((sum, item) => sum + (item.equipment_cost || 0), 0));
  const riskCost = round2(calculatedItems.reduce((sum, item) => sum + item.risk_cost, 0));

  // Detailed labour breakdowns
  const techTotal = round2(calculatedItems.reduce((sum, item) => sum + (item.labor_technician_cost || 0), 0));
  const engTotal = round2(calculatedItems.reduce((sum, item) => sum + (item.labor_engineer_cost || 0), 0));
  const pmTotal = round2(calculatedItems.reduce((sum, item) => sum + (item.labor_pm_cost || 0), 0));

  // Direct Cost = Material Cost + Wastage + Labor Cost + Subcontract Cost + Equipment Cost + Logistics Cost
  const directTotal = round2(
    supplyTotal + wastageValue + laborTotal + subcontractCost + equipmentCost + logisticsCost
  );

  // Indirect Cost = Risk + Site Overhead
  const indirectTotal = round2(riskCost + overheadValue);

  // Total Selling Price = Direct Cost + Indirect Cost + Profit
  const totalSellingPrice = round2(directTotal + indirectTotal + profitValue);

  // Unit selling price (average per item quantity)
  const totalQuantity = calculatedItems.reduce((sum, item) => sum + item.quantity, 0);
  const unitSellingPrice = totalQuantity > 0
    ? round2(totalSellingPrice / totalQuantity)
    : 0;

  return {
    supply_total: supplyTotal,
    wastage_value: wastageValue,
    overhead_value: overheadValue,
    logistics_cost: logisticsCost,
    risk_cost: riskCost,
    labor_total: laborTotal,
    labor_breakdown: {
      technician: techTotal,
      engineer: engTotal,
      project_manager: pmTotal,
      laborers: techTotal, // legacy compatibility
      engineers: engTotal,  // legacy compatibility
    },
    equipment_cost: equipmentCost,
    subcontract_cost: subcontractCost,
    site_factor: siteFactor || 1,
    direct_total: directTotal,
    indirect_total: indirectTotal,
    profit_pct: profitPct,
    profit_value: profitValue,
    unit_selling_price: unitSellingPrice,
    total_selling_price: totalSellingPrice,
  };
}

// --- Default Factories ---

export function createDefaultCostElements(): CostElements {
  return {
    wastage_pct: 5,
    overhead_pct: 3, // Legacy field fallback to site overhead
    logistics_cost: 0,
    risk_cost: 0,
    labor: {
      laborers: { count: 0, hours: 0, rate: 15.00 },
      engineers: { count: 0, hours: 0, rate: 25.00 },
      project_manager: { count: 0, hours: 0, rate: 45.00 },
    },
    equipment_cost: 0,
    subcontract_cost: 0,
    profit_pct: 15,

    // New properties
    risk_pct: 2,
    site_overhead_pct: 3,
    technician_rate: 15.00,
    engineer_rate: 25.00,
    pm_rate: 45.00,
  };
}

export function createDefaultFinancials(): Financials {
  return {
    supply_total: 0,
    wastage_value: 0,
    overhead_value: 0,
    logistics_cost: 0,
    risk_cost: 0,
    labor_total: 0,
    labor_breakdown: { technician: 0, engineer: 0, project_manager: 0, laborers: 0, engineers: 0 },
    equipment_cost: 0,
    subcontract_cost: 0,
    site_factor: 1,
    direct_total: 0,
    indirect_total: 0,
    profit_pct: 15,
    profit_value: 0,
    unit_selling_price: 0,
    total_selling_price: 0,
  };
}

export function createEmptyItem(defaults?: {
  wastage_pct?: number;
  risk_pct?: number;
  site_overhead_pct?: number;
  profit_pct?: number;
  technician_rate?: number;
  engineer_rate?: number;
  pm_rate?: number;
}): BOQItem {
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
    item_code: '',
    name: '',
    unit: 'Pcs',
    quantity: 1,
    material_unit_cost: 0,
    net_purchase_cost_per_unit: 0,
    
    override_settings: false,
    
    wastage_pct: defaults?.wastage_pct ?? 5,
    risk_pct: defaults?.risk_pct ?? 2,
    site_overhead_pct: defaults?.site_overhead_pct ?? 3,
    profit_pct: defaults?.profit_pct ?? 15,

    labor_technician_hours: 0,
    labor_engineer_hours: 0,
    labor_pm_hours: 0,

    labor_technician_count: 1,
    labor_engineer_count: 0,
    labor_pm_count: 0,

    labor_technician_rate: defaults?.technician_rate ?? 15.00,
    labor_engineer_rate: defaults?.engineer_rate ?? 25.00,
    labor_pm_rate: defaults?.pm_rate ?? 45.00,

    material_total_cost: 0,
    labor_technician_cost: 0,
    labor_engineer_cost: 0,
    labor_pm_cost: 0,
    gross_labour_cost: 0,
    subcontract_cost: 0,
    equipment_cost: 0,
    logistics_cost: 0,
    wastage_cost: 0,
    direct_cost: 0,
    risk_cost: 0,
    site_overhead_cost: 0,
    total_cost: 0,
    profit_value: 0,
    unit_price: 0,
    total_price: 0,

    // Legacy properties compatibility
    labor_unit_cost: 0,
    transport_unit_cost: 0,
    labor_total_cost: 0,
    transport_total_cost: 0,
    overhead_pct: defaults?.site_overhead_pct ?? 3,
    overhead_cost: 0,
  };
}

// --- Utilities ---

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'AED',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// --- BOQ Status Helpers ---

export const BOQ_STATUSES = [
  'draft',
  'submitted',
  'engineer_approved',
  'manager_approved',
  'finance_approved',
  'finalized',
  'exported',
] as const;

export type BOQStatus = typeof BOQ_STATUSES[number];

export const BOQ_STATUS_LABELS: Record<BOQStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  engineer_approved: 'Engineer Approved',
  manager_approved: 'Manager Approved',
  finance_approved: 'Finance Approved',
  finalized: 'Finalized',
  exported: 'Exported',
};

/**
 * Map profile roles to BOQ approval stages.
 * Returns the stage this role can approve, or null if not allowed.
 */
export function getApprovalStageForRole(
  role: string
): { currentRequired: BOQStatus; nextStatus: BOQStatus } | null {
  switch (role) {
    case 'engineer':
      return { currentRequired: 'submitted', nextStatus: 'engineer_approved' };
    case 'manager':
      return { currentRequired: 'engineer_approved', nextStatus: 'manager_approved' };
    case 'account': // account = finance role
      return { currentRequired: 'manager_approved', nextStatus: 'finance_approved' };
    case 'admin':
      // Admin can approve any pending stage — handled separately
      return null;
    default:
      return null;
  }
}

/**
 * Check if a given role can approve the BOQ at its current status.
 */
export function canRoleApprove(role: string, currentStatus: BOQStatus): boolean {
  if (role === 'admin') {
    // Admin can approve any stage that is waiting
    return ['submitted', 'engineer_approved', 'manager_approved'].includes(currentStatus);
  }

  const mapping = getApprovalStageForRole(role);
  if (!mapping) return false;

  return currentStatus === mapping.currentRequired;
}

/**
 * Get the next status after approval for a given role + current status.
 */
export function getNextApprovalStatus(role: string, currentStatus: BOQStatus): BOQStatus | null {
  if (role === 'admin') {
    // Admin advances to next logical step
    switch (currentStatus) {
      case 'submitted': return 'engineer_approved';
      case 'engineer_approved': return 'manager_approved';
      case 'manager_approved': return 'finance_approved';
      default: return null;
    }
  }

  const mapping = getApprovalStageForRole(role);
  if (!mapping || currentStatus !== mapping.currentRequired) return null;
  return mapping.nextStatus;
}
