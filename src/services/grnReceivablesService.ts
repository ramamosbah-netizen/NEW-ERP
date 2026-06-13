// ============================================================
// JEET ERP — GRN Receivables
// Consolidated view of every line item awaiting receipt across
// open LPOs (and direct-purchased PRs), with project, supplier,
// ordered/received/outstanding qty, per-line delivery status,
// and the LPO's payment status (from supplier invoices).
// ============================================================

import { supabase } from '@/lib/supabase';

export type ReceivableSource = 'LPO' | 'PR';
export type PaymentStatus = 'PAID' | 'PARTIAL' | 'PENDING' | 'NOT_INVOICED';

export interface ReceivableItem {
  source: ReceivableSource;
  source_id: string;          // po id or pr id
  source_ref: string;         // po_number or pr_number
  po_item_id?: string;
  description: string;
  system: string | null;
  unit: string;
  ordered_qty: number;
  received_qty: number;
  outstanding_qty: number;
  unit_price: number;
  line_status: string;        // PENDING | PARTIAL | COMPLETE | CLOSED_SHORT | (PR) REQUESTED
  project_id: string | null;
  project_number: string | null;
  supplier_name: string | null;
  required_delivery_date: string | null;
  payment_status: PaymentStatus;
  payment_due_date: string | null;
}

const OPEN_PO_STATUSES = ['APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_DELIVERED'];

const safe = async <T>(p: PromiseLike<{ data: T | null; error: unknown }>, fb: T): Promise<T> => {
  try { const { data } = await p; return data ?? fb; } catch { return fb; }
};

