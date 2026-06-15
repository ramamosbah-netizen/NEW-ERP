// ============================================================
// JEET ERP — Finance: Retention Payable (subcontractor retention)
// Net retention held per subcontractor/project from the supplier
// retention ledger (HELD − RELEASED), with release-schedule status.
// ============================================================

import { supabase } from '@/lib/supabase';
import { auditService } from './auditService';

export type RetentionStatus = 'RELEASED' | 'OVERDUE' | 'DUE' | 'SCHEDULED';

export interface SupplierRetentionRow {
  key: string;
  supplier_id: string | null;
  supplier_name: string;
  project_id: string | null;
  project_number: string;
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

export const supplierRetentionService = {
  async list(): Promise<SupplierRetentionRow[]> {
    const ledger = await safe<any[]>(
      supabase.from('supplier_retention_ledger').select('supplier_id, supplier_name, project_id, direction, amount, expected_release_date'), []);
    if (!ledger.length) return [];

    const groups = new Map<string, { supplier_id: string | null; supplier_name: string; project_id: string | null; held: number; released: number; expected: string | null }>();
    for (const l of ledger) {
      const key = `${l.supplier_id || 'x'}::${l.project_id || 'x'}`;
      const g = groups.get(key) || { supplier_id: l.supplier_id, supplier_name: l.supplier_name || '—', project_id: l.project_id, held: 0, released: 0, expected: null };
      if (l.direction === 'HELD') { g.held += Number(l.amount) || 0; if (l.expected_release_date && (!g.expected || l.expected_release_date > g.expected)) g.expected = l.expected_release_date; }
      else g.released += Number(l.amount) || 0;
      if (l.supplier_name) g.supplier_name = l.supplier_name;
      groups.set(key, g);
    }

    const projIds = Array.from(new Set([...groups.values()].map(g => g.project_id).filter(Boolean))) as string[];
    const projects = projIds.length ? await safe<any[]>(supabase.from('projects').select('id, project_number').in('id', projIds), []) : [];
    const projNum = new Map(projects.map((p: any) => [p.id, p.project_number]));

    const today = new Date().toISOString().slice(0, 10);
    const thisMonth = today.slice(0, 7);

    return [...groups.entries()].map(([key, g]) => {
      const net = r2(g.held - g.released);
      let status: RetentionStatus;
      if (net <= 0.01) status = 'RELEASED';
      else if (g.expected && g.expected < today) status = 'OVERDUE';
      else if (g.expected && g.expected.slice(0, 7) === thisMonth) status = 'DUE';
      else status = 'SCHEDULED';
      return {
        key, supplier_id: g.supplier_id, supplier_name: g.supplier_name,
        project_id: g.project_id, project_number: g.project_id ? (projNum.get(g.project_id) || '—') : '—',
        held: r2(g.held), released: r2(g.released), net, expected_release_date: g.expected, status,
      };
    }).sort((a, b) => (a.expected_release_date || '9999').localeCompare(b.expected_release_date || '9999'));
  },

  async addHold(input: { supplier_id?: string | null; supplier_name: string; project_id?: string | null; amount: number; expected_release_date?: string | null; notes?: string | null }): Promise<void> {
    const { data: auth } = await supabase.auth.getUser();
    if (!input.supplier_name?.trim()) throw new Error('Subcontractor is required.');
    if (!(Number(input.amount) > 0)) throw new Error('Enter an amount greater than zero.');
    const { error } = await supabase.from('supplier_retention_ledger').insert({
      supplier_id: input.supplier_id || null, supplier_name: input.supplier_name.trim(),
      project_id: input.project_id || null, direction: 'HELD', amount: Number(input.amount),
      expected_release_date: input.expected_release_date || null, notes: input.notes || null, created_by: auth?.user?.id ?? null,
    });
    if (error) throw new Error(error.message);
    auditService.logEvent({ module: 'FINANCE', action: 'CREATE', entity_type: 'SUPPLIER_RETENTION', entity_id: input.supplier_id || 'manual', summary: `Held retention ${input.amount} AED from ${input.supplier_name}` });
  },

  async release(input: { supplier_id?: string | null; supplier_name: string; project_id?: string | null; amount: number }): Promise<void> {
    const { data: auth } = await supabase.auth.getUser();
    if (!(Number(input.amount) > 0)) throw new Error('Nothing to release.');
    const { error } = await supabase.from('supplier_retention_ledger').insert({
      supplier_id: input.supplier_id || null, supplier_name: input.supplier_name,
      project_id: input.project_id || null, direction: 'RELEASED', amount: Number(input.amount),
      notes: 'Retention released', created_by: auth?.user?.id ?? null,
    });
    if (error) throw new Error(error.message);
    auditService.logEvent({ module: 'FINANCE', action: 'RELEASE', entity_type: 'SUPPLIER_RETENTION', entity_id: input.supplier_id || 'manual', summary: `Released retention ${input.amount} AED to ${input.supplier_name}` });
  },
};

export default supplierRetentionService;
