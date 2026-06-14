// ============================================================
// JEET ERP — Warehouse & Inventory Service
// Aggregates the supplier/subcontractor registry (with historic
// scoring from PO performance), the store (stock items +
// balances + risk), and goods movements (stock transactions).
// Reads existing inventory/procurement tables — populated by the
// GRN, MRF and PO flows — so anything received, issued, moved,
// returned or written-off shows up here automatically.
// ============================================================

import { supabase } from '@/lib/supabase';
import { stockTransactionService } from '@/services/stockTransactionService';
import type { StockTransactionType } from '@/types/stock.types';

export interface SupplierRow {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  systems_covered: string[] | null;
  payment_terms_days: number | null;
  preferred: boolean;
  is_active: boolean;
  supplier_type: 'SUPPLIER' | 'SUBCONTRACTOR' | 'BOTH';
  trade: string | null;
  day_rate: number | null;
  // Historic performance (computed from purchase orders)
  po_count: number;
  total_value: number;
  last_order_at: string | null;
  on_time_pct: number | null;
  score: number; // 0-100 composite
}

export interface SupplierPOHistory {
  id: string;
  po_number: string;
  status: string;
  total: number;
  created_at: string;
  required_delivery_date: string | null;
  acknowledged_at: string | null;
  on_time: boolean | null;
  project_number: string | null;
}

export interface SupplierDetail extends SupplierRow {
  manpower_notes: string | null;
  history: SupplierPOHistory[];
}

export interface StockRow {
  stock_item_id: string;
  item_code: string;
  description: string;
  unit: string;
  qty_on_hand: number;
  qty_available: number;
  qty_reserved: number;
  avg_unit_cost: number;
  stock_value: number;
  reorder_level: number | null;
  risk: 'OUT' | 'LOW' | 'OK' | 'NONE';
  last_movement_at: string | null;
}

export interface MovementRow {
  id: string;
  transaction_number: string;
  type: string;
  item_code: string;
  description: string;
  qty: number;
  unit_cost: number;
  total_value: number;
  location_name: string;
  project_number: string | null;
  reason: string | null;
  created_at: string;
}

