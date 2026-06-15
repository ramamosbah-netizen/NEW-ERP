// ============================================================
// JEET ERP — Finance: Budget & Cost Control service
// Project budgets seeded from the BOQ, revisioned and frozen on
// approval. Committed cost is read live from commitments (LPOs),
// actual cost from supplier bills; planned/forecast are stored.
// Does not modify any existing service or business logic.
// ============================================================

import { supabase } from '@/lib/supabase';
import { commitmentService } from './commitmentService';
import { auditService } from './auditService';

export type BudgetStatus = 'DRAFT' | 'APPROVED' | 'SUPERSEDED';

export interface BudgetLine {
  id: string;
  budget_id: string;
  cost_category: string;
  system_name: string | null;
  boq_item_id: string | null;
  planned_cost: number;
  committed_cost: number;
  actual_cost: number;
  forecast_cost: number;
  variance_amount: number;
  variance_percent: number;
}

export interface ProjectBudget {
  id: string;
  project_id: string;
  revision_no: number;
  status: BudgetStatus;
  approved_date: string | null;
  total_budget: number;
  contingency: number;
  notes: string | null;
  created_at: string;
}

export interface BudgetTotals {
  planned: number; committed: number; actual: number; forecast: number;
  variance: number; utilizationPct: number; contractValue: number; forecastProfit: number;
  overruns: number;
}

