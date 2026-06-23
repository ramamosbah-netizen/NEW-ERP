// ============================================================
// JEET ERP — Projects: WBS service
// Hierarchical work packages with budget/weight and rolled-up
// progress (leaf progress → parent by weighted average).
// ============================================================

import { supabase } from '@/lib/supabase';
import { auditService } from './auditService';
import { emitEvent as emitIntelEvent } from '@/lib/events/emit-client';

export interface WbsNode {
  id: string;
  project_id: string;
  parent_id: string | null;
  code: string | null;
  name: string;
  system_name: string | null;
  budget_cost: number;
  weight_pct: number;
  progress_pct: number;        // own (leaf) or rolled-up (parent)
  planned_start: string | null;
  planned_end: string | null;
  sort_order: number;
  level: number;               // computed depth (0 = root)
  isLeaf: boolean;
  children?: WbsNode[];
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const safe = async <T>(p: PromiseLike<{ data: T | null; error: unknown }>, fb: T): Promise<T> => {
  try { const { data } = await p; return data ?? fb; } catch { return fb; }
};

export const wbsService = {
  /** Flat list ordered for display (depth-first), with computed level + rolled-up progress. */
  async listFlat(projectId: string): Promise<WbsNode[]> {
    const rows = await safe<any[]>(
      supabase.from('project_wbs').select('*').eq('project_id', projectId).order('sort_order'), []);
    const byParent = new Map<string | null, any[]>();
    for (const r of rows) {
      const k = r.parent_id || null;
      if (!byParent.has(k)) byParent.set(k, []);
      byParent.get(k)!.push(r);
    }
    const childrenOf = (id: string | null) => (byParent.get(id) || []).sort((a, b) => a.sort_order - b.sort_order);

    // Rolled-up progress: leaf = own progress; parent = weighted avg of children by budget (fallback equal)
    const rollupCache = new Map<string, number>();
    const rollup = (id: string): number => {
      if (rollupCache.has(id)) return rollupCache.get(id)!;
      const kids = childrenOf(id);
      const self = rows.find(r => r.id === id);
      let v: number;
      if (kids.length === 0) v = Number(self?.progress_pct) || 0;
      else {
        const totalBudget = kids.reduce((s, k) => s + (Number(k.budget_cost) || 0), 0);
        if (totalBudget > 0) v = kids.reduce((s, k) => s + rollup(k.id) * (Number(k.budget_cost) || 0), 0) / totalBudget;
        else v = kids.reduce((s, k) => s + rollup(k.id), 0) / kids.length;
      }
      rollupCache.set(id, r2(v));
      return r2(v);
    };

    const out: WbsNode[] = [];
    const walk = (parentId: string | null, level: number) => {
      for (const r of childrenOf(parentId)) {
        const kids = childrenOf(r.id);
        out.push({
          ...r, budget_cost: r2(r.budget_cost), weight_pct: r2(r.weight_pct),
          progress_pct: rollup(r.id), level, isLeaf: kids.length === 0,
        });
        walk(r.id, level + 1);
      }
    };
    walk(null, 0);
    return out;
  },

  async create(input: { project_id: string; parent_id?: string | null; name: string; code?: string; system_name?: string; budget_cost?: number; weight_pct?: number; progress_pct?: number; planned_start?: string | null; planned_end?: string | null }): Promise<string> {
    const { data: auth } = await supabase.auth.getUser();
    if (!input.name?.trim()) throw new Error('Name is required.');
    const { count } = await supabase.from('project_wbs').select('id', { count: 'exact', head: true })
      .eq('project_id', input.project_id).eq('parent_id', input.parent_id || null as any);
    const { data, error } = await supabase.from('project_wbs').insert({
      project_id: input.project_id, parent_id: input.parent_id || null, name: input.name.trim(),
      code: input.code || null, system_name: input.system_name || null,
      budget_cost: Number(input.budget_cost) || 0, weight_pct: Number(input.weight_pct) || 0,
      progress_pct: Number(input.progress_pct) || 0, planned_start: input.planned_start || null,
      planned_end: input.planned_end || null, sort_order: count || 0, created_by: auth?.user?.id ?? null,
    }).select('id').single();
    if (error) throw new Error(error.message);
    auditService.logEvent({ module: 'PROJECTS', action: 'CREATE', entity_type: 'WBS', entity_id: data.id, summary: `WBS item "${input.name}"` });
    return data.id;
  },

  async update(id: string, patch: Partial<{ name: string; code: string; system_name: string; budget_cost: number; weight_pct: number; progress_pct: number; planned_start: string | null; planned_end: string | null }>): Promise<void> {
    const clean: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const [k, v] of Object.entries(patch)) clean[k] = v;
    const { error } = await supabase.from('project_wbs').update(clean).eq('id', id);
    if (error) throw new Error(error.message);

    // ── Intelligence signal (Forecast fuel) ────────────────────────────────
    // When progress changes, emit the project's ROLLED-UP progress so the Forecast
    // engine (SCHEDULE_DELAY) can build a schedule trend over time. Emitted AFTER
    // the DB write, via the canonical server route. Non-fatal — a failed signal
    // must never block the WBS update.
    if (patch.progress_pct !== undefined) {
      try {
        const { data: node } = await supabase.from('project_wbs').select('project_id').eq('id', id).maybeSingle();
        const projectId = (node?.project_id as string | undefined) ?? undefined;
        if (projectId) {
          const roots = (await this.listFlat(projectId)).filter(n => n.level === 0);
          const totalBudget = roots.reduce((s, n) => s + (Number(n.budget_cost) || 0), 0);
          const projectProgress = roots.length === 0 ? 0
            : totalBudget > 0
              ? roots.reduce((s, n) => s + n.progress_pct * (Number(n.budget_cost) || 0), 0) / totalBudget
              : roots.reduce((s, n) => s + n.progress_pct, 0) / roots.length;
          const { data: proj } = await supabase.from('projects')
            .select('planned_end_date, name, project_number, company_id').eq('id', projectId).maybeSingle();
          await emitIntelEvent({
            eventType: 'project.progress_updated',
            entityType: 'PROJECT',
            entityId: projectId,
            projectId,
            payload: {
              progress: Math.round(projectProgress * 100) / 100,
              planned_end: proj?.planned_end_date ?? null,
              name: proj?.name,
              project_number: proj?.project_number,
            },
            requestedCompanyId: (proj?.company_id as string | null) ?? null,
          });
        }
      } catch { /* non-fatal: progress signal must never block the WBS update */ }
    }
  },

  async remove(id: string): Promise<void> {
    await supabase.from('project_wbs').delete().eq('id', id);
    auditService.logEvent({ module: 'PROJECTS', action: 'DELETE', entity_type: 'WBS', entity_id: id, summary: 'WBS item deleted' });
  },

  /** Seed top-level WBS nodes from the project's systems[] array. */
  async seedFromSystems(projectId: string): Promise<number> {
    const project = await safe<any>(supabase.from('projects').select('systems').eq('id', projectId).maybeSingle(), null);
    const systems: string[] = Array.isArray(project?.systems) ? project.systems : [];
    if (!systems.length) return 0;
    let i = 0;
    for (const sys of systems) {
      await this.create({ project_id: projectId, name: sys, code: String(i + 1), system_name: sys });
      i++;
    }
    return i;
  },
};

export default wbsService;
