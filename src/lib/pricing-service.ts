// ============================================================
// Master Pricing Catalog — Supabase Data Service
// JEET INTECH ERP — CRUD operations for all pricing tables
// ============================================================

import { supabase } from './supabase';
import type {
  PricingItem,
  PricingItemUpdate,
  PricingFilters,
  LabourRate,
  PriceHistoryEntry,
  RateAnalysis,
  RateAnalysisBreakdown,
  AdjustmentFactor,
  PricingSupplier,
  PricingTemplate,
  AuditLogEntry,
} from './pricing-types';
import { applyCalculatedFields } from './pricing-engine';

// ============================================================
// PRICING ITEMS
// ============================================================

export async function fetchPricingItems(filters: PricingFilters): Promise<{
  data: PricingItem[];
  count: number;
}> {
  let query = supabase
    .from('pricing_items')
    .select('*', { count: 'exact' });

  // Text search
  if (filters.search) {
    const s = `%${filters.search}%`;
    query = query.or(
      `item_code.ilike.${s},description.ilike.${s},brand.ilike.${s},short_name.ilike.${s},part_number.ilike.${s}`
    );
  }

  // System filter
  if (filters.systems.length > 0) {
    query = query.in('system', filters.systems);
  }

  // Category filter
  if (filters.categories.length > 0) {
    query = query.in('category', filters.categories);
  }

  // Tier
  if (filters.price_tier !== 'all') {
    query = query.eq('price_tier', filters.price_tier);
  }

  // Brand
  if (filters.brand) {
    query = query.ilike('brand', `%${filters.brand}%`);
  }

  // Active
  if (filters.is_active !== 'all') {
    query = query.eq('is_active', filters.is_active);
  }

  // Sorting
  query = query.order(filters.sort_by, { ascending: filters.sort_dir === 'asc' });

  // Pagination
  const from = (filters.page - 1) * filters.per_page;
  const to = from + filters.per_page - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw error;
  return { data: (data || []) as PricingItem[], count: count || 0 };
}

export async function fetchPricingItemById(id: string): Promise<PricingItem | null> {
  const { data, error } = await supabase
    .from('pricing_items')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as PricingItem | null;
}

export async function fetchAllItemCodes(): Promise<string[]> {
  const { data, error } = await supabase
    .from('pricing_items')
    .select('item_code');

  if (error) throw error;
  return (data || []).map(d => d.item_code);
}

export async function createPricingItem(item: Partial<PricingItem>): Promise<PricingItem> {
  // Apply computed fields before save
  const computed = applyCalculatedFields(item as PricingItem);

  const { data, error } = await supabase
    .from('pricing_items')
    .insert({
      ...computed,
      id: undefined,
      created_at: undefined,
      updated_at: undefined,
    })
    .select()
    .single();

  if (error) throw error;
  return data as PricingItem;
}

export async function updatePricingItem(id: string, updates: PricingItemUpdate): Promise<PricingItem> {
  // If any pricing field changed, recalculate
  const needsRecalc = [
    'material_cost', 'subcon_cost',
    'overhead_pct', 'gna_pct', 'contingency_pct', 'markup_pct',
    'labour_technician_hours', 'labour_engineer_hours', 'labour_pm_hours', 'labour_helper_hours',
    'labour_technician_count', 'labour_engineer_count', 'labour_pm_count', 'labour_helper_count',
    'labour_technician_rate', 'labour_engineer_rate', 'labour_pm_rate', 'labour_helper_rate',
    'labour_productivity_factor', 'labour_site_factor',
  ].some(key => key in updates);

  let payload: PricingItemUpdate = { ...updates, updated_at: new Date().toISOString() };

  if (needsRecalc) {
    // Fetch current record to merge
    const current = await fetchPricingItemById(id);
    if (current) {
      const merged = { ...current, ...updates } as PricingItem;
      const computed = applyCalculatedFields(merged);
      payload = {
        ...payload,
        sell_price: computed.sell_price,
        vat_amount: computed.vat_amount,
        total_with_vat: computed.total_with_vat,
        labour_cost_computed: computed.labour_cost_computed,
        last_price_change: new Date().toISOString(),
      };
    }
  }

  const { data, error } = await supabase
    .from('pricing_items')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as PricingItem;
}

