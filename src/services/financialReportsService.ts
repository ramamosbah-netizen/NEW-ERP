// ============================================================
// JEET ERP — Finance: Financial Reports
// P&L, Trial Balance, General Ledger, Cost/Revenue by project.
// Reads existing finance tables + the accounting journal. Read-only;
// nothing existing is modified.
// ============================================================

import { supabase } from '@/lib/supabase';
import { accountingExportService } from './accountingExportService';

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const safe = async <T>(p: PromiseLike<{ data: T | null; error: unknown }>, fb: T): Promise<T> => {
  try { const { data } = await p; return data ?? fb; } catch { return fb; }
};

const AR_BOOKED = ['APPROVED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'];
const AP_BOOKED = ['REGISTERED', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'PARTIALLY_PAID', 'PAID'];

export interface PLRow { label: string; amount: number; group: 'REVENUE' | 'COST' | 'RESULT'; }
export interface TBRow { account_code: string; account_name: string; debit: number; credit: number; balance: number; }
export interface ProjectAmountRow { project_number: string; project_name: string; amount: number; }
export interface BSSection { name: string; rows: { account: string; amount: number }[]; total: number; }
export interface BalanceSheet { sections: BSSection[]; assetsTotal: number; liabEquityTotal: number; balanced: boolean; netIncome: number; }

// Standard chart-of-accounts classification by leading digit.
function classify(code: string): 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' {
  const c = (code || '')[0];
  if (c === '1') return 'ASSET';
  if (c === '2') return 'LIABILITY';
  if (c === '3') return 'EQUITY';
  if (c === '4') return 'REVENUE';
  return 'EXPENSE';
}