const safe = async <T>(p: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> => {
  try { const { data } = await p; return (data ?? fallback); } catch { return fallback; }
};

export const warehouseService = {
  // ---------- Suppliers & subcontractors registry + scoring ----------
  async getSuppliers(): Promise<SupplierRow[]> {
    const { data: suppliers, error } = await supabase
      .from('pricing_suppliers')
      .select('*')
      .order('name');
    if (error) throw error;

    // Historic performance from purchase orders
    const pos = await safe<any[]>(
      supabase.from('purchase_orders').select('supplier_id, total, status, created_at, required_delivery_date, acknowledged_at'),
      []
    );

    const bySupplier = new Map<string, any[]>();
    for (const po of pos) {
      if (!po.supplier_id) continue;
      if (!bySupplier.has(po.supplier_id)) bySupplier.set(po.supplier_id, []);
      bySupplier.get(po.supplier_id)!.push(po);
    }

    return (suppliers || []).map((s: any) => {
      const list = bySupplier.get(s.id) || [];
      const total = list.reduce((sum, p) => sum + (Number(p.total) || 0), 0);
      const lastOrder = list.reduce<string | null>((latest, p) =>
        !latest || (p.created_at && p.created_at > latest) ? p.created_at : latest, null);

      // On-time %: of POs with both required + acknowledged dates, share acknowledged on/before required
      const withDates = list.filter(p => p.required_delivery_date && p.acknowledged_at);
      const onTime = withDates.filter(p => new Date(p.acknowledged_at) <= new Date(p.required_delivery_date)).length;
      const onTimePct = withDates.length > 0 ? Math.round((onTime / withDates.length) * 100) : null;

      // Composite score: base on order history depth + on-time + preferred flag
      let score = 50;
      if (list.length >= 1) score += 10;
      if (list.length >= 5) score += 10;
      if (onTimePct != null) score = Math.round(score * 0.5 + onTimePct * 0.5);
      if (s.preferred) score = Math.min(100, score + 10);
      if (!s.is_active) score = Math.max(0, score - 20);

      return {
        id: s.id,
        name: s.name,
        contact_person: s.contact_person,
        phone: s.phone,
        email: s.email,
        systems_covered: s.systems_covered,
        payment_terms_days: s.payment_terms_days,
        preferred: !!s.preferred,
        is_active: !!s.is_active,
        supplier_type: (s.supplier_type as SupplierRow['supplier_type']) || 'SUPPLIER',
        trade: s.trade ?? null,
        day_rate: s.day_rate != null ? Number(s.day_rate) : null,
        po_count: list.length,
        total_value: Number(total.toFixed(2)),
        last_order_at: lastOrder,
        on_time_pct: onTimePct,
        score: Math.max(0, Math.min(100, score)),
      };
    });
  },

  /** Full supplier profile with PO-by-PO history (for the scorecard). */
  async getSupplierDetail(id: string): Promise<SupplierDetail | null> {
    const all = await this.getSuppliers();
    const base = all.find(s => s.id === id);
    if (!base) return null;

    const { data: sup } = await supabase
      .from('pricing_suppliers').select('manpower_notes').eq('id', id).maybeSingle();

    const pos = await safe<any[]>(
      supabase.from('purchase_orders')
        .select('id, po_number, status, total, created_at, required_delivery_date, acknowledged_at, project_id')
        .eq('supplier_id', id)
        .order('created_at', { ascending: false }),
      []
    );

    const projectIds = Array.from(new Set(pos.map(p => p.project_id).filter(Boolean))) as string[];
    let projMap = new Map<string, string>();
    if (projectIds.length > 0) {
      const projects = await safe<any[]>(
        supabase.from('projects').select('id, project_number').in('id', projectIds), []);
      projMap = new Map(projects.map((p: any) => [p.id, p.project_number]));
    }

    const history: SupplierPOHistory[] = pos.map((p: any) => ({
      id: p.id,
      po_number: p.po_number,
      status: p.status,
      total: Number(p.total) || 0,
      created_at: p.created_at,
      required_delivery_date: p.required_delivery_date,
      acknowledged_at: p.acknowledged_at,
      on_time: (p.required_delivery_date && p.acknowledged_at)
        ? new Date(p.acknowledged_at) <= new Date(p.required_delivery_date)
        : null,
      project_number: p.project_id ? (projMap.get(p.project_id) || null) : null,
    }));

    return { ...base, manpower_notes: (sup as any)?.manpower_notes ?? null, history };
  },

  async createSupplier(input: {
    name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    payment_terms_days?: number;
    systems_covered?: string[];
    preferred?: boolean;
    supplier_type?: 'SUPPLIER' | 'SUBCONTRACTOR' | 'BOTH';
    trade?: string;
    day_rate?: number | null;
  }): Promise<void> {
    const base = {
      name: input.name.trim(),
      contact_person: input.contact_person || null,
      phone: input.phone || null,
      email: input.email || null,
      payment_terms_days: input.payment_terms_days ?? 30,
      systems_covered: input.systems_covered || [],
      preferred: input.preferred ?? false,
      is_active: true,
    };
    const withType = {
      ...base,
      supplier_type: input.supplier_type || 'SUPPLIER',
      trade: input.trade || null,
      day_rate: input.day_rate ?? null,
    };

    let { error } = await supabase.from('pricing_suppliers').insert(withType);
    // Degrade gracefully if the subcontractor columns aren't present yet
    if (error && /supplier_type|trade|day_rate|column/i.test(error.message)) {
      ({ error } = await supabase.from('pricing_suppliers').insert(base));
    }
    if (error) throw error;
  },

  async toggleSupplierActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('pricing_suppliers')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  // ---------- Store: stock items + balances + risk ----------
  async getStock(): Promise<StockRow[]> {
    const items = await safe<any[]>(
      supabase.from('stock_items').select('id, reorder_level, pricing_item_id, pricing_items(item_code, description, unit)'),
      []
    );
    if (items.length === 0) return [];

    const balances = await safe<any[]>(
      supabase.from('stock_balances').select('stock_item_id, qty_on_hand, qty_available, qty_reserved, avg_unit_cost, last_movement_at'),
      []
    );

    const balByItem = new Map<string, any[]>();
    for (const b of balances) {
      if (!balByItem.has(b.stock_item_id)) balByItem.set(b.stock_item_id, []);
      balByItem.get(b.stock_item_id)!.push(b);
    }

    return items.map((it: any) => {
      const bals = balByItem.get(it.id) || [];
      const onHand = bals.reduce((s, b) => s + Number(b.qty_on_hand || 0), 0);
      const available = bals.reduce((s, b) => s + Number(b.qty_available || 0), 0);
      const reserved = bals.reduce((s, b) => s + Number(b.qty_reserved || 0), 0);
      const value = bals.reduce((s, b) => s + Number(b.qty_on_hand || 0) * Number(b.avg_unit_cost || 0), 0);
      const lastMove = bals.reduce<string | null>((l, b) => !l || (b.last_movement_at > l) ? b.last_movement_at : l, null);
      const reorder = it.reorder_level != null ? Number(it.reorder_level) : null;

      let risk: StockRow['risk'] = 'NONE';
      if (reorder != null) {
        if (onHand <= 0) risk = 'OUT';
        else if (onHand <= reorder) risk = 'LOW';
        else risk = 'OK';
      } else if (onHand <= 0) {
        risk = 'OUT';
      }

      return {
        stock_item_id: it.id,
        item_code: it.pricing_items?.item_code || '—',
        description: it.pricing_items?.description || '—',
        unit: it.pricing_items?.unit || '',
        qty_on_hand: onHand,
        qty_available: available,
        qty_reserved: reserved,
        avg_unit_cost: bals.length ? Number((value / Math.max(onHand, 1)).toFixed(2)) : 0,
        stock_value: Number(value.toFixed(2)),
        reorder_level: reorder,
        risk,
        last_movement_at: lastMove,
      };
    });
  },

  // ---------- Locations ----------
  async getLocations(): Promise<{ id: string; name: string; location_code: string; type: string }[]> {
    const { data, error } = await supabase
      .from('stock_locations')
      .select('id, name, location_code, type')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return data || [];
  },

  async createLocation(input: { name: string; location_code: string; type: string }): Promise<void> {
    const { error } = await supabase.from('stock_locations').insert({
      name: input.name.trim(),
      location_code: input.location_code.trim().toUpperCase(),
      type: input.type,
      is_active: true,
    });
    if (error) throw error;
  },

  /** Per-location balances for one stock item — drives the movement source picker. */
  async getItemBalances(stockItemId: string): Promise<
    { location_id: string; location_name: string; qty_on_hand: number; qty_available: number; avg_unit_cost: number }[]
  > {
    const { data: bals } = await supabase
      .from('stock_balances')
      .select('location_id, qty_on_hand, qty_available, avg_unit_cost')
      .eq('stock_item_id', stockItemId);
    const locIds = Array.from(new Set((bals || []).map((b: any) => b.location_id)));
    const { data: locs } = locIds.length
      ? await supabase.from('stock_locations').select('id, name').in('id', locIds)
      : { data: [] as any[] };
    const nameById = new Map((locs || []).map((l: any) => [l.id, l.name]));
    return (bals || []).map((b: any) => ({
      location_id: b.location_id,
      location_name: nameById.get(b.location_id) || 'Store',
      qty_on_hand: Number(b.qty_on_hand) || 0,
      qty_available: Number(b.qty_available) || 0,
      avg_unit_cost: Number(b.avg_unit_cost) || 0,
    }));
  },

  /** Active projects for linking a movement (cost charge). */
  async getProjects(): Promise<{ id: string; project_number: string }[]> {
    const { data } = await supabase
      .from('projects')
      .select('id, project_number')
      .order('project_number', { ascending: false });
    return data || [];
  },

  // ---------- Stock item registration ----------
  /** Catalogue items not yet registered as stock items. */
  async getRegisterableItems(): Promise<{ id: string; item_code: string; description: string; unit: string }[]> {
    const [{ data: pricing }, { data: existing }] = await Promise.all([
      supabase.from('pricing_items').select('id, item_code, description, unit').eq('is_active', true).order('item_code'),
      supabase.from('stock_items').select('pricing_item_id'),
    ]);
    const taken = new Set((existing || []).map((s: any) => s.pricing_item_id));
    return (pricing || []).filter((p: any) => !taken.has(p.id));
  },

  async registerStockItem(input: {
    pricing_item_id: string;
    reorder_level?: number | null;
    reorder_qty?: number | null;
    preferred_supplier_id?: string | null;
    is_serialized?: boolean;
  }): Promise<void> {
    const { error } = await supabase.from('stock_items').insert({
      pricing_item_id: input.pricing_item_id,
      reorder_level: input.reorder_level ?? null,
      reorder_qty: input.reorder_qty ?? null,
      preferred_supplier_id: input.preferred_supplier_id ?? null,
      is_serialized: input.is_serialized ?? false,
      is_active: true,
    });
    if (error) throw error;
  },

  /** Registered stock items for the movement picker. */
  async getStockItemOptions(): Promise<{ id: string; item_code: string; description: string; unit: string }[]> {
    const { data, error } = await supabase
      .from('stock_items')
      .select('id, pricing_items(item_code, description, unit)')
      .eq('is_active', true);
    if (error) throw error;
    return (data || []).map((s: any) => ({
      id: s.id,
      item_code: s.pricing_items?.item_code || '—',
      description: s.pricing_items?.description || '—',
      unit: s.pricing_items?.unit || '',
    }));
  },

  /** Records a manual stock movement (sign derived from the movement type). */
  async recordManualMovement(input: {
    type: StockTransactionType;
    stock_item_id: string;
    location_id: string;
    quantity: number;      // positive magnitude entered by the user
    unit_cost: number;
    project_id?: string | null;
    reason?: string | null;
  }): Promise<string> {
    const INBOUND: StockTransactionType[] = ['GRN_RECEIPT', 'RETURN_FROM_SITE', 'TRANSFER_IN', 'ADJUSTMENT_IN'];
    const sign = INBOUND.includes(input.type) ? 1 : -1;
    const qty = sign * Math.abs(input.quantity);
    const sourceType = input.type.startsWith('TRANSFER') ? 'TRANSFER' : 'MANUAL';

    return stockTransactionService.recordTransaction({
      type: input.type,
      stock_item_id: input.stock_item_id,
      location_id: input.location_id,
      qty,
      unit_cost: input.unit_cost,
      total_value: Math.round(qty * input.unit_cost * 100) / 100,
      source_type: sourceType,
      source_id: null,
      project_id: input.project_id || null,
      counterparty_location_id: null,
      reason: input.reason || null,
    } as any);
  },

  // ---------- Goods movements ----------
  async getMovements(limit = 200): Promise<MovementRow[]> {
    const txns = await safe<any[]>(
      supabase
        .from('stock_transactions')
        .select('id, transaction_number, type, qty, unit_cost, total_value, reason, created_at, project_id, stock_items(pricing_items(item_code, description)), stock_locations!location_id(name)')
        .order('created_at', { ascending: false })
        .limit(limit),
      []
    );

    // Resolve project numbers separately (no reliable PostgREST embed path)
    const projectIds = Array.from(new Set(txns.map((t: any) => t.project_id).filter(Boolean))) as string[];
    let projectMap = new Map<string, string>();
    if (projectIds.length > 0) {
      const projects = await safe<any[]>(
        supabase.from('projects').select('id, project_number').in('id', projectIds),
        []
      );
      projectMap = new Map(projects.map((p: any) => [p.id, p.project_number]));
    }

    return txns.map((t: any) => ({
      id: t.id,
      transaction_number: t.transaction_number,
      type: t.type,
      item_code: t.stock_items?.pricing_items?.item_code || '—',
      description: t.stock_items?.pricing_items?.description || '—',
      qty: Number(t.qty),
      unit_cost: Number(t.unit_cost),
      total_value: Number(t.total_value),
      location_name: t.stock_locations?.name || '—',
      project_number: t.project_id ? (projectMap.get(t.project_id) || null) : null,
      reason: t.reason,
      created_at: t.created_at,
    }));
  },
};

export default warehouseService;
