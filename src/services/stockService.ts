// ============================================================
// JEET ERP — Stock and Location Service
// ============================================================

import { supabase } from '@/lib/supabase';
import type { StockLocation, StockItem, StockBalance, StockTransaction, SerialUnit } from '@/types/stock.types';

export const stockService = {
  /**
   * Retrieves all stock locations, joining project and custodian details.
   */
  async getLocations(): Promise<StockLocation[]> {
    // Plain select + separate name lookups — PostgREST embeds for
    // project_id/custodian_id are unreliable here (schema-cache).
    const { data, error } = await supabase
      .from('stock_locations')
      .select('*')
      .order('location_code');

    if (error) throw error;
    const locs = data || [];
    const { projectMap, custodianMap } = await this._resolveLocationNames(locs);

    return locs.map(loc => ({
      ...loc,
      project_name: loc.project_id ? projectMap.get(loc.project_id) : undefined,
      custodian_name: loc.custodian_id ? custodianMap.get(loc.custodian_id) : undefined,
    })) as StockLocation[];
  },

  // Batch-resolve project and custodian display names for a set of locations.
  async _resolveLocationNames(locs: any[]): Promise<{ projectMap: Map<string, string>; custodianMap: Map<string, string> }> {
    const projectIds = Array.from(new Set(locs.map(l => l.project_id).filter(Boolean)));
    const custodianIds = Array.from(new Set(locs.map(l => l.custodian_id).filter(Boolean)));
    const projectMap = new Map<string, string>();
    const custodianMap = new Map<string, string>();

    if (projectIds.length > 0) {
      const { data } = await supabase.from('projects').select('id, name').in('id', projectIds as string[]);
      for (const p of data || []) projectMap.set(p.id, p.name);
    }
    if (custodianIds.length > 0) {
      const { data } = await supabase.from('employees').select('id, full_name_en').in('id', custodianIds as string[]);
      for (const e of data || []) custodianMap.set(e.id, e.full_name_en);
    }
    return { projectMap, custodianMap };
  },

  /**
   * Retrieves details of a single stock location.
   */
  async getLocationDetail(id: string): Promise<StockLocation> {
    const { data, error } = await supabase
      .from('stock_locations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    const { projectMap, custodianMap } = await this._resolveLocationNames([data]);

    return {
      ...data,
      project_name: data.project_id ? projectMap.get(data.project_id) : undefined,
      custodian_name: data.custodian_id ? custodianMap.get(data.custodian_id) : undefined,
    } as StockLocation;
  },

  /**
   * Creates a new stock location.
   */
  async createLocation(loc: Omit<StockLocation, 'id' | 'created_at'>): Promise<string> {
    const { data, error } = await supabase
      .from('stock_locations')
      .insert({
        location_code: loc.location_code,
        name: loc.name,
        type: loc.type,
        project_id: loc.project_id || null,
        custodian_id: loc.custodian_id || null,
        address: loc.address || null,
        is_active: true
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  },

  /**
   * Retrieves all stock items, joining pricing_items master catalog detail.
   */
  async getStockItems(): Promise<StockItem[]> {
    const { data, error } = await supabase
      .from('stock_items')
      .select(`
        *,
        pricing_items(item_code, description, brand, unit, category, part_number),
        pricing_suppliers(name)
      `)
      .eq('is_active', true);

    if (error) throw error;

    return (data || []).map(item => ({
      ...item,
      item_code: item.pricing_items?.item_code,
      description: item.pricing_items?.description,
      brand: item.pricing_items?.brand,
      unit: item.pricing_items?.unit,
      category: item.pricing_items?.category,
      part_number: item.pricing_items?.part_number,
      supplier_name: item.pricing_suppliers?.name
    })) as StockItem[];
  },

  /**
   * Retrieves details of a single stock item.
   */
  async getStockItemDetail(id: string): Promise<StockItem> {
    const { data, error } = await supabase
      .from('stock_items')
      .select(`
        *,
        pricing_items(item_code, description, brand, unit, category, part_number),
        pricing_suppliers(name)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return {
      ...data,
      item_code: data.pricing_items?.item_code,
      description: data.pricing_items?.description,
      brand: data.pricing_items?.brand,
      unit: data.pricing_items?.unit,
      category: data.pricing_items?.category,
      part_number: data.pricing_items?.part_number,
      supplier_name: data.pricing_suppliers?.name
    } as StockItem;
  },

  /**
   * Adds an item to the stock registry.
   */
  async createStockItem(item: Omit<StockItem, 'id' | 'created_at'>): Promise<string> {
    const { data, error } = await supabase
      .from('stock_items')
      .insert({
        pricing_item_id: item.pricing_item_id,
        is_serialized: item.is_serialized,
        reorder_level: item.reorder_level || null,
        reorder_qty: item.reorder_qty || null,
        preferred_supplier_id: item.preferred_supplier_id || null,
        is_active: true
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  },

  /**
   * Retrieves stock balances, optionally filtered by location or stock item.
   */
  async getBalances(filters?: {
    location_id?: string;
    stock_item_id?: string;
  }): Promise<StockBalance[]> {
    let query = supabase
      .from('stock_balances')
      .select(`
        *,
        stock_items(
          pricing_items(item_code, description, unit)
        ),
        stock_locations(name, location_code)
      `);

    if (filters?.location_id) {
      query = query.eq('location_id', filters.location_id);
    }
    if (filters?.stock_item_id) {
      query = query.eq('stock_item_id', filters.stock_item_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(row => ({
      ...row,
      item_code: row.stock_items?.pricing_items?.item_code,
      description: row.stock_items?.pricing_items?.description,
      unit: row.stock_items?.pricing_items?.unit,
      location_name: row.stock_locations?.name,
      location_code: row.stock_locations?.location_code
    })) as StockBalance[];
  },

  /**
   * Queries the immutable movement ledger.
   */
  async getMovementLedger(filters?: {
    type?: string;
    location_id?: string;
    stock_item_id?: string;
    project_id?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<StockTransaction[]> {
    // NOTE: stock_transactions has no FK to projects/profiles in this DB →
    // those embeds PGRST200. Embed only the safe relations; resolve
    // project_number + performer_name via separate keyed lookups.
    let query = supabase
      .from('stock_transactions')
      .select(`
        *,
        stock_items(pricing_items(item_code, description, unit)),
        stock_locations(name)
      `)
      .order('created_at', { ascending: false });

    if (filters?.type) query = query.eq('type', filters.type);
    if (filters?.location_id) query = query.eq('location_id', filters.location_id);
    if (filters?.stock_item_id) query = query.eq('stock_item_id', filters.stock_item_id);
    if (filters?.project_id) query = query.eq('project_id', filters.project_id);
    if (filters?.date_from) query = query.gte('created_at', filters.date_from);
    if (filters?.date_to) query = query.lte('created_at', filters.date_to);

    const { data, error } = await query;
    if (error) throw error;
    const rows = data || [];

    const projectIds = [...new Set(rows.map((r: any) => r.project_id).filter(Boolean))];
    const performerIds = [...new Set(rows.map((r: any) => r.performed_by).filter(Boolean))];
    const [projRes, profRes] = await Promise.all([
      projectIds.length ? supabase.from('projects').select('id, project_number').in('id', projectIds) : Promise.resolve({ data: [] as any[] }),
      performerIds.length ? supabase.from('profiles').select('id, full_name').in('id', performerIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const projMap = new Map((projRes.data || []).map((p: any) => [p.id, p.project_number]));
    const profMap = new Map((profRes.data || []).map((p: any) => [p.id, p.full_name]));

    return rows.map((row: any) => ({
      ...row,
      item_code: row.stock_items?.pricing_items?.item_code,
      item_description: row.stock_items?.pricing_items?.description,
      unit: row.stock_items?.pricing_items?.unit,
      location_name: row.stock_locations?.name,
      project_number: row.project_id ? projMap.get(row.project_id) : undefined,
      performer_name: row.performed_by ? profMap.get(row.performed_by) : undefined
    })) as StockTransaction[];
  },

  /**
   * Retrieves serial units for a stock item, optionally filtered by location or status.
   */
  async getSerialUnits(filters?: {
    stock_item_id?: string;
    location_id?: string;
    status?: string;
  }): Promise<SerialUnit[]> {
    // serial_units has no FK to projects in this DB → that embed PGRST200.
    // Embed the safe location relation; resolve project_name separately.
    let query = supabase
      .from('serial_units')
      .select(`
        *,
        stock_locations(name)
      `);

    if (filters?.stock_item_id) query = query.eq('stock_item_id', filters.stock_item_id);
    if (filters?.location_id) query = query.eq('current_location_id', filters.location_id);
    if (filters?.status) query = query.eq('status', filters.status);

    const { data, error } = await query;
    if (error) throw error;
    const rows = data || [];

    const projectIds = [...new Set(rows.map((r: any) => r.project_id).filter(Boolean))];
    const projMap = new Map<string, string>();
    if (projectIds.length) {
      const { data: projs } = await supabase.from('projects').select('id, name').in('id', projectIds);
      (projs || []).forEach((p: any) => projMap.set(p.id, p.name));
    }

    return rows.map((row: any) => ({
      ...row,
      location_name: row.stock_locations?.name,
      project_name: row.project_id ? projMap.get(row.project_id) : undefined
    })) as SerialUnit[];
  },

  /**
   * Returns items with zero movement for more than a configured duration (defaults to 180 days)
   * where there is positive stock on hand.
   */
  async getDeadStockReport(inactiveDays: number = 180): Promise<Array<StockBalance & { age_days: number }>> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

    const { data, error } = await supabase
      .from('stock_balances')
      .select(`
        *,
        stock_items(
          pricing_items(item_code, description, unit, category)
        ),
        stock_locations(name)
      `)
      .gt('qty_on_hand', 0)
      .lte('last_movement_at', cutoffDate.toISOString());

    if (error) throw error;

    return (data || []).map(row => {
      const lastMove = new Date(row.last_movement_at);
      const diffTime = Math.abs(Date.now() - lastMove.getTime());
      const ageDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        ...row,
        item_code: row.stock_items?.pricing_items?.item_code,
        description: row.stock_items?.pricing_items?.description,
        unit: row.stock_items?.pricing_items?.unit,
        category: row.stock_items?.pricing_items?.category,
        location_name: row.stock_locations?.name,
        age_days: ageDays
      } as any;
    });
  },

  /**
   * Stock Valuation report. Grouped by category / company-wide or per location.
   */
  async getValuationReport(locationId?: string): Promise<{
    grandTotalValue: number;
    categories: Array<{ category: string; qty: number; value: number }>;
    items: Array<{
      item_code: string;
      description: string;
      category: string;
      qty_on_hand: number;
      avg_unit_cost: number;
      total_value: number;
      location_name: string;
    }>;
  }> {
    let query = supabase
      .from('stock_balances')
      .select(`
        qty_on_hand,
        avg_unit_cost,
        stock_items(
          pricing_items(item_code, description, category)
        ),
        stock_locations(name)
      `)
      .gt('qty_on_hand', 0);

    if (locationId) {
      query = query.eq('location_id', locationId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const items = (data || []).map(row => {
      const qty = Number(row.qty_on_hand);
      const cost = Number(row.avg_unit_cost);
      const stockItem = row.stock_items as any;
      const stockLocation = row.stock_locations as any;
      return {
        item_code: stockItem?.pricing_items?.item_code || '',
        description: stockItem?.pricing_items?.description || '',
        category: stockItem?.pricing_items?.category || 'Unassigned',
        qty_on_hand: qty,
        avg_unit_cost: cost,
        total_value: qty * cost,
        location_name: stockLocation?.name || ''
      };
    });

    const grandTotalValue = items.reduce((sum, item) => sum + item.total_value, 0);

    // Group by Category
    const catMap = new Map<string, { qty: number; value: number }>();
    for (const item of items) {
      const existing = catMap.get(item.category) || { qty: 0, value: 0 };
      catMap.set(item.category, {
        qty: existing.qty + item.qty_on_hand,
        value: existing.value + item.total_value
      });
    }

    const categories = Array.from(catMap.entries()).map(([category, metrics]) => ({
      category,
      qty: metrics.qty,
      value: metrics.value
    }));

    return {
      grandTotalValue,
      categories,
      items
    };
  }
};

export default stockService;
