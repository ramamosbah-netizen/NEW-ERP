// ============================================================
// JEET ERP — Projects: Earned Value Management (EVM)
// PV / EV / AC and SPI / CPI / EAC over the WBS + project actuals.
// Read-only; reuses wbsService + projectFinancialsService.
// ============================================================

import wbsService, { WbsNode } from './wbsService';
import { projectFinancialsService } from './projectFinancialsService';

export interface EvmLine { name: string; budget: number; plannedPct: number; progressPct: number; pv: number; ev: number; }
export interface EvmResult {
  bac: number; pv: number; ev: number; ac: number;
  spi: number; cpi: number; eac: number; vac: number; percentComplete: number;
  lines: EvmLine[];
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function plannedPctByDate(start: string | null, end: string | null, progressPct: number): number {
  if (!start || !end) return progressPct / 100; // unscheduled → assume on-plan (don't skew SPI)
  const s = new Date(start).getTime(), e = new Date(end).getTime(), now = Date.now();
  if (e <= s) return now >= e ? 1 : 0;
  return clamp01((now - s) / (e - s));
}

export const evmService = {
  async compute(projectId: string): Promise<EvmResult> {
    const nodes: WbsNode[] = await wbsService.listFlat(projectId).catch(() => []);
    const leaves = nodes.filter(n => n.isLeaf && n.budget_cost > 0);

    let pv = 0, ev = 0, bac = 0;
    const lines: EvmLine[] = leaves.map(n => {
      const budget = n.budget_cost;
      const planned = plannedPctByDate(n.planned_start, n.planned_end, n.progress_pct);
      const linePv = budget * planned;
      const lineEv = budget * (n.progress_pct / 100);
      pv += linePv; ev += lineEv; bac += budget;
      return { name: n.name, budget: r2(budget), plannedPct: r2(planned * 100), progressPct: r2(n.progress_pct), pv: r2(linePv), ev: r2(lineEv) };
    });

    const fin = await projectFinancialsService.computeProjectFinancials(projectId).catch(() => null as any);
    const ac = r2(fin?.actualCost || 0);
    // Fall back to project budget if WBS has no budget yet
    const bacFinal = bac > 0 ? bac : r2(fin?.budgetCost || 0);

    const spi = pv > 0 ? r2(ev / pv) : 0;
    const cpi = ac > 0 ? r2(ev / ac) : 0;
    const eac = cpi > 0 ? r2(bacFinal / cpi) : bacFinal;
    return {
      bac: r2(bacFinal), pv: r2(pv), ev: r2(ev), ac,
      spi, cpi, eac, vac: r2(bacFinal - eac),
      percentComplete: bacFinal > 0 ? r2(ev / bacFinal * 100) : 0,
      lines: lines.sort((a, b) => b.budget - a.budget),
    };
  },
};

export default evmService;
