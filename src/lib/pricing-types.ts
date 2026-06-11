// ============================================================
// Master Pricing Catalog — TypeScript Type Definitions
// JEET INTECH ERP — ELV & MEP Unit Rate System
// ============================================================

// --- Enums / Unions ---

export const PRICING_SYSTEMS = [
  'CCTV',
  'ACCESS_CONTROL',
  'FIRE_ALARM',
  'STRUCTURED_CABLING',
  'PA_SYSTEM',
  'BARRIERS_GATES',
  'INTERCOM',
  'BMS',
  'ELECTRICAL',
  'HVAC',
  'PLUMBING',
  'FIRE_FIGHTING',
] as const;
export type PricingSystem = typeof PRICING_SYSTEMS[number];

export const PRICE_TIERS = ['standard', 'premium', 'budget'] as const;
export type PriceTier = typeof PRICE_TIERS[number];

export const LABOUR_ROLES = ['TECHNICIAN', 'ENGINEER', 'PM', 'HELPER'] as const;
export type LabourRole = typeof LABOUR_ROLES[number];

export const FACTOR_APPLIES_TO = ['LABOUR_ONLY', 'ALL_COSTS', 'MATERIAL_ONLY'] as const;
export type FactorAppliesTo = typeof FACTOR_APPLIES_TO[number];

// --- Core Entities ---

export type PricingItem = {
  id: string;
  item_code: string;
  system: PricingSystem;
  category: string;
  sub_category: string | null;
  description: string;
  short_name: string | null;
  unit: string;
  spec_reference: string | null;
  brand: string | null;
  part_number: string | null;
  supplier: string | null;

  // Material
  material_cost: number;

  // Computed sell price
  sell_price: number;
  vat_amount: number;
  total_with_vat: number;

  // Tiers / Lead / Warranty
  price_tier: PriceTier;
  lead_time_days: number;
  warranty_months: number;

  // Status
  is_active: boolean;
  is_locked: boolean;
  is_deleted: boolean;
  review_date: string | null;
  last_price_change: string | null;

  // Usage
  usage_count: number;
  last_used_on_project: string | null;

  // Meta
  tags: string[];
  notes: string | null;
  client_facing_notes: string | null;

  // Labour breakdown
  labour_technician_rate: number;
  labour_engineer_rate: number;
  labour_pm_rate: number;
  labour_helper_rate: number;
  labour_technician_hours: number;
  labour_engineer_hours: number;
  labour_pm_hours: number;
  labour_helper_hours: number;
  labour_technician_count: number;
  labour_engineer_count: number;
  labour_pm_count: number;
  labour_helper_count: number;
  labour_productivity_factor: number;
  labour_site_factor: number;
  labour_cost_computed: number;

  // Pricing percentages
  overhead_pct: number;
  gna_pct: number;
  contingency_pct: number;
  markup_pct: number;
  subcon_cost: number;

  // Audit
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type PricingItemInsert = Omit<PricingItem,
  'id' | 'sell_price' | 'vat_amount' | 'total_with_vat' | 'labour_cost_computed'
  | 'created_at' | 'updated_at' | 'usage_count' | 'is_deleted'
>;

export type PricingItemUpdate = Partial<Omit<PricingItem, 'id' | 'created_at'>>;

// --- Labour Rates ---

export type LabourRate = {
  id: string;
  role: LabourRole;
  rate_aed_per_hour: number;
  overtime_rate: number;
  effective_from: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

// --- Price History ---

export type PriceHistoryEntry = {
  id: string;
  item_id: string;
  old_sell_price: number | null;
  new_sell_price: number | null;
  change_pct: number | null;
  change_reason: string | null;
  changed_by: string | null;
  changed_at: string;
};

// --- Rate Analyses ---

export type RateAnalysis = {
  id: string;
  item_id: string;
  project_ref: string | null;
  snapshot_label: string | null;
  breakdown: RateAnalysisBreakdown;
  created_by: string | null;
  created_at: string;
};

export type RateAnalysisBreakdown = {
  material_cost: number;
  labour_cost: number;
  overhead_cost: number;
  gna_cost: number;
  contingency_cost: number;
  subcon_cost: number;
  total_cost: number;
  markup_value: number;
  sell_price: number;
  vat_amount: number;
  total_with_vat: number;
  labour_detail: {
    technician: { hours: number; count: number; rate: number; total: number };
    engineer: { hours: number; count: number; rate: number; total: number };
    pm: { hours: number; count: number; rate: number; total: number };
    helper: { hours: number; count: number; rate: number; total: number };
    productivity_factor: number;
    site_factor: number;
    raw_total: number;
    adjusted_total: number;
  };
};

// --- Adjustment Factors ---

export type AdjustmentFactor = {
  id: string;
  factor_code: string;
  label: string;
  multiplier: number;
  applies_to: FactorAppliesTo;
  applicable_systems: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// --- Suppliers ---

export type PricingSupplier = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  systems_covered: string[];
  payment_terms_days: number;
  preferred: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// --- Templates ---

export type PricingTemplate = {
  id: string;
  template_name: string;
  overhead_pct: number;
  gna_pct: number;
  contingency_pct: number;
  markup_pct: number;
  description: string | null;
  created_at: string;
  updated_at: string;
};

// --- Audit Log ---

export type AuditLogEntry = {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  changed_fields: Record<string, unknown>;
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  user_id: string | null;
  created_at: string;
};

// --- Dashboard / Stats ---

export type PricingStats = {
  total_items: number;
  active_items: number;
  items_by_system: Record<PricingSystem, number>;
  avg_sell_price: number;
  items_needing_review: number;
  total_price_changes_30d: number;
  top_used_items: PricingItem[];
};

// --- Filter / Search ---

export type PricingFilters = {
  search: string;
  systems: PricingSystem[];
  categories: string[];
  price_tier: PriceTier | 'all';
  brand: string;
  is_active: boolean | 'all';
  sort_by: 'item_code' | 'description' | 'material_cost' | 'sell_price' | 'usage_count' | 'updated_at';
  sort_dir: 'asc' | 'desc';
  page: number;
  per_page: number;
};

export const DEFAULT_FILTERS: PricingFilters = {
  search: '',
  systems: [],
  categories: [],
  price_tier: 'all',
  brand: '',
  is_active: true,
  sort_by: 'item_code',
  sort_dir: 'asc',
  page: 1,
  per_page: 50,
};