/** Soft delete */
export async function deletePricingItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('pricing_items')
    .update({ is_deleted: true, is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

/** Bulk update pricing percentages (apply template) */
export async function applyTemplateToItems(
  itemIds: string[],
  template: Pick<PricingTemplate, 'overhead_pct' | 'gna_pct' | 'contingency_pct' | 'markup_pct'>
): Promise<void> {
  for (const id of itemIds) {
    await updatePricingItem(id, {
      overhead_pct: template.overhead_pct,
      gna_pct: template.gna_pct,
      contingency_pct: template.contingency_pct,
      markup_pct: template.markup_pct,
    });
  }
}

// ============================================================
// LABOUR RATES
// ============================================================

export async function fetchLabourRates(): Promise<LabourRate[]> {
  const { data, error } = await supabase
    .from('pricing_labour_rates')
    .select('*')
    .order('role');

  if (error) throw error;
  return (data || []) as LabourRate[];
}

export async function updateLabourRate(id: string, updates: Partial<LabourRate>): Promise<LabourRate> {
  const { data, error } = await supabase
    .from('pricing_labour_rates')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as LabourRate;
}

// ============================================================
// PRICE HISTORY
// ============================================================

export async function fetchPriceHistory(itemId: string): Promise<PriceHistoryEntry[]> {
  const { data, error } = await supabase
    .from('pricing_price_history')
    .select('*')
    .eq('item_id', itemId)
    .order('changed_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data || []) as PriceHistoryEntry[];
}

export async function fetchRecentPriceChanges(days: number = 30): Promise<PriceHistoryEntry[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('pricing_price_history')
    .select('*')
    .gte('changed_at', since.toISOString())
    .order('changed_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data || []) as PriceHistoryEntry[];
}

// ============================================================
// RATE ANALYSES
// ============================================================

export async function fetchRateAnalyses(itemId: string): Promise<RateAnalysis[]> {
  const { data, error } = await supabase
    .from('pricing_rate_analyses')
    .select('*')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as RateAnalysis[];
}

export async function createRateAnalysis(
  itemId: string,
  projectRef: string,
  label: string,
  breakdown: RateAnalysisBreakdown
): Promise<RateAnalysis> {
  const { data, error } = await supabase
    .from('pricing_rate_analyses')
    .insert({
      item_id: itemId,
      project_ref: projectRef,
      snapshot_label: label,
      breakdown,
    })
    .select()
    .single();

  if (error) throw error;
  return data as RateAnalysis;
}

// ============================================================
// ADJUSTMENT FACTORS
// ============================================================

export async function fetchAdjustmentFactors(): Promise<AdjustmentFactor[]> {
  const { data, error } = await supabase
    .from('pricing_adjustment_factors')
    .select('*')
    .order('factor_code');

  if (error) throw error;
  return (data || []) as AdjustmentFactor[];
}

export async function updateAdjustmentFactor(
  id: string,
  updates: Partial<AdjustmentFactor>
): Promise<AdjustmentFactor> {
  const { data, error } = await supabase
    .from('pricing_adjustment_factors')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as AdjustmentFactor;
}

export async function createAdjustmentFactor(
  factor: Omit<AdjustmentFactor, 'id' | 'created_at' | 'updated_at'>
): Promise<AdjustmentFactor> {
  const { data, error } = await supabase
    .from('pricing_adjustment_factors')
    .insert(factor)
    .select()
    .single();

  if (error) throw error;
  return data as AdjustmentFactor;
}

// ============================================================
// SUPPLIERS
// ============================================================

export async function fetchSuppliers(): Promise<PricingSupplier[]> {
  const { data, error } = await supabase
    .from('pricing_suppliers')
    .select('*')
    .order('name');

  if (error) throw error;
  return (data || []) as PricingSupplier[];
}

export async function createSupplier(
  supplier: Omit<PricingSupplier, 'id' | 'created_at' | 'updated_at'>
): Promise<PricingSupplier> {
  const { data, error } = await supabase
    .from('pricing_suppliers')
    .insert(supplier)
    .select()
    .single();

  if (error) throw error;
  return data as PricingSupplier;
}

export async function updateSupplier(
  id: string,
  updates: Partial<PricingSupplier>
): Promise<PricingSupplier> {
  const { data, error } = await supabase
    .from('pricing_suppliers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as PricingSupplier;
}

// ============================================================
// TEMPLATES
// ============================================================

export async function fetchTemplates(): Promise<PricingTemplate[]> {
  const { data, error } = await supabase
    .from('pricing_templates')
    .select('*')
    .order('template_name');

  if (error) throw error;
  return (data || []) as PricingTemplate[];
}

export async function createTemplate(
  template: Omit<PricingTemplate, 'id' | 'created_at' | 'updated_at'>
): Promise<PricingTemplate> {
  const { data, error } = await supabase
    .from('pricing_templates')
    .insert(template)
    .select()
    .single();

  if (error) throw error;
  return data as PricingTemplate;
}

export async function updateTemplate(
  id: string,
  updates: Partial<PricingTemplate>
): Promise<PricingTemplate> {
  const { data, error } = await supabase
    .from('pricing_templates')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as PricingTemplate;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('pricing_templates')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================================
// AUDIT LOG
// ============================================================

export async function fetchAuditLog(filters?: {
  table_name?: string;
  record_id?: string;
  limit?: number;
}): Promise<AuditLogEntry[]> {
  let query = supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(filters?.limit || 50);

  if (filters?.table_name) query = query.eq('table_name', filters.table_name);
  if (filters?.record_id) query = query.eq('record_id', filters.record_id);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as AuditLogEntry[];
}

// ============================================================
// STATS / AGGREGATIONS
// ============================================================

export async function fetchPricingStats(): Promise<{
  total_items: number;
  active_items: number;
  avg_sell_price: number;
  total_material_value: number;
  systems_count: Record<string, number>;
}> {
  const { data, error } = await supabase
    .from('pricing_items')
    .select('system, material_cost, sell_price, is_active');

  if (error) throw error;

  const items = data || [];
  const active = items.filter(i => i.is_active);
  const systems_count: Record<string, number> = {};
  let totalSell = 0;
  let totalMat = 0;

  items.forEach(item => {
    systems_count[item.system] = (systems_count[item.system] || 0) + 1;
    totalSell += Number(item.sell_price) || 0;
    totalMat += Number(item.material_cost) || 0;
  });

  return {
    total_items: items.length,
    active_items: active.length,
    avg_sell_price: items.length > 0 ? Math.round((totalSell / items.length) * 100) / 100 : 0,
    total_material_value: totalMat,
    systems_count,
  };
}

/** Fetch distinct categories for a given system */
export async function fetchCategoriesForSystem(system: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('pricing_items')
    .select('category')
    .eq('system', system);

  if (error) throw error;
  const unique = [...new Set((data || []).map(d => d.category))];
  return unique.sort();
}

/** Fetch all distinct brands */
export async function fetchDistinctBrands(): Promise<string[]> {
  const { data, error } = await supabase
    .from('pricing_items')
    .select('brand')
    .not('brand', 'is', null)
    .not('brand', 'eq', '');

  if (error) throw error;
  const unique = [...new Set((data || []).map(d => d.brand).filter(Boolean))];
  return unique.sort() as string[];
}