export const grnReceivablesService = {
  async getReceivables(): Promise<ReceivableItem[]> {
    // 1. Open LPOs
    const pos = await safe<any[]>(
      supabase.from('purchase_orders')
        .select('id, po_number, status, project_id, supplier_name, required_delivery_date')
        .in('status', OPEN_PO_STATUSES), []);

    const poIds = pos.map(p => p.id);
    const projectIds = Array.from(new Set(pos.map(p => p.project_id).filter(Boolean))) as string[];

    // 2. Their items, payment (supplier invoices), and project numbers in parallel
    const [items, invoices, projects] = await Promise.all([
      poIds.length ? safe<any[]>(supabase.from('po_items')
        .select('id, po_id, description, system, unit, quantity, unit_price, qty_received, receipt_status')
        .in('po_id', poIds), []) : Promise.resolve([]),
      poIds.length ? safe<any[]>(supabase.from('supplier_invoices')
        .select('po_id, status, total, amount_paid, due_date')
        .in('po_id', poIds), []) : Promise.resolve([]),
      projectIds.length ? safe<any[]>(supabase.from('projects')
        .select('id, project_number').in('id', projectIds), []) : Promise.resolve([]),
    ]);

    const projectMap = new Map(projects.map((p: any) => [p.id, p.project_number]));
    const poMap = new Map(pos.map(p => [p.id, p]));

    // Payment status per PO from its supplier invoices
    const payByPo = new Map<string, { status: PaymentStatus; due: string | null }>();
    const invByPo = new Map<string, any[]>();
    for (const inv of invoices) {
      if (!invByPo.has(inv.po_id)) invByPo.set(inv.po_id, []);
      invByPo.get(inv.po_id)!.push(inv);
    }
    for (const [poId, invs] of invByPo) {
      const total = invs.reduce((s, i) => s + (Number(i.total) || 0), 0);
      const paid = invs.reduce((s, i) => s + (Number(i.amount_paid) || 0), 0);
      const due = invs.map(i => i.due_date).filter(Boolean).sort()[0] || null;
      let status: PaymentStatus = 'PENDING';
      if (paid >= total && total > 0) status = 'PAID';
      else if (paid > 0) status = 'PARTIAL';
      payByPo.set(poId, { status, due });
    }

    const rows: ReceivableItem[] = [];
    for (const it of items) {
      const po = poMap.get(it.po_id);
      if (!po) continue;
      const ordered = Number(it.quantity) || 0;
      const received = Number(it.qty_received) || 0;
      const outstanding = Math.max(0, ordered - received);
      // skip fully-closed lines
      if (it.receipt_status === 'COMPLETE' || it.receipt_status === 'CLOSED_SHORT') continue;
      const pay = payByPo.get(it.po_id);
      rows.push({
        source: 'LPO',
        source_id: it.po_id,
        source_ref: po.po_number,
        po_item_id: it.id,
        description: it.description,
        system: it.system || null,
        unit: it.unit,
        ordered_qty: ordered,
        received_qty: received,
        outstanding_qty: outstanding,
        unit_price: Number(it.unit_price) || 0,
        line_status: it.receipt_status || 'PENDING',
        project_id: po.project_id,
        project_number: po.project_id ? (projectMap.get(po.project_id) || null) : null,
        supplier_name: po.supplier_name,
        required_delivery_date: po.required_delivery_date,
        payment_status: pay?.status || 'NOT_INVOICED',
        payment_due_date: pay?.due || null,
      });
    }

    // 3. Approved / direct-purchased PRs not yet converted to an LPO (degrade if PR tables absent)
    const prs = await safe<any[]>(
      supabase.from('purchase_requests')
        .select('id, pr_number, status, project_id')
        .in('status', ['APPROVED', 'DIRECT_PURCHASED']), []);
    const prIds = prs.map(p => p.id);
    if (prIds.length) {
      const prProjIds = Array.from(new Set(prs.map(p => p.project_id).filter(Boolean))) as string[];
      const prProjects = prProjIds.length
        ? await safe<any[]>(supabase.from('projects').select('id, project_number').in('id', prProjIds), [])
        : [];
      const prProjMap = new Map(prProjects.map((p: any) => [p.id, p.project_number]));
      const prItems = await safe<any[]>(
        supabase.from('purchase_request_items')
          .select('id, pr_id, description, system, unit, quantity, estimated_unit_cost')
          .in('pr_id', prIds), []);
      const prMap = new Map(prs.map(p => [p.id, p]));
      for (const it of prItems) {
        const pr = prMap.get(it.pr_id);
        if (!pr) continue;
        rows.push({
          source: 'PR',
          source_id: it.pr_id,
          source_ref: pr.pr_number,
          description: it.description,
          system: it.system || null,
          unit: it.unit,
          ordered_qty: Number(it.quantity) || 0,
          received_qty: 0,
          outstanding_qty: Number(it.quantity) || 0,
          unit_price: Number(it.estimated_unit_cost) || 0,
          line_status: pr.status === 'DIRECT_PURCHASED' ? 'DIRECT_PURCHASED' : 'REQUESTED',
          project_id: pr.project_id,
          project_number: pr.project_id ? (prProjMap.get(pr.project_id) || null) : null,
          supplier_name: null,
          required_delivery_date: null,
          payment_status: 'NOT_INVOICED',
          payment_due_date: null,
        });
      }
    }

    return rows;
  },

  /**
   * Cancels (closes short) an LPO line item that won't be delivered. If every
   * line of the LPO ends up complete or closed, the LPO is cancelled too.
   */
  async cancelLineItem(poItemId: string): Promise<void> {
    const { data: item } = await supabase
      .from('po_items').select('id, po_id').eq('id', poItemId).single();
    if (!item) throw new Error('Line item not found');

    const { error } = await supabase
      .from('po_items')
      .update({ receipt_status: 'CLOSED_SHORT' })
      .eq('id', poItemId);
    if (error) throw error;

    // If all lines are now closed/complete, cancel the parent LPO
    const { data: siblings } = await supabase
      .from('po_items').select('receipt_status').eq('po_id', item.po_id);
    const allDone = (siblings || []).every(s => s.receipt_status === 'COMPLETE' || s.receipt_status === 'CLOSED_SHORT');
    if (allDone) {
      await supabase.from('purchase_orders')
        .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
        .eq('id', item.po_id)
        .then(({ error: e }) => { if (e) console.warn('Could not auto-cancel LPO:', e.message); });
    }
  },
};

export default grnReceivablesService;
