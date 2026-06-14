// ============================================================
// JEET ERP — GRN-to-Expense Finance Report
// Reconciles received goods value against supplier invoicing and
// payment, by project, for a period. Answers: what did we receive,
// how much is invoiced, how much paid, what's still open.
// ============================================================

import { supabase } from '@/lib/supabase';

export type ExpensePeriod = 'ALL' | 'MONTH' | 'QUARTER' | 'YEAR';

export interface ExpenseRow {
  project_id: string | null;
  project_number: string;
  received_value: number;     // value of goods received (GRN'd)
  invoiced_value: number;     // supplier invoices total
  paid_value: number;         // amount paid on those invoices
  outstanding: number;        // invoiced - paid
  uninvoiced: number;         // received - invoiced (goods received not yet billed)
}

export interface ExpenseReport {
  rows: ExpenseRow[];
  totals: Omit<ExpenseRow, 'project_id' | 'project_number'>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const periodStart = (p: ExpensePeriod): Date | null => {
  const now = new Date();
  if (p === 'MONTH') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (p === 'QUARTER') return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  if (p === 'YEAR') return new Date(now.getFullYear(), 0, 1);
  return null;
};

const safe = async <T>(p: PromiseLike<{ data: T | null; error: unknown }>, fb: T): Promise<T> => {
  try { const { data } = await p; return data ?? fb; } catch { return fb; }
};

export const grnExpenseService = {
  async getReport(period: ExpensePeriod = 'ALL'): Promise<ExpenseReport> {
    const start = periodStart(period);
    const startISO = start ? start.toISOString() : null;

    // 1. GRNs in period (+ their items, and po_items unit prices)
    let grnQuery = supabase.from('grns').select('id, po_id, project_id, received_at');
    if (startISO) grnQuery = grnQuery.gte('received_at', startISO);
    const grns = await safe<any[]>(grnQuery, []);
    const grnIds = grns.map(g => g.id);

    const grnItems = grnIds.length
      ? await safe<any[]>(supabase.from('grn_items').select('grn_id, po_item_id, qty_received').in('grn_id', grnIds), [])
      : [];
    const poItemIds = Array.from(new Set(grnItems.map(i => i.po_item_id).filter(Boolean))) as string[];
    const poItems = poItemIds.length
      ? await safe<any[]>(supabase.from('po_items').select('id, unit_price').in('id', poItemIds), [])
      : [];
    const priceByPoItem = new Map(poItems.map((p: any) => [p.id, Number(p.unit_price) || 0]));
    const grnProject = new Map(grns.map(g => [g.id, g.project_id]));

    // received value per project
    const receivedByProject = new Map<string, number>();
    for (const gi of grnItems) {
      const projId = grnProject.get(gi.grn_id) || 'NONE';
      const val = (Number(gi.qty_received) || 0) * (priceByPoItem.get(gi.po_item_id) || 0);
      receivedByProject.set(projId, (receivedByProject.get(projId) || 0) + val);
    }

    // 2. Supplier invoices in period, grouped by project
    let invQuery = supabase.from('supplier_invoices').select('project_id, total, amount_paid, invoice_date');
    if (startISO) invQuery = invQuery.gte('invoice_date', start!.toISOString().slice(0, 10));
    const invoices = await safe<any[]>(invQuery, []);

    const invoicedByProject = new Map<string, number>();
    const paidByProject = new Map<string, number>();
    for (const inv of invoices) {
      const projId = inv.project_id || 'NONE';
      invoicedByProject.set(projId, (invoicedByProject.get(projId) || 0) + (Number(inv.total) || 0));
      paidByProject.set(projId, (paidByProject.get(projId) || 0) + (Number(inv.amount_paid) || 0));
    }

    // 3. Resolve project numbers
    const allProjIds = Array.from(new Set([
      ...receivedByProject.keys(), ...invoicedByProject.keys(),
    ].filter(id => id && id !== 'NONE'))) as string[];
    const projects = allProjIds.length
      ? await safe<any[]>(supabase.from('projects').select('id, project_number').in('id', allProjIds), [])
      : [];
    const projNum = new Map(projects.map((p: any) => [p.id, p.project_number]));

    // 4. Assemble rows
    const keys = new Set<string>([...receivedByProject.keys(), ...invoicedByProject.keys()]);
    const rows: ExpenseRow[] = [];
    for (const key of keys) {
      const received = round2(receivedByProject.get(key) || 0);
      const invoiced = round2(invoicedByProject.get(key) || 0);
      const paid = round2(paidByProject.get(key) || 0);
      rows.push({
        project_id: key === 'NONE' ? null : key,
        project_number: key === 'NONE' ? 'Overhead / Unassigned' : (projNum.get(key) || key.slice(0, 8)),
        received_value: received,
        invoiced_value: invoiced,
        paid_value: paid,
        outstanding: round2(invoiced - paid),
        uninvoiced: round2(received - invoiced),
      });
    }
    rows.sort((a, b) => b.received_value - a.received_value);

    const totals = rows.reduce((t, r) => ({
      received_value: round2(t.received_value + r.received_value),
      invoiced_value: round2(t.invoiced_value + r.invoiced_value),
      paid_value: round2(t.paid_value + r.paid_value),
      outstanding: round2(t.outstanding + r.outstanding),
      uninvoiced: round2(t.uninvoiced + r.uninvoiced),
    }), { received_value: 0, invoiced_value: 0, paid_value: 0, outstanding: 0, uninvoiced: 0 });

    return { rows, totals };
  },
};

export default grnExpenseService;
