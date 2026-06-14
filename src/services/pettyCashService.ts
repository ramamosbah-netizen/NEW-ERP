// ============================================================
// JEET ERP — Finance: Petty Cash service
// Funds (floats) + transactions (expense/replenish/return) with
// approval. Balance = opening + approved replenish/return − approved
// expense. Self-contained; nothing existing is modified.
// ============================================================

import { supabase } from '@/lib/supabase';

export type PettyTxnType = 'EXPENSE' | 'REPLENISH' | 'RETURN';
export type PettyTxnStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PettyFund {
  id: string; name: string; custodian_name: string | null; opening_balance: number;
  low_threshold: number; is_active: boolean; balance: number; pending: number; needsReplenish: boolean;
}
export interface PettyTxn {
  id: string; fund_id: string; type: PettyTxnType; amount: number; category: string | null;
  description: string | null; project_id: string | null; txn_date: string; status: PettyTxnStatus; created_at: string;
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const safe = async <T>(p: PromiseLike<{ data: T | null; error: unknown }>, fb: T): Promise<T> => {
  try { const { data } = await p; return data ?? fb; } catch { return fb; }
};

export const pettyCashService = {
  async listFunds(): Promise<PettyFund[]> {
    const funds = await safe<any[]>(supabase.from('petty_cash_funds').select('*').eq('is_active', true).order('created_at'), []);
    const txns = await safe<any[]>(supabase.from('petty_cash_transactions').select('fund_id, type, amount, status'), []);
    return funds.map((f: any) => {
      const ft = txns.filter(t => t.fund_id === f.id);
      const approved = ft.filter(t => t.status === 'APPROVED');
      const inflow = approved.filter(t => t.type === 'REPLENISH' || t.type === 'RETURN').reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const outflow = approved.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const balance = r2((Number(f.opening_balance) || 0) + inflow - outflow);
      const pending = r2(ft.filter(t => t.status === 'PENDING' && t.type === 'EXPENSE').reduce((s, t) => s + (Number(t.amount) || 0), 0));
      return {
        id: f.id, name: f.name, custodian_name: f.custodian_name, opening_balance: r2(f.opening_balance),
        low_threshold: r2(f.low_threshold), is_active: f.is_active, balance, pending,
        needsReplenish: balance <= (Number(f.low_threshold) || 0),
      };
    });
  },

  async listTransactions(limit = 100): Promise<PettyTxn[]> {
    return safe<any[]>(supabase.from('petty_cash_transactions').select('*').order('created_at', { ascending: false }).limit(limit), []) as Promise<PettyTxn[]>;
  },

  async createFund(input: { name: string; custodian_name?: string; opening_balance?: number; low_threshold?: number }): Promise<void> {
    const { data: auth } = await supabase.auth.getUser();
    if (!input.name?.trim()) throw new Error('Fund name is required.');
    const { error } = await supabase.from('petty_cash_funds').insert({
      name: input.name.trim(), custodian_name: input.custodian_name?.trim() || null,
      opening_balance: Number(input.opening_balance) || 0, low_threshold: Number(input.low_threshold) || 0,
      is_active: true, created_by: auth?.user?.id ?? null,
    });
    if (error) throw new Error(error.message);
  },

  // Expense claims start PENDING; replenish/return post APPROVED (finance action).
  async createTransaction(input: {
    fund_id: string; type: PettyTxnType; amount: number; category?: string; description?: string;
    project_id?: string | null; txn_date?: string; receipt_document_id?: string | null;
  }): Promise<void> {
    const { data: auth } = await supabase.auth.getUser();
    if (!input.fund_id) throw new Error('Select a fund.');
    if (!(Number(input.amount) > 0)) throw new Error('Enter an amount greater than zero.');
    const { error } = await supabase.from('petty_cash_transactions').insert({
      fund_id: input.fund_id, type: input.type, amount: Number(input.amount),
      category: input.category || null, description: input.description || null,
      project_id: input.project_id || null, txn_date: input.txn_date || new Date().toISOString().slice(0, 10),
      status: input.type === 'EXPENSE' ? 'PENDING' : 'APPROVED',
      receipt_document_id: input.receipt_document_id || null, requested_by: auth?.user?.id ?? null,
      approved_by: input.type === 'EXPENSE' ? null : (auth?.user?.id ?? null),
    });
    if (error) throw new Error(error.message);
  },

  async setStatus(id: string, status: PettyTxnStatus): Promise<void> {
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from('petty_cash_transactions').update({ status, approved_by: auth?.user?.id ?? null }).eq('id', id);
  },
};

export default pettyCashService;
