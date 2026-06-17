// ============================================================
// Aura ERP — General Ledger service
// Reads statements from the POSTED double-entry ledger (journal_entries /
// journal_lines), and manages accounting periods. Replaces the on-the-fly
// derivation in financialReportsService for anything that needs to tie out.
// ============================================================

import { supabase } from '@/lib/supabase';

const n = (v: unknown): number => Number(v) || 0;

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export interface TrialBalanceRow {
  code: string;
  name: string;
  type: AccountType;
  normal_side: 'DEBIT' | 'CREDIT';
  debit: number;
  credit: number;
  balance: number;
}

export interface AccountingPeriod {
  code: string;
  name: string;
  start_date: string;
  end_date: string;
  status: 'OPEN' | 'CLOSED' | 'LOCKED';
  closed_at: string | null;
}

export interface DraftEntry {
  id: string;
  entry_no: string | null;
  entry_date: string;
  source_module: string | null;
  memo: string | null;
}

export interface ProfitAndLoss {
  revenue: number;
  expense: number;
  netProfit: number;
  byAccount: { code: string; name: string; type: AccountType; amount: number }[];
}

export interface BalanceSheet {
  assets: number;
  liabilities: number;
  equity: number;
  netIncome: number;
  balanced: boolean;
}

async function postedEntryIds(filter: (q: any) => any): Promise<string[]> {
  let q = supabase.from('journal_entries').select('id').eq('status', 'POSTED');
  q = filter(q);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((e: { id: string }) => e.id);
}

async function linesForEntries(ids: string[]): Promise<{ account_code: string; debit: number; credit: number }[]> {
  if (ids.length === 0) return [];
  // chunk to keep the IN list within URL limits
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 500) chunks.push(ids.slice(i, i + 500));
  const out: { account_code: string; debit: number; credit: number }[] = [];
  for (const c of chunks) {
    const { data, error } = await supabase
      .from('journal_lines')
      .select('account_code, debit, credit')
      .in('entry_id', c);
    if (error) throw error;
    for (const l of data || []) out.push({ account_code: l.account_code, debit: n(l.debit), credit: n(l.credit) });
  }
  return out;
}

async function accountTypeMap(): Promise<Map<string, { name: string; type: AccountType }>> {
  const { data, error } = await supabase.from('gl_accounts').select('code, name, type');
  if (error) throw error;
  return new Map((data || []).map((a: any) => [a.code, { name: a.name, type: a.type as AccountType }]));
}

export const glService = {
  /** Trial balance straight from the posted-ledger view. */
  async trialBalance(): Promise<TrialBalanceRow[]> {
    const { data, error } = await supabase.from('gl_trial_balance').select('*');
    if (error) throw error;
    return (data || []).map((r: any) => ({
      code: r.code, name: r.name, type: r.type, normal_side: r.normal_side,
      debit: n(r.debit), credit: n(r.credit), balance: n(r.balance),
    }));
  },

  async listPeriods(): Promise<AccountingPeriod[]> {
    const { data, error } = await supabase
      .from('accounting_periods')
      .select('code, name, start_date, end_date, status, closed_at')
      .order('code', { ascending: false });
    if (error) throw error;
    return (data || []) as AccountingPeriod[];
  },

  async closePeriod(code: string): Promise<void> {
    const { error } = await supabase.rpc('close_accounting_period', { p_code: code });
    if (error) throw error;
  },

  async reopenPeriod(code: string): Promise<void> {
    const { error } = await supabase.rpc('reopen_accounting_period', { p_code: code });
    if (error) throw error;
  },

  /** Entries that auto-posting could not commit — left DRAFT for finance review. */
  async draftEntries(): Promise<DraftEntry[]> {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('id, entry_no, entry_date, source_module, memo')
      .eq('status', 'DRAFT')
      .not('source_module', 'is', null)
      .order('entry_date', { ascending: false });
    if (error) throw error;
    return (data || []) as DraftEntry[];
  },

  /** P&L over a date range, from posted entries. */
  async profitAndLoss(start: string, end: string): Promise<ProfitAndLoss> {
    const ids = await postedEntryIds(q => q.gte('entry_date', start).lte('entry_date', end));
    const [lines, accts] = await Promise.all([linesForEntries(ids), accountTypeMap()]);

    const agg = new Map<string, number>();
    for (const l of lines) {
      const a = accts.get(l.account_code);
      if (!a) continue;
      if (a.type === 'REVENUE') agg.set(l.account_code, (agg.get(l.account_code) || 0) + (l.credit - l.debit));
      else if (a.type === 'EXPENSE') agg.set(l.account_code, (agg.get(l.account_code) || 0) + (l.debit - l.credit));
    }

    let revenue = 0;
    let expense = 0;
    const byAccount: ProfitAndLoss['byAccount'] = [];
    for (const [code, amount] of agg) {
      const a = accts.get(code)!;
      if (a.type === 'REVENUE') revenue += amount;
      else expense += amount;
      byAccount.push({ code, name: a.name, type: a.type, amount });
    }
    return { revenue, expense, netProfit: revenue - expense, byAccount };
  },

  /** Balance sheet as of a date, from posted entries. */
  async balanceSheet(asOf: string): Promise<BalanceSheet> {
    const ids = await postedEntryIds(q => q.lte('entry_date', asOf));
    const [lines, accts] = await Promise.all([linesForEntries(ids), accountTypeMap()]);

    let assets = 0;
    let liabilities = 0;
    let equity = 0;
    let revenue = 0;
    let expense = 0;
    for (const l of lines) {
      const a = accts.get(l.account_code);
      if (!a) continue;
      switch (a.type) {
        case 'ASSET': assets += l.debit - l.credit; break;
        case 'LIABILITY': liabilities += l.credit - l.debit; break;
        case 'EQUITY': equity += l.credit - l.debit; break;
        case 'REVENUE': revenue += l.credit - l.debit; break;
        case 'EXPENSE': expense += l.debit - l.credit; break;
      }
    }
    const netIncome = revenue - expense;
    const liabilitiesEquity = liabilities + equity + netIncome;
    return {
      assets,
      liabilities,
      equity,
      netIncome,
      balanced: Math.abs(assets - liabilitiesEquity) < 0.01,
    };
  },
};

export default glService;
