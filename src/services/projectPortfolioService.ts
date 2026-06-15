// ============================================================
// JEET ERP — Projects: Portfolio / Executive Dashboard service
// Read-only, BATCHED aggregation across all projects (no per-project
// N queries): contract/billed/collected/committed + projected margin,
// WBS progress, and open-risk exposure. Separate-lookup pattern.
// ============================================================

import { supabase } from '@/lib/supabase';

export interface PortfolioRow {
  id: string;
  project_number: string;
  name: string;
  status: string;
  contractValue: number;
  revenueBilled: number;
  revenueCollected: number;
  committedCost: number;
  projectedMargin: number;     // contract - committed
  marginPct: number;
  progress: number;            // budget-weighted WBS leaf progress %
  openRisks: number;
  maxRiskScore: number;
  tcTotal: number;             // testing & commissioning packages
  tcDone: number;              // completed / client-approved packages
  tcReadiness: number;         // avg completion %
}

export interface PortfolioSummary {
  rows: PortfolioRow[];
  totals: {
    projects: number;
    contractValue: number;
    revenueBilled: number;
    revenueCollected: number;
    committedCost: number;
    projectedMargin: number;
    marginPct: number;
    openRisks: number;
    highRiskProjects: number;
    tcPackages: number;
    tcCompleted: number;
  };
  byStatus: { status: string; count: number; contractValue: number }[];
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const COMMITTED_PO = ['APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CLOSED'];
const BILLED_INV = ['APPROVED', 'SENT', 'PARTIALLY_PAID', 'PAID'];
// projects we don't count as live portfolio (kept configurable here)
const INACTIVE_STATUS = ['CANCELLED', 'LOST', 'ARCHIVED'];

export const projectPortfolioService = {
  async getPortfolio(): Promise<PortfolioSummary> {
    const [projectsRes, invRes, poRes, riskRes, wbsRes, tcRes] = await Promise.all([
      supabase.from('projects').select('id, project_number, name, status, contract_value, budget_cost').order('project_number', { ascending: false }),
      supabase.from('client_invoices').select('project_id, taxable_amount, amount_paid, status').in('status', BILLED_INV),
      supabase.from('purchase_orders').select('project_id, subtotal, status').in('status', COMMITTED_PO),
      supabase.from('project_risks').select('project_id, likelihood, impact, status').neq('status', 'CLOSED'),
      supabase.from('project_wbs').select('id, project_id, parent_id, budget_cost, progress_pct'),
      supabase.from('tc_packages').select('project_id, status, completion_pct, is_active'),
    ]);

    const projects = projectsRes.data || [];

    // ---- billed/collected per project ----
    const billed = new Map<string, number>(), collected = new Map<string, number>();
    (invRes.data || []).forEach((i: any) => {
      if (!i.project_id) return;
      billed.set(i.project_id, (billed.get(i.project_id) || 0) + Number(i.taxable_amount || 0));
      collected.set(i.project_id, (collected.get(i.project_id) || 0) + Number(i.amount_paid || 0));
    });

    // ---- committed cost per project ----
    const committed = new Map<string, number>();
    (poRes.data || []).forEach((p: any) => {
      if (!p.project_id) return;
      committed.set(p.project_id, (committed.get(p.project_id) || 0) + Number(p.subtotal || 0));
    });

    // ---- open risks per project ----
    const riskCount = new Map<string, number>(), riskMax = new Map<string, number>();
    (riskRes.data || []).forEach((r: any) => {
      if (!r.project_id) return;
      const score = Number(r.likelihood || 0) * Number(r.impact || 0);
      riskCount.set(r.project_id, (riskCount.get(r.project_id) || 0) + 1);
      riskMax.set(r.project_id, Math.max(riskMax.get(r.project_id) || 0, score));
    });

    // ---- WBS progress per project (budget-weighted leaf progress) ----
    const wbsByProject = new Map<string, any[]>();
    (wbsRes.data || []).forEach((n: any) => {
      if (!wbsByProject.has(n.project_id)) wbsByProject.set(n.project_id, []);
      wbsByProject.get(n.project_id)!.push(n);
    });
    // ---- T&C readiness per project ----
    const TC_DONE = ['COMPLETED', 'CLIENT_APPROVED'];
    const tcByProject = new Map<string, { total: number; done: number; pctSum: number }>();
    (tcRes.data || []).forEach((p: any) => {
      if (!p.project_id || p.is_active === false) return;
      if (!tcByProject.has(p.project_id)) tcByProject.set(p.project_id, { total: 0, done: 0, pctSum: 0 });
      const e = tcByProject.get(p.project_id)!;
      e.total++; e.pctSum += Number(p.completion_pct || 0);
      if (TC_DONE.includes(String(p.status || '').toUpperCase())) e.done++;
    });

    const progressOf = (projectId: string): number => {
      const nodes = wbsByProject.get(projectId);
      if (!nodes || !nodes.length) return 0;
      const parentIds = new Set(nodes.filter(n => n.parent_id).map(n => n.parent_id));
      const leaves = nodes.filter(n => !parentIds.has(n.id));
      const totalBudget = leaves.reduce((s, n) => s + Number(n.budget_cost || 0), 0);
      if (totalBudget > 0) return r2(leaves.reduce((s, n) => s + Number(n.progress_pct || 0) * Number(n.budget_cost || 0), 0) / totalBudget);
      return r2(leaves.reduce((s, n) => s + Number(n.progress_pct || 0), 0) / leaves.length);
    };

    const rows: PortfolioRow[] = projects
      .filter((p: any) => !INACTIVE_STATUS.includes(String(p.status || '').toUpperCase()))
      .map((p: any) => {
        const contractValue = Number(p.contract_value || 0);
        const committedCost = committed.get(p.id) || 0;
        const projectedMargin = contractValue - committedCost;
        const tc = tcByProject.get(p.id);
        return {
          id: p.id, project_number: p.project_number, name: p.name, status: p.status || 'ACTIVE',
          contractValue: r2(contractValue),
          revenueBilled: r2(billed.get(p.id) || 0),
          revenueCollected: r2(collected.get(p.id) || 0),
          committedCost: r2(committedCost),
          projectedMargin: r2(projectedMargin),
          marginPct: contractValue > 0 ? r2(projectedMargin / contractValue * 100) : 0,
          progress: progressOf(p.id),
          openRisks: riskCount.get(p.id) || 0,
          maxRiskScore: riskMax.get(p.id) || 0,
          tcTotal: tc?.total || 0,
          tcDone: tc?.done || 0,
          tcReadiness: tc && tc.total > 0 ? r2(tc.pctSum / tc.total) : 0,
        };
      });

    const sum = (f: (r: PortfolioRow) => number) => r2(rows.reduce((s, r) => s + f(r), 0));
    const contractValue = sum(r => r.contractValue);
    const projectedMargin = sum(r => r.projectedMargin);
    const byStatusMap = new Map<string, { count: number; contractValue: number }>();
    rows.forEach(r => {
      const k = r.status;
      if (!byStatusMap.has(k)) byStatusMap.set(k, { count: 0, contractValue: 0 });
      const e = byStatusMap.get(k)!; e.count++; e.contractValue += r.contractValue;
    });

    return {
      rows: rows.sort((a, b) => b.contractValue - a.contractValue),
      totals: {
        projects: rows.length,
        contractValue,
        revenueBilled: sum(r => r.revenueBilled),
        revenueCollected: sum(r => r.revenueCollected),
        committedCost: sum(r => r.committedCost),
        projectedMargin,
        marginPct: contractValue > 0 ? r2(projectedMargin / contractValue * 100) : 0,
        openRisks: rows.reduce((s, r) => s + r.openRisks, 0),
        highRiskProjects: rows.filter(r => r.maxRiskScore >= 12).length,
        tcPackages: rows.reduce((s, r) => s + r.tcTotal, 0),
        tcCompleted: rows.reduce((s, r) => s + r.tcDone, 0),
      },
      byStatus: [...byStatusMap.entries()].map(([status, v]) => ({ status, count: v.count, contractValue: r2(v.contractValue) })).sort((a, b) => b.contractValue - a.contractValue),
    };
  },
};

export default projectPortfolioService;