export interface BudgetSummary extends ProjectBudget {
  project_number: string; project_name: string; totals: BudgetTotals;
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const safe = async <T>(p: PromiseLike<{ data: T | null; error: unknown }>, fb: T): Promise<T> => {
  try { const { data } = await p; return data ?? fb; } catch { return fb; }
};

// Live committed (by system) + project actual, distributed proportionally to lines by planned cost.
async function enrich(projectId: string, contractValue: number, lines: BudgetLine[]): Promise<{ lines: BudgetLine[]; totals: BudgetTotals }> {
  const committedBySystem = new Map<string, number>();
  try {
    const sys = await commitmentService.getProjectCostCommitments(projectId);
    for (const s of sys) committedBySystem.set((s.systemName || s.system || 'OTHER'), (committedBySystem.get(s.systemName || s.system || 'OTHER') || 0) + (Number(s.committedCost) || 0));
  } catch { /* commitments optional */ }

  const bills = await safe<any[]>(
    supabase.from('supplier_invoices').select('total').eq('project_id', projectId), []);
  const totalActual = bills.reduce((s, b) => s + (Number(b.total) || 0), 0);

  const plannedTotal = lines.reduce((s, l) => s + l.planned_cost, 0) || 1;
  const plannedBySystem = new Map<string, number>();
  for (const l of lines) plannedBySystem.set(l.system_name || 'General', (plannedBySystem.get(l.system_name || 'General') || 0) + l.planned_cost);

  const enriched = lines.map(l => {
    const sysKey = l.system_name || 'General';
    const sysPlanned = plannedBySystem.get(sysKey) || 0;
    const sysCommitted = committedBySystem.get(sysKey) || 0;
    const committed = sysPlanned > 0 ? r2(sysCommitted * (l.planned_cost / sysPlanned)) : 0;
    const actual = r2(totalActual * (l.planned_cost / plannedTotal));
    const forecast = r2(Math.max(l.planned_cost, committed, actual));
    const variance = r2(l.planned_cost - forecast);
    return { ...l, committed_cost: committed, actual_cost: actual, forecast_cost: forecast,
      variance_amount: variance, variance_percent: l.planned_cost ? r2(variance / l.planned_cost * 100) : 0 };
  });

  const planned = r2(enriched.reduce((s, l) => s + l.planned_cost, 0));
  const committed = r2(enriched.reduce((s, l) => s + l.committed_cost, 0));
  const forecast = r2(enriched.reduce((s, l) => s + l.forecast_cost, 0));
  const totals: BudgetTotals = {
    planned, committed, actual: r2(totalActual), forecast,
    variance: r2(planned - forecast),
    utilizationPct: planned ? r2(committed / planned * 100) : 0,
    contractValue: r2(contractValue),
    forecastProfit: r2(contractValue - forecast),
    overruns: enriched.filter(l => l.committed_cost > l.planned_cost + 0.01).length,
  };
  return { lines: enriched, totals };
}

export const budgetService = {
  /** Seed a new DRAFT budget revision from the project's BOQ. */
  async createFromBoq(projectId: string): Promise<string> {
    const { data: auth } = await supabase.auth.getUser();
    const project = await safe<any>(supabase.from('projects').select('tender_id, contract_value').eq('id', projectId).maybeSingle(), null);
    if (!project) throw new Error('Project not found');

    let items: any[] = [];
    if (project.tender_id) {
      const boq = await safe<any>(supabase.from('boqs').select('items').eq('tender_id', project.tender_id).maybeSingle(), null);
      items = Array.isArray(boq?.items) ? boq.items : [];
    }

    const { data: prev } = await supabase.from('project_budgets')
      .select('revision_no').eq('project_id', projectId).order('revision_no', { ascending: false }).limit(1);
    const revision_no = (prev && prev[0]?.revision_no ? prev[0].revision_no : 0) + 1;

    const lines = items.map((it: any) => {
      const qty = Number(it.quantity) || 0;
      const planned = r2(Number(it.material_total_cost) || (Number(it.material_unit_cost || it.net_purchase_cost_per_unit || 0) * qty) || 0);
      return { cost_category: 'MATERIAL', system_name: it.system || it.category || 'General', boq_item_id: it.id ? String(it.id) : null, planned_cost: planned };
    });
    const total = r2(lines.reduce((s, l) => s + l.planned_cost, 0));

    const { data: budget, error } = await supabase.from('project_budgets').insert({
      project_id: projectId, revision_no, status: 'DRAFT', total_budget: total, contingency: 0,
      notes: revision_no === 1 ? 'Imported from BOQ.' : `Revision ${revision_no} from BOQ.`, created_by: auth?.user?.id ?? null,
    }).select('id').single();
    if (error) throw new Error(error.message);

    if (lines.length) {
      const { error: lerr } = await supabase.from('project_budget_lines')
        .insert(lines.map(l => ({ ...l, budget_id: budget.id })));
      if (lerr) throw new Error(lerr.message);
    }
    auditService.logEvent({ module: 'FINANCE', action: 'CREATE', entity_type: 'PROJECT_BUDGET', entity_id: budget.id, summary: `Created budget revision ${revision_no} from BOQ (${total} AED)` });
    return budget.id;
  },

  async list(): Promise<BudgetSummary[]> {
    const budgets = await safe<any[]>(supabase.from('project_budgets').select('*').order('created_at', { ascending: false }), []);
    if (!budgets.length) return [];
    const projIds = Array.from(new Set(budgets.map(b => b.project_id)));
    const projects = await safe<any[]>(supabase.from('projects').select('id, project_number, name, contract_value').in('id', projIds), []);
    const projMap = new Map(projects.map((p: any) => [p.id, p]));

    const out: BudgetSummary[] = [];
    for (const b of budgets) {
      const proj = projMap.get(b.project_id) || {};
      const lines = await safe<any[]>(supabase.from('project_budget_lines').select('*').eq('budget_id', b.id), []);
      const { totals } = await enrich(b.project_id, Number(proj.contract_value) || 0, lines as BudgetLine[]);
      out.push({ ...b, project_number: proj.project_number || '—', project_name: proj.name || '', totals });
    }
    return out;
  },

  async get(id: string): Promise<{ budget: ProjectBudget; project: any; lines: BudgetLine[]; totals: BudgetTotals } | null> {
    const budget = await safe<any>(supabase.from('project_budgets').select('*').eq('id', id).maybeSingle(), null);
    if (!budget) return null;
    const project = await safe<any>(supabase.from('projects').select('id, project_number, name, contract_value, original_contract_value').eq('id', budget.project_id).maybeSingle(), {});
    const rawLines = await safe<any[]>(supabase.from('project_budget_lines').select('*').eq('budget_id', id).order('system_name'), []);
    const { lines, totals } = await enrich(budget.project_id, Number(project?.contract_value) || 0, rawLines as BudgetLine[]);
    return { budget, project, lines, totals };
  },

  /** Freeze a budget: APPROVED + supersede the previously approved revision. */
  async approve(id: string): Promise<void> {
    const { data: auth } = await supabase.auth.getUser();
    const b = await safe<any>(supabase.from('project_budgets').select('project_id').eq('id', id).maybeSingle(), null);
    if (!b) throw new Error('Budget not found');
    await supabase.from('project_budgets').update({ status: 'SUPERSEDED' })
      .eq('project_id', b.project_id).eq('status', 'APPROVED');
    const { error } = await supabase.from('project_budgets')
      .update({ status: 'APPROVED', approved_date: new Date().toISOString().slice(0, 10), approved_by: auth?.user?.id ?? null, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
    auditService.logEvent({ module: 'FINANCE', action: 'APPROVE', entity_type: 'PROJECT_BUDGET', entity_id: id, summary: 'Approved & froze project budget' });
  },
};

export default budgetService;
