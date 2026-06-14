// ============================================================
// JEET ERP — Finance: Executive Dashboard aggregator
// Pulls headline cash/AR/AP/commitment/profit numbers, chart series
// and risk alerts from existing services and tables. Read-only.
// ============================================================

import { supabase } from '@/lib/supabase';
import paymentAccountService from './paymentAccountService';
import commitmentLedgerService from './commitmentLedgerService';
import cashFlowService from './cashFlowService';
import financialReportsService from './financialReportsService';

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const safe = async <T>(p: PromiseLike<{ data: T | null; error: unknown }>, fb: T): Promise<T> => {
  try { const { data } = await p; return data ?? fb; } catch { return fb; }
};
const ym = (d?: string | null) => (d ? String(d).slice(0, 7) : '');
const AR_BOOKED = ['APPROVED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'];
const AP_BOOKED = ['REGISTERED', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'PARTIALLY_PAID', 'PAID'];

export interface ExecAlert { level: 'danger' | 'warning'; title: string; detail: string; }
export interface AgingBucket { bucket: string; amount: number; }
export interface ExecDashboard {
  kpis: {
    currentCash: number; availableCash: number; expectedCollections: number; expectedPayments: number;
    forecastCash: number; workingCapital: number; netProfit: number; totalCommitments: number; projectsAtRisk: number;
  };
  arAging: AgingBucket[];
  apAging: AgingBucket[];
  revenueTrend: { month: string; revenue: number }[];
  cashTrend: { week: string; balance: number }[];
  topProjects: { project_number: string; margin: number }[];
  alerts: ExecAlert[];
}

function agingBuckets(rows: { outstanding: number; due: string | null }[]): AgingBucket[] {
  const today = new Date();
  const b = { Current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 } as Record<string, number>;
  for (const r of rows) {
    if (r.outstanding <= 0.01) continue;
    const days = r.due ? Math.floor((today.getTime() - new Date(r.due).getTime()) / 86400000) : 0;
    const k = days <= 0 ? 'Current' : days <= 30 ? '1-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+';
    b[k] += r.outstanding;
  }
  return Object.entries(b).map(([bucket, amount]) => ({ bucket, amount: r2(amount) }));
}

