// ============================================================
// Master Pricing Catalog — Pure Calculation Engine
// JEET INTECH ERP — No side effects, fully testable
// ============================================================

import type { PricingItem, RateAnalysisBreakdown } from './pricing-types';

const VAT_RATE = 0.05; // UAE 5% VAT

/** Round to 2 decimal places */
function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

// --- Labour Calculation ---

export type LabourRoleCalc = {
  hours: number;
  count: number;
  rate: number;
  total: number;
};

export type LabourCalcResult = {
  technician: LabourRoleCalc;
  engineer: LabourRoleCalc;
  pm: LabourRoleCalc;
  helper: LabourRoleCalc;
  raw_total: number;
  productivity_factor: number;
  site_factor: number;
  after_productivity: number;
  adjusted_total: number; // final labour cost
};

/**
 * Calculate full labour breakdown for a pricing item.
 * Formula:
 *   per role: hours × count × rate
 *   raw_total = sum of all roles
 *   after_productivity = raw_total × productivity_factor
 *   adjusted_total = after_productivity × site_factor
 */
export function calculateLabour(item: PricingItem): LabourCalcResult {
  const tech: LabourRoleCalc = {
    hours: item.labour_technician_hours,
    count: item.labour_technician_count,
    rate: item.labour_technician_rate,
    total: r2(item.labour_technician_hours * item.labour_technician_count * item.labour_technician_rate),
  };
  const eng: LabourRoleCalc = {
    hours: item.labour_engineer_hours,
    count: item.labour_engineer_count,
    rate: item.labour_engineer_rate,
    total: r2(item.labour_engineer_hours * item.labour_engineer_count * item.labour_engineer_rate),
  };
  const pm: LabourRoleCalc = {
    hours: item.labour_pm_hours,
    count: item.labour_pm_count,
    rate: item.labour_pm_rate,
    total: r2(item.labour_pm_hours * item.labour_pm_count * item.labour_pm_rate),
  };
  const helper: LabourRoleCalc = {
    hours: item.labour_helper_hours,
    count: item.labour_helper_count,
    rate: item.labour_helper_rate,
    total: r2(item.labour_helper_hours * item.labour_helper_count * item.labour_helper_rate),
  };

  const raw_total = r2(tech.total + eng.total + pm.total + helper.total);
  const productivity_factor = item.labour_productivity_factor || 1;
  const site_factor = item.labour_site_factor || 1;
  const after_productivity = r2(raw_total * productivity_factor);
  const adjusted_total = r2(after_productivity * site_factor);

  return {
    technician: tech,
    engineer: eng,
    pm,
    helper,
    raw_total,
    productivity_factor,
    site_factor,
    after_productivity,
    adjusted_total,
  };
}

// --- Full Pricing Calculation ---

export type PricingCalcResult = {
  material_cost: number;
  labour_cost: number;     // adjusted_total from labour calc
  subcon_cost: number;
  direct_cost: number;     // material + labour + subcon
  overhead_cost: number;   // direct_cost × overhead_pct%
  gna_cost: number;        // direct_cost × gna_pct%
  contingency_cost: number;// direct_cost × contingency_pct%
  total_cost: number;      // direct_cost + overhead + gna + contingency
  markup_value: number;    // total_cost × markup_pct%
  sell_price: number;      // total_cost + markup
  vat_amount: number;      // sell_price × 5%
  total_with_vat: number;  // sell_price + vat
  labour: LabourCalcResult;
};

/**
 * Master pricing formula.
 * Takes a PricingItem (from DB or form state) and returns the full cost build-up.
 */
export function calculatePricing(item: PricingItem): PricingCalcResult {
  const labour = calculateLabour(item);

  const material_cost = r2(Number(item.material_cost) || 0);
  const labour_cost = labour.adjusted_total;
  const subcon_cost = r2(Number(item.subcon_cost) || 0);

  const direct_cost = r2(material_cost + labour_cost + subcon_cost);

  const overhead_pct = Number(item.overhead_pct) || 0;
  const gna_pct = Number(item.gna_pct) || 0;
  const contingency_pct = Number(item.contingency_pct) || 0;
  const markup_pct = Number(item.markup_pct) || 0;

  const overhead_cost = r2(direct_cost * (overhead_pct / 100));
  const gna_cost = r2(direct_cost * (gna_pct / 100));
  const contingency_cost = r2(direct_cost * (contingency_pct / 100));

  const total_cost = r2(direct_cost + overhead_cost + gna_cost + contingency_cost);
  const markup_value = r2(total_cost * (markup_pct / 100));
  const sell_price = r2(total_cost + markup_value);
  const vat_amount = r2(sell_price * VAT_RATE);
  const total_with_vat = r2(sell_price + vat_amount);

  return {
    material_cost,
    labour_cost,
    subcon_cost,
    direct_cost,
    overhead_cost,
    gna_cost,
    contingency_cost,
    total_cost,
    markup_value,
    sell_price,
    vat_amount,
    total_with_vat,
    labour,
  };
}

