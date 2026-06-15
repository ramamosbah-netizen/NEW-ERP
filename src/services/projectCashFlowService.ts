// ============================================================
// JEET ERP — Finance: Project Cash Flow
// Per-project monthly cash in (client receipts) vs cash out
// (supplier payments + paid expenses) and cumulative position.
// Read-only over existing tables; reuses projectFinancialsService
// for the headline KPIs. Nothing existing is modified.
// ============================================================

import { supabase } from '@/lib/supabase';
import { projectFinancialsService } from './projectFinancialsService';

export interface CashMonth { month: string; cashIn: number; cashOut: number; net: number; cumulative: number; }
export interface ProjectCashFlow {
  kpis: {
    contractValue: number; billed: number; collected: number; outstanding: number;
    actualCost: number; forecastCost: number; cashOut: number; netCashPosition: number; projectProfit: number;
  };
  monthly: CashMonth[];
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const safe = async <T>(p: PromiseLike<{ data: T | null; error: unknown }>, fb: T): Promise<T> => {
  try { const { data } = await p; return data ?? fb; } catch { return fb; }
};
const ym = (d?: string | null) => (d ? String(d).slice(0, 7) : '');

export const projectCashFlowService = {
  async getProjectCashFlow(projectId: string): Promise<ProjectCashFlow> {
    const fin = await projectFinancialsService.computeProjectFinancials(projectId).catch(() => null as any);

    // Cash IN — client payments allocated to this project's invoices
    const clientInvoices = await safe<any[]>(supabase.from('client_invoices').select('id').eq('project_id', projectId), []);
    const ciIds = clientInvoices.map(i => i.id);
    const inAllocs = ciIds.length ? await safe<any[]>(supabase.from('payment_allocations').select('allocated_amount, payment_id, invoice_id').in('invoice_id', ciIds), []) : [];
    const inPayIds = Array.from(new Set(inAllocs.map(a => a.payment_id)));
    const clientPays = inPayIds.length ? await safe<any[]>(supabase.from('client_payments').select('id, payment_date').in('id', inPayIds), []) : [];
    const cpDate = new Map(clientPays.map((p: any) => [p.id, p.payment_date]));

    // Cash OUT — supplier payments allocated to this project's bills + paid expenses
    const supInvoices = await safe<any[]>(supabase.from('supplier_invoices').select('id, amount_paid, invoice_date, payment_account_id').eq('project_id', projectId), []);
    const siIds = supInvoices.map(i => i.id);
    const outAllocs = siIds.length ? await safe<any[]>(supabase.from('supplier_payment_allocations').select('allocated_amount, payment_id, supplier_invoice_id').in('supplier_invoice_id', siIds), []) : [];
    const outPayIds = Array.from(new Set(outAllocs.map(a => a.payment_id)));
    const supPays = outPayIds.length ? await safe<any[]>(supabase.from('supplier_payments').select('id, payment_date').in('id', outPayIds), []) : [];
    const spDate = new Map(supPays.map((p: any) => [p.id, p.payment_date]));
    const allocatedBillIds = new Set(outAllocs.map(a => a.supplier_invoice_id));

    // Build monthly buckets
    const months = new Map<string, CashMonth>();
    const bump = (m: string, inAmt: number, outAmt: number) => {
      if (!m) return;
      const e = months.get(m) || { month: m, cashIn: 0, cashOut: 0, net: 0, cumulative: 0 };
      e.cashIn += inAmt; e.cashOut += outAmt; months.set(m, e);
    };
    for (const a of inAllocs) bump(ym(cpDate.get(a.payment_id)), Number(a.allocated_amount) || 0, 0);
    for (const a of outAllocs) bump(ym(spDate.get(a.payment_id)), 0, Number(a.allocated_amount) || 0);
    // quick-paid expenses (amount_paid on the bill, not via a formal supplier_payment)
    for (const si of supInvoices) {
      if (!allocatedBillIds.has(si.id) && si.payment_account_id && Number(si.amount_paid) > 0) {
        bump(ym(si.invoice_date), 0, Number(si.amount_paid) || 0);
      }
    }

    const ordered = Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month));
    let cum = 0;
    for (const m of ordered) { m.cashIn = r2(m.cashIn); m.cashOut = r2(m.cashOut); m.net = r2(m.cashIn - m.cashOut); cum = r2(cum + m.net); m.cumulative = cum; }

    const cashOutTotal = r2(ordered.reduce((s, m) => s + m.cashOut, 0));
    const collected = r2(fin?.revenueCollected || 0);
    const billed = r2(fin?.revenueBilled || 0);
    return {
      kpis: {
        contractValue: r2(fin?.contractValue || 0), billed, collected,
        outstanding: r2(billed - collected),
        actualCost: r2(fin?.actualCost || 0), forecastCost: r2(fin?.projectedCostAtCompletion || 0),
        cashOut: cashOutTotal, netCashPosition: r2(collected - cashOutTotal),
        projectProfit: r2(fin?.projectedMargin || 0),
      },
      monthly: ordered,
    };
  },
};

export default projectCashFlowService;