export const executiveFinanceService = {
  async getDashboard(): Promise<ExecDashboard> {
    const today = new Date().toISOString().slice(0, 10);
    const yearStart = `${new Date().getFullYear()}-01-01`;

    const [accounts, ar, ap, commitments, pl] = await Promise.all([
      paymentAccountService.list().catch(() => []),
      safe<any[]>(supabase.from('client_invoices').select('net_due, total_incl_vat, amount_paid, due_date, invoice_date, taxable_amount, status').in('status', AR_BOOKED), []),
      safe<any[]>(supabase.from('supplier_invoices').select('total, amount_paid, due_date, status, project_id').in('status', AP_BOOKED), []),
      commitmentLedgerService.list().catch(() => []),
      financialReportsService.profitAndLoss(yearStart, today).catch(() => ({ netProfit: 0 } as any)),
    ]);

    const currentCash = r2(accounts.reduce((s, a) => s + (a.balance || 0), 0));
    const arOut = ar.map(i => ({ outstanding: r2((Number(i.total_incl_vat) || 0) - (Number(i.amount_paid) || 0)), due: i.due_date }));
    const apOut = ap.map(i => ({ outstanding: r2((Number(i.total) || 0) - (Number(i.amount_paid) || 0)), due: i.due_date }));
    const expectedCollections = r2(arOut.reduce((s, i) => s + Math.max(0, i.outstanding), 0));
    const expectedPayments = r2(apOut.reduce((s, i) => s + Math.max(0, i.outstanding), 0));
    const totalCommitments = r2(commitments.reduce((s: number, c: any) => s + (c.amount || 0), 0));

    // Cash trend (13-week forecast) from current cash
    let cashTrend: { week: string; balance: number }[] = [];
    let minForecast = currentCash;
    try {
      const fc = await cashFlowService.get13WeekForecast(currentCash);
      cashTrend = (fc || []).map((w: any, i: number) => ({
        week: w.startDate ? String(w.startDate).slice(5, 10) : `W${(w.weekIndex ?? i) + 1}`,
        balance: r2(w.cumulativeBalance ?? 0),
      }));
      for (const w of cashTrend) minForecast = Math.min(minForecast, w.balance);
    } catch { /* forecast optional */ }
    const forecastCash = cashTrend.length ? cashTrend[cashTrend.length - 1].balance : r2(currentCash + expectedCollections - expectedPayments);

    // Lightweight project risk (cost vs contract) without per-project heavy compute
    const projects = await safe<any[]>(supabase.from('projects').select('id, project_number, contract_value, status').not('status', 'in', '("CANCELLED")').limit(300), []);
    const projMap = new Map(projects.map((p: any) => [p.id, p]));
    const costByProj = new Map<string, number>();
    for (const b of ap) if (b.project_id) costByProj.set(b.project_id, (costByProj.get(b.project_id) || 0) + (Number(b.total) || 0));
    const pos = await safe<any[]>(supabase.from('purchase_orders').select('project_id, total, status').in('status', ['APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_DELIVERED', 'DELIVERED']), []);
    const committedByProj = new Map<string, number>();
    for (const p of pos) if (p.project_id) committedByProj.set(p.project_id, (committedByProj.get(p.project_id) || 0) + (Number(p.total) || 0));

    const projMargins: { project_number: string; margin: number }[] = [];
    let projectsAtRisk = 0;
    for (const p of projects) {
      const contract = Number(p.contract_value) || 0;
      if (contract <= 0) continue;
      const cost = Math.max(costByProj.get(p.id) || 0, committedByProj.get(p.id) || 0);
      const margin = r2(contract - cost);
      projMargins.push({ project_number: p.project_number, margin });
      if (margin < 0 || cost > contract * 0.9) projectsAtRisk++;
    }
    const topProjects = projMargins.sort((a, b) => a.margin - b.margin).slice(0, 8);

    // Revenue trend (last 6 months)
    const revByMonth = new Map<string, number>();
    for (const i of ar) revByMonth.set(ym(i.invoice_date), (revByMonth.get(ym(i.invoice_date)) || 0) + (Number(i.taxable_amount) || 0));
    const revenueTrend = Array.from(revByMonth.entries()).filter(([m]) => m).sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([month, revenue]) => ({ month, revenue: r2(revenue) }));

    // Alerts
    const overdueAR = r2(arOut.filter(i => i.due && i.due < today).reduce((s, i) => s + Math.max(0, i.outstanding), 0));
    const vendorExposure = new Map<string, number>();
    for (const c of commitments as any[]) vendorExposure.set(c.vendor_name, (vendorExposure.get(c.vendor_name) || 0) + (c.amount || 0));
    const topVendor = Array.from(vendorExposure.entries()).sort((a, b) => b[1] - a[1])[0];

    const alerts: ExecAlert[] = [];
    if (minForecast < 0) alerts.push({ level: 'danger', title: 'Negative cash forecast', detail: `Forecast cash dips to ${r2(minForecast)} AED within 13 weeks.` });
    if (projectsAtRisk > 0) alerts.push({ level: 'warning', title: 'Cost overrun / loss risk', detail: `${projectsAtRisk} project(s) with cost ≥ 90% of contract or negative margin.` });
    if (overdueAR > 0) alerts.push({ level: 'warning', title: 'Delayed collections', detail: `${r2(overdueAR)} AED of receivables are overdue.` });
    if (topVendor && totalCommitments > 0 && topVendor[1] > totalCommitments * 0.3) alerts.push({ level: 'warning', title: 'High vendor exposure', detail: `${topVendor[0]} is ${Math.round(topVendor[1] / totalCommitments * 100)}% of total commitments.` });
    const lossProjects = projMargins.filter(p => p.margin < 0).length;
    if (lossProjects > 0) alerts.push({ level: 'danger', title: 'Project loss risk', detail: `${lossProjects} project(s) forecast a negative margin.` });

    return {
      kpis: {
        currentCash, availableCash: currentCash, expectedCollections, expectedPayments, forecastCash,
        workingCapital: r2(currentCash + expectedCollections - expectedPayments),
        netProfit: r2(pl?.netProfit || 0), totalCommitments, projectsAtRisk,
      },
      arAging: agingBuckets(arOut), apAging: agingBuckets(apOut),
      revenueTrend, cashTrend, topProjects, alerts,
    };
  },
};

export default executiveFinanceService;
