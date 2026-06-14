// ============================================================
// JEET ERP — Finance: Commitments ledger (cross-project)
// Unifies manual commitments (cost_commitments table) with LIVE
// commitments derived from approved LPOs and outstanding payroll
// payables. Read-only over existing data — no write-hooks, nothing
// existing is modified. Separate from commitmentService (which is
// the per-project by-system budget comparison).
// ============================================================

import { supabase } from '@/lib/supabase';

export type CommitmentSource = 'PR' | 'PO' | 'SUBCONTRACT' | 'PAYROLL' | 'RECURRING' | 'OTHER';
export type CommitmentStatus = 'OPEN' | 'PARTIAL' | 'SETTLED' | 'CANCELLED';

export interface CommitmentRow {
  id: string;
  source_type: CommitmentSource;
  source_id: string | null;
  project_id: string | null;
  project_number: string;
  vendor_name: string;
  category: string;
  amount: number;          // outstanding commitment
  committed_date: string | null;
  expected_payment_date: string | null;
  status: CommitmentStatus;
  manual: boolean;
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const safe = async <T>(p: PromiseLike<{ data: T | null; error: unknown }>, fb: T): Promise<T> => {
  try { const { data } = await p; return data ?? fb; } catch { return fb; }
};

const PO_COMMITTED = ['APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_DELIVERED', 'DELIVERED'];

export const commitmentLedgerService = {
  async list(): Promise<CommitmentRow[]> {
    // 1. Paid-to-date per PO (to show only the outstanding commitment)
    const bills = await safe<any[]>(
      supabase.from('supplier_invoices').select('po_id, amount_paid, total, expense_category, project_id, status, due_date, supplier_invoice_number'), []);
    const paidByPo = new Map<string, number>();
    for (const b of bills) if (b.po_id) paidByPo.set(b.po_id, (paidByPo.get(b.po_id) || 0) + (Number(b.amount_paid) || 0));

    // 2. Approved/open LPOs → commitments
    const pos = await safe<any[]>(
      supabase.from('purchase_orders')
        .select('id, po_number, supplier_name, project_id, po_type, total, payment_terms_days, status, created_at, sent_at')
        .in('status', PO_COMMITTED), []);

    // 3. Payroll / workforce payables still outstanding (from supplier_invoices)
    const payroll = bills.filter(b => b.expense_category === 'WORKFORCE' && b.status !== 'PAID' && b.status !== 'CANCELLED');

    // 4. Manual commitments
    const manual = await safe<any[]>(
      supabase.from('cost_commitments').select('*').neq('status', 'CANCELLED').order('committed_date', { ascending: false }), []);

    // Resolve project numbers
    const projIds = Array.from(new Set([
      ...pos.map(p => p.project_id), ...payroll.map(b => b.project_id), ...manual.map(m => m.project_id),
    ].filter(Boolean))) as string[];
    const projects = projIds.length ? await safe<any[]>(supabase.from('projects').select('id, project_number').in('id', projIds), []) : [];
    const projNum = new Map(projects.map((p: any) => [p.id, p.project_number]));

    const rows: CommitmentRow[] = [];

    for (const po of pos) {
      const outstanding = r2((Number(po.total) || 0) - (paidByPo.get(po.id) || 0));
      if (outstanding <= 0.01) continue;
      const due = new Date(po.sent_at || po.created_at || Date.now());
      due.setDate(due.getDate() + (Number(po.payment_terms_days) || 30));
      rows.push({
        id: `po-${po.id}`, source_type: 'PO', source_id: po.id,
        project_id: po.project_id, project_number: po.project_id ? (projNum.get(po.project_id) || '—') : 'Overhead',
        vendor_name: po.supplier_name || '—', category: po.po_type || 'PROCUREMENT',
        amount: outstanding, committed_date: (po.sent_at || po.created_at || '').slice(0, 10),
        expected_payment_date: due.toISOString().slice(0, 10), status: 'OPEN', manual: false,
      });
    }

    for (const b of payroll) {
      const outstanding = r2((Number(b.total) || 0) - (Number(b.amount_paid) || 0));
      if (outstanding <= 0.01) continue;
      rows.push({
        id: `pay-${b.po_id || b.supplier_invoice_number}`, source_type: 'PAYROLL', source_id: null,
        project_id: b.project_id, project_number: b.project_id ? (projNum.get(b.project_id) || '—') : 'Overhead',
        vendor_name: 'Staff Payroll', category: 'WORKFORCE', amount: outstanding,
        committed_date: null, expected_payment_date: (b.due_date || '').slice(0, 10) || null, status: 'OPEN', manual: false,
      });
    }

    for (const m of manual) {
      rows.push({
        id: m.id, source_type: m.source_type, source_id: m.source_id,
        project_id: m.project_id, project_number: m.project_id ? (projNum.get(m.project_id) || '—') : 'Overhead',
        vendor_name: m.vendor_name || '—', category: m.category || m.source_type,
        amount: r2(m.amount), committed_date: m.committed_date, expected_payment_date: m.expected_payment_date,
        status: m.status, manual: true,
      });
    }

    return rows.sort((a, b) => b.amount - a.amount);
  },

  async addManual(input: {
    project_id?: string | null; source_type: CommitmentSource; category?: string; vendor_name?: string;
    amount: number; committed_date?: string | null; expected_payment_date?: string | null; notes?: string | null;
  }): Promise<void> {
    const { data: auth } = await supabase.auth.getUser();
    if (!(Number(input.amount) > 0)) throw new Error('Enter an amount greater than zero.');
    const { error } = await supabase.from('cost_commitments').insert({
      project_id: input.project_id || null, source_type: input.source_type, category: input.category || null,
      vendor_name: input.vendor_name || null, amount: Number(input.amount),
      committed_date: input.committed_date || new Date().toISOString().slice(0, 10),
      expected_payment_date: input.expected_payment_date || null, notes: input.notes || null,
      status: 'OPEN', created_by: auth?.user?.id ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async cancelManual(id: string): Promise<void> {
    await supabase.from('cost_commitments').update({ status: 'CANCELLED', updated_at: new Date().toISOString() }).eq('id', id);
  },
};

export default commitmentLedgerService;
