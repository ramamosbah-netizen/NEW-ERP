// ============================================================
// JEET ERP — Payment Accounts / Cards
// Cards, bank accounts and cash/petty-cash floats that pay for
// expenses. Balance = opening balance − everything paid from it.
// ============================================================

import { supabase } from '@/lib/supabase';

export type AccountType = 'BANK' | 'CARD' | 'CASH' | 'PETTY_CASH';

export interface PaymentAccount {
  id: string;
  name: string;
  type: AccountType;
  account_ref: string | null;
  opening_balance: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export interface PaymentAccountWithBalance extends PaymentAccount {
  paid_out: number;     // total disbursed from this account
  balance: number;      // opening − paid_out
}

const safe = async <T>(p: PromiseLike<{ data: T | null; error: unknown }>, fb: T): Promise<T> => {
  try { const { data } = await p; return data ?? fb; } catch { return fb; }
};

export const paymentAccountService = {
  async list(): Promise<PaymentAccountWithBalance[]> {
    const accounts = await safe<any[]>(
      supabase.from('payment_accounts').select('*').order('created_at'),
      []
    );
    if (accounts.length === 0) return [];

    // Sum disbursements per account from BOTH formal supplier payments and
    // quick-paid expenses (which record amount_paid + account on the bill).
    const [payments, paidExpenses] = await Promise.all([
      safe<any[]>(supabase.from('supplier_payments').select('payment_account_id, amount'), []),
      safe<any[]>(supabase.from('supplier_invoices').select('payment_account_id, amount_paid').not('payment_account_id', 'is', null), []),
    ]);
    const paidByAccount = new Map<string, number>();
    const add = (acct: string | null, amt: number) => {
      if (!acct) return;
      paidByAccount.set(acct, (paidByAccount.get(acct) || 0) + (Number(amt) || 0));
    };
    for (const p of payments) add(p.payment_account_id, p.amount);
    for (const e of paidExpenses) add(e.payment_account_id, e.amount_paid);

    return accounts.map((a: any) => {
      const paidOut = Math.round((paidByAccount.get(a.id) || 0) * 100) / 100;
      const opening = Number(a.opening_balance) || 0;
      return {
        ...a,
        opening_balance: opening,
        paid_out: paidOut,
        balance: Math.round((opening - paidOut) * 100) / 100,
      } as PaymentAccountWithBalance;
    });
  },

  async create(input: { name: string; type: AccountType; account_ref?: string | null; opening_balance?: number; notes?: string | null }): Promise<void> {
    const { error } = await supabase.from('payment_accounts').insert({
      name: input.name.trim(),
      type: input.type,
      account_ref: input.account_ref?.trim() || null,
      opening_balance: Number(input.opening_balance) || 0,
      notes: input.notes?.trim() || null,
      is_active: true,
    });
    if (error) throw new Error(error.message);
  },

  async setActive(id: string, isActive: boolean): Promise<void> {
    await supabase.from('payment_accounts').update({ is_active: isActive }).eq('id', id);
  },
};

export default paymentAccountService;
