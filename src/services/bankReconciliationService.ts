// ============================================================
// JEET ERP — Finance: Bank Reconciliation service
// Imports statement lines, auto-matches them against system
// receipts (client_payments) and payments (supplier_payments +
// quick-paid expenses), and tracks match state. Read-only over the
// source tables; nothing existing is modified.
// ============================================================

import { supabase } from '@/lib/supabase';

export interface ReconHeader {
  id: string; payment_account_id: string | null; account_name: string | null; statement_date: string;
  opening_balance: number; closing_balance: number; status: 'DRAFT' | 'COMPLETED'; created_at: string;
}
export interface ReconLine {
  id: string; reconciliation_id: string; txn_date: string | null; description: string | null;
  reference: string | null; amount: number; matched: boolean; match_type: string; matched_ref: string | null;
}
export interface ImportRow { date?: string; description?: string; reference?: string; amount: number; }

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const safe = async <T>(p: PromiseLike<{ data: T | null; error: unknown }>, fb: T): Promise<T> => {
  try { const { data } = await p; return data ?? fb; } catch { return fb; }
};
const daysApart = (a?: string | null, b?: string | null) => {
  if (!a || !b) return 999; return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
};

export const bankReconciliationService = {
  async list(): Promise<(ReconHeader & { unmatched: number; total: number })[]> {
    const recons = await safe<any[]>(supabase.from('bank_reconciliations').select('*').order('statement_date', { ascending: false }), []);
    const lines = await safe<any[]>(supabase.from('bank_reconciliation_lines').select('reconciliation_id, matched'), []);
    return recons.map((r: any) => {
      const rl = lines.filter(l => l.reconciliation_id === r.id);
      return { ...r, total: rl.length, unmatched: rl.filter(l => !l.matched).length };
    });
  },

  async get(id: string): Promise<{ header: ReconHeader; lines: ReconLine[] } | null> {
    const header = await safe<any>(supabase.from('bank_reconciliations').select('*').eq('id', id).maybeSingle(), null);
    if (!header) return null;
    const lines = await safe<any[]>(supabase.from('bank_reconciliation_lines').select('*').eq('reconciliation_id', id).order('txn_date'), []);
    return { header, lines: lines as ReconLine[] };
  },

  async create(input: { payment_account_id?: string | null; account_name?: string; statement_date: string; opening_balance?: number; closing_balance?: number }): Promise<string> {
    const { data: auth } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('bank_reconciliations').insert({
      payment_account_id: input.payment_account_id || null, account_name: input.account_name || null,
      statement_date: input.statement_date, opening_balance: Number(input.opening_balance) || 0,
      closing_balance: Number(input.closing_balance) || 0, status: 'DRAFT', created_by: auth?.user?.id ?? null,
    }).select('id').single();
    if (error) throw new Error(error.message);
    return data.id;
  },

  async importLines(reconId: string, rows: ImportRow[]): Promise<number> {
    const clean = rows.filter(r => Number.isFinite(r.amount) && r.amount !== 0);
    if (!clean.length) return 0;
    const { error } = await supabase.from('bank_reconciliation_lines').insert(clean.map(r => ({
      reconciliation_id: reconId, txn_date: r.date || null, description: r.description || null,
      reference: r.reference || null, amount: r2(r.amount), matched: false, match_type: 'NONE',
    })));
    if (error) throw new Error(error.message);
    return clean.length;
  },

  /** Auto-match unmatched lines against system receipts/payments by amount ± date. */
  async autoMatch(reconId: string): Promise<number> {
    const lines = await safe<any[]>(supabase.from('bank_reconciliation_lines').select('*').eq('reconciliation_id', reconId).eq('matched', false), []);
    if (!lines.length) return 0;
    const clientPays = await safe<any[]>(supabase.from('client_payments').select('payment_number, amount, payment_date'), []);
    const supplierPays = await safe<any[]>(supabase.from('supplier_payments').select('payment_number, amount, payment_date'), []);

    let matched = 0;
    for (const l of lines) {
      const amt = Math.abs(Number(l.amount) || 0);
      if (l.amount > 0) {
        const hit = clientPays.find(p => Math.abs((Number(p.amount) || 0) - amt) < 0.01 && daysApart(p.payment_date, l.txn_date) <= 5);
        if (hit) { await supabase.from('bank_reconciliation_lines').update({ matched: true, match_type: 'CLIENT_PAYMENT', matched_ref: hit.payment_number }).eq('id', l.id); matched++; continue; }
      } else {
        const hit = supplierPays.find(p => Math.abs((Number(p.amount) || 0) - amt) < 0.01 && daysApart(p.payment_date, l.txn_date) <= 5);
        if (hit) { await supabase.from('bank_reconciliation_lines').update({ matched: true, match_type: 'SUPPLIER_PAYMENT', matched_ref: hit.payment_number }).eq('id', l.id); matched++; continue; }
      }
    }
    return matched;
  },

  async setLine(lineId: string, patch: { matched?: boolean; match_type?: string; matched_ref?: string | null }): Promise<void> {
    await supabase.from('bank_reconciliation_lines').update({
      ...(patch.matched !== undefined ? { matched: patch.matched } : {}),
      ...(patch.match_type ? { match_type: patch.match_type } : {}),
      ...(patch.matched_ref !== undefined ? { matched_ref: patch.matched_ref } : {}),
    }).eq('id', lineId);
  },

  async complete(id: string): Promise<void> {
    await supabase.from('bank_reconciliations').update({ status: 'COMPLETED' }).eq('id', id);
  },
};

export default bankReconciliationService;
