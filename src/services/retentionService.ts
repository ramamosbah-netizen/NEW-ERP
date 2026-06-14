// ============================================================
// JEET ERP — Finance: Retention Management
// Read-only view over the existing project_retention_ledger
// (client-side retention receivable). Net held per invoice =
// HELD − RELEASED, with release-schedule status. Nothing existing
// is modified.
// ============================================================

import { supabase } from '@/lib/supabase';

export type RetentionStatus = 'RELEASED' | 'OVERDUE' | 'DUE' | 'SCHEDULED';

export interface RetentionRow {
  invoice_id: string;
  invoice_number: string;
  project_id: string | null;
  project_number: string;
  client_name: string;
  held: number;
  released: number;
  net: number;
  expected_release_date: string | null;
  status: RetentionStatus;
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const safe = async <T>(p: PromiseLike<{ data: T | null; error: unknown }>, fb: T): Promise<T> => {
  try { const { data } = await p; return data ?? fb; } catch { return fb; }
};

export const retentionService = {
  async list(): Promise<RetentionRow[]> {
    const ledger = await safe<any[]>(
      supabase.from('project_retention_ledger').select('project_id, invoice_id, direction, amount, expected_release_date'), []);
    if (!ledger.length) return [];

    const byInvoice = new Map<string, { project_id: string | null; held: number; released: number; expected: string | null }>();
    for (const l of ledger) {
      const e = byInvoice.get(l.invoice_id) || { project_id: l.project_id, held: 0, released: 0, expected: null };
      if (l.direction === 'HELD') { e.held += Number(l.amount) || 0; if (l.expected_release_date && (!e.expected || l.expected_release_date > e.expected)) e.expected = l.expected_release_date; }
      else if (l.direction === 'RELEASED') e.released += Number(l.amount) || 0;
      byInvoice.set(l.invoice_id, e);
    }

    const invIds = Array.from(byInvoice.keys());
    const invoices = invIds.length ? await safe<any[]>(supabase.from('client_invoices').select('id, invoice_number, client_name, project_id').in('id', invIds), []) : [];
    const invMap = new Map(invoices.map((i: any) => [i.id, i]));
    const projIds = Array.from(new Set(invoices.map((i: any) => i.project_id).filter(Boolean)));
    const projects = projIds.length ? await safe<any[]>(supabase.from('projects').select('id, project_number').in('id', projIds), []) : [];
    const projNum = new Map(projects.map((p: any) => [p.id, p.project_number]));

    const today = new Date().toISOString().slice(0, 10);
    const thisMonth = today.slice(0, 7);

    const rows: RetentionRow[] = [];
    for (const [invId, e] of byInvoice) {
      const net = r2(e.held - e.released);
      const inv = invMap.get(invId) || {};
      let status: RetentionStatus;
      if (net <= 0.01) status = 'RELEASED';
      else if (e.expected && e.expected < today) status = 'OVERDUE';
      else if (e.expected && e.expected.slice(0, 7) === thisMonth) status = 'DUE';
      else status = 'SCHEDULED';
      rows.push({
        invoice_id: invId, invoice_number: inv.invoice_number || '—',
        project_id: e.project_id, project_number: e.project_id ? (projNum.get(e.project_id) || '—') : '—',
        client_name: inv.client_name || '—',
        held: r2(e.held), released: r2(e.released), net, expected_release_date: e.expected, status,
      });
    }
    return rows.sort((a, b) => (a.expected_release_date || '9999').localeCompare(b.expected_release_date || '9999'));
  },
};

export default retentionService;
