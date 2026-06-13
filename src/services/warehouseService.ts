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
  // Historic performance (computed from purchase orders)
  po_count: number;
  total_value: number;
  last_order_at: string | null;
  on_time_pct: number | null;
  score: number; // 0-100 composite
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
        po_count: list.length,
        total_value: Number(total.toFixed(2)),
        last_order_at: lastOrder,
        on_time_pct: onTimePct,
        score: Math.max(0, Math.min(100, score)),
      };
    });
  },

  async createSupplier(input: {
    name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    payment_terms_days?: number;
    systems_covered?: string[];
    preferred?: boolean;
  }): Promise<void> {
    const { error } = await supabase.from('pricing_suppliers').insert({
      name: input.name.trim(),
      contact_person: input.contact_person || null,
      phone: input.phone || null,
      email: input.email || null,
      payment_terms_days: input.payment_terms_days ?? 30,
      systems_covered: input.systems_covered || [],
      preferred: input.preferred ?? false,
      is_active: true,
    });
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