export const financialReportsService = {
  async profitAndLoss(start: string, end: string): Promise<{ rows: PLRow[]; netProfit: number }> {
    const ar = await safe<any[]>(supabase.from('client_invoices').select('taxable_amount, status, invoice_date').gte('invoice_date', start).lte('invoice_date', end).in('status', AR_BOOKED), []);
    const ap = await safe<any[]>(supabase.from('supplier_invoices').select('taxable_amount, status, invoice_date, cost_bucket, expense_category, project_id').gte('invoice_date', start).lte('invoice_date', end).in('status', AP_BOOKED), []);

    const revenue = r2(ar.reduce((s, i) => s + (Number(i.taxable_amount) || 0), 0));
    let direct = 0, workforce = 0, overhead = 0;
    for (const b of ap) {
      const amt = Number(b.taxable_amount) || 0;
      if (b.expense_category === 'WORKFORCE') workforce += amt;
      else if (b.cost_bucket === 'OFFICE' && !b.project_id) overhead += amt;
      else direct += amt;
    }
    direct = r2(direct); workforce = r2(workforce); overhead = r2(overhead);
    const totalCost = r2(direct + workforce + overhead);
    const grossProfit = r2(revenue - direct);
    const netProfit = r2(revenue - totalCost);
    const rows: PLRow[] = [
      { label: 'Revenue (client invoices)', amount: revenue, group: 'REVENUE' },
      { label: 'Direct project cost', amount: -direct, group: 'COST' },
      { label: 'Gross profit', amount: grossProfit, group: 'RESULT' },
      { label: 'Workforce / payroll', amount: -workforce, group: 'COST' },
      { label: 'Office / overhead', amount: -overhead, group: 'COST' },
      { label: 'Net profit', amount: netProfit, group: 'RESULT' },
    ];
    return { rows, netProfit };
  },

  async trialBalance(start: string, end: string): Promise<TBRow[]> {
    const lines = await accountingExportService.generateJournalLines(start, end).catch(() => [] as any[]);
    const map = new Map<string, TBRow>();
    for (const l of lines as any[]) {
      const key = l.account_code || l.account_name;
      const e = map.get(key) || { account_code: l.account_code || '', account_name: l.account_name || '', debit: 0, credit: 0, balance: 0 };
      e.debit += Number(l.debit) || 0; e.credit += Number(l.credit) || 0;
      map.set(key, e);
    }
    return Array.from(map.values()).map(e => ({ ...e, debit: r2(e.debit), credit: r2(e.credit), balance: r2(e.debit - e.credit) }))
      .sort((a, b) => a.account_code.localeCompare(b.account_code));
  },

  async generalLedger(start: string, end: string): Promise<any[]> {
    return accountingExportService.generateJournalLines(start, end).catch(() => []);
  },

  /** Balance Sheet as-of a date, derived from the posting journal (since inception). */
  async balanceSheet(asOf: string): Promise<BalanceSheet> {
    const lines = await accountingExportService.generateJournalLines('2000-01-01', asOf).catch(() => [] as any[]);
    const byAcct = new Map<string, { name: string; debit: number; credit: number }>();
    for (const l of lines as any[]) {
      const key = l.account_code || l.account_name;
      const e = byAcct.get(key) || { name: l.account_name || key, debit: 0, credit: 0 };
      e.debit += Number(l.debit) || 0; e.credit += Number(l.credit) || 0;
      byAcct.set(key, e);
    }

    const assets: { account: string; amount: number }[] = [];
    const liabilities: { account: string; amount: number }[] = [];
    const equity: { account: string; amount: number }[] = [];
    let revenueBal = 0, expenseBal = 0;
    for (const [code, e] of byAcct) {
      const net = r2(e.debit - e.credit);          // debit-positive
      switch (classify(code)) {
        case 'ASSET': if (Math.abs(net) > 0.01) assets.push({ account: e.name, amount: net }); break;
        case 'LIABILITY': if (Math.abs(net) > 0.01) liabilities.push({ account: e.name, amount: r2(-net) }); break;
        case 'EQUITY': if (Math.abs(net) > 0.01) equity.push({ account: e.name, amount: r2(-net) }); break;
        case 'REVENUE': revenueBal += -net; break;
        case 'EXPENSE': expenseBal += net; break;
      }
    }
    const netIncome = r2(revenueBal - expenseBal);
    equity.push({ account: 'Current-year earnings', amount: netIncome });

    const assetsTotal = r2(assets.reduce((s, r) => s + r.amount, 0));
    const liabTotal = r2(liabilities.reduce((s, r) => s + r.amount, 0));
    const equityTotal = r2(equity.reduce((s, r) => s + r.amount, 0));
    return {
      sections: [
        { name: 'Assets', rows: assets, total: assetsTotal },
        { name: 'Liabilities', rows: liabilities, total: liabTotal },
        { name: 'Equity', rows: equity, total: equityTotal },
      ],
      assetsTotal, liabEquityTotal: r2(liabTotal + equityTotal),
      balanced: Math.abs(assetsTotal - (liabTotal + equityTotal)) < 1, netIncome,
    };
  },

  async byProject(start: string, end: string, kind: 'COST' | 'REVENUE'): Promise<ProjectAmountRow[]> {
    const table = kind === 'REVENUE' ? 'client_invoices' : 'supplier_invoices';
    const statuses = kind === 'REVENUE' ? AR_BOOKED : AP_BOOKED;
    const rows = await safe<any[]>(supabase.from(table).select('taxable_amount, project_id, invoice_date, status').gte('invoice_date', start).lte('invoice_date', end).in('status', statuses), []);
    const byProj = new Map<string, number>();
    for (const r of rows) { const k = r.project_id || 'NONE'; byProj.set(k, (byProj.get(k) || 0) + (Number(r.taxable_amount) || 0)); }
    const ids = Array.from(byProj.keys()).filter(k => k !== 'NONE');
    const projects = ids.length ? await safe<any[]>(supabase.from('projects').select('id, project_number, name').in('id', ids), []) : [];
    const pm = new Map(projects.map((p: any) => [p.id, p]));
    return Array.from(byProj.entries()).map(([k, amount]) => ({
      project_number: k === 'NONE' ? 'Overhead / Unassigned' : (pm.get(k)?.project_number || k.slice(0, 8)),
      project_name: k === 'NONE' ? '' : (pm.get(k)?.name || ''), amount: r2(amount),
    })).sort((a, b) => b.amount - a.amount);
  },
};

export default financialReportsService;