/**
 * Apply calculated pricing back onto a PricingItem (for saving to DB).
 */
export function applyCalculatedFields(item: PricingItem): PricingItem {
  const calc = calculatePricing(item);
  return {
    ...item,
    labour_cost_computed: calc.labour_cost,
    sell_price: calc.sell_price,
    vat_amount: calc.vat_amount,
    total_with_vat: calc.total_with_vat,
  };
}

/**
 * Generate a RateAnalysisBreakdown snapshot from a PricingItem.
 * Used when saving a rate analysis to the DB.
 */
export function generateRateAnalysisBreakdown(item: PricingItem): RateAnalysisBreakdown {
  const calc = calculatePricing(item);
  return {
    material_cost: calc.material_cost,
    labour_cost: calc.labour_cost,
    overhead_cost: calc.overhead_cost,
    gna_cost: calc.gna_cost,
    contingency_cost: calc.contingency_cost,
    subcon_cost: calc.subcon_cost,
    total_cost: calc.total_cost,
    markup_value: calc.markup_value,
    sell_price: calc.sell_price,
    vat_amount: calc.vat_amount,
    total_with_vat: calc.total_with_vat,
    labour_detail: {
      technician: calc.labour.technician,
      engineer: calc.labour.engineer,
      pm: calc.labour.pm,
      helper: calc.labour.helper,
      productivity_factor: calc.labour.productivity_factor,
      site_factor: calc.labour.site_factor,
      raw_total: calc.labour.raw_total,
      adjusted_total: calc.labour.adjusted_total,
    },
  };
}

// --- Formatting Utilities ---

/** Format as AED currency */
export function formatAED(value: number): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Format as compact AED (K / M) */
export function formatAEDCompact(value: number): string {
  if (value >= 1_000_000) return `AED ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `AED ${(value / 1_000).toFixed(1)}K`;
  return formatAED(value);
}

/** Format percentage with % sign */
export function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** Format date as DD/MM/YYYY */
export function formatDateDMY(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Generate item code: SYS-CAT-NNN */
export function generateItemCode(system: string, category: string, existingCodes: string[]): string {
  const sysPrefix = system.substring(0, 4).toUpperCase().replace(/_/g, '');
  const catPrefix = category.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
  const prefix = `${sysPrefix}-${catPrefix}-`;

  const existing = existingCodes
    .filter(c => c.startsWith(prefix))
    .map(c => {
      const num = parseInt(c.split('-').pop() || '0', 10);
      return isNaN(num) ? 0 : num;
    });

  const nextNum = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `${prefix}${String(nextNum).padStart(3, '0')}`;
}

// --- System Display Names ---

export const SYSTEM_LABELS: Record<string, string> = {
  CCTV: 'CCTV / Surveillance',
  ACCESS_CONTROL: 'Access Control',
  FIRE_ALARM: 'Fire Alarm',
  STRUCTURED_CABLING: 'Structured Cabling',
  PA_SYSTEM: 'PA / BGM System',
  BARRIERS_GATES: 'Barriers & Gates',
  INTERCOM: 'Intercom / VDP',
  BMS: 'Building Management',
  ELECTRICAL: 'Electrical (LV)',
  HVAC: 'HVAC',
  PLUMBING: 'Plumbing',
  FIRE_FIGHTING: 'Fire Fighting',
};

export const SYSTEM_COLORS: Record<string, string> = {
  CCTV: '#00E5A0',
  ACCESS_CONTROL: '#6366f1',
  FIRE_ALARM: '#ef4444',
  STRUCTURED_CABLING: '#06b6d4',
  PA_SYSTEM: '#f59e0b',
  BARRIERS_GATES: '#8b5cf6',
  INTERCOM: '#ec4899',
  BMS: '#14b8a6',
  ELECTRICAL: '#eab308',
  HVAC: '#3b82f6',
  PLUMBING: '#0ea5e9',
  FIRE_FIGHTING: '#dc2626',
};

export const UNIT_OPTIONS = [
  'EA', 'M', 'SQM', 'BOX', 'SET', 'LOT', 'KG', 'PT', 'PKT', 'ROLL', 'HR', 'DAY',
];
