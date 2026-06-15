// ============================================================
// JEET ERP — Projects: Resource / Manpower Planning service
// CRUD over project_resource_allocations + a cross-project
// utilization summary. Audit-logged; separate-lookup pattern.
// ============================================================

import { supabase } from '@/lib/supabase';
import { auditService } from './auditService';

export type ResourceType = 'MANPOWER' | 'EQUIPMENT' | 'SUBCONTRACTOR';
export type ResourceStatus = 'PLANNED' | 'ACTIVE' | 'RELEASED';

export interface ResourceAllocation {
  id: string;
  project_id: string;
  project_label?: string;
  resource_type: ResourceType;
  resource_name: string;
  trade: string | null;
  quantity: number;
  unit: string;
  start_date: string | null;
  end_date: string | null;
  daily_rate: number;
  status: ResourceStatus;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
  // computed
  days: number;
  planned_cost: number;
}

const DAY = 86400000;
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

function daysBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const d = Math.round((new Date(end).getTime() - new Date(start).getTime()) / DAY) + 1; // inclusive
  return d > 0 ? d : 0;
}

function decorate(row: any): ResourceAllocation {
  const days = daysBetween(row.start_date, row.end_date);
  return {
    ...row,
    quantity: Number(row.quantity || 0),
    daily_rate: Number(row.daily_rate || 0),
    days,
    planned_cost: r2(Number(row.quantity || 0) * Number(row.daily_rate || 0) * days),
  };
}

async function projectLabels(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const { data } = await supabase.from('projects').select('id, project_number, name').in('id', ids);
  (data || []).forEach((p: any) => map.set(p.id, `${p.project_number} — ${p.name}`));
  return map;
}

export const resourcePlanningService = {
  async list(opts?: { projectId?: string }): Promise<ResourceAllocation[]> {
    let q = supabase.from('project_resource_allocations').select('*').order('start_date', { ascending: true, nullsFirst: false });
    if (opts?.projectId) q = q.eq('project_id', opts.projectId);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data || []).map(decorate);
    const labels = await projectLabels([...new Set(rows.map(r => r.project_id))]);
    rows.forEach(r => { r.project_label = labels.get(r.project_id); });
    return rows;
  },

  async create(input: Partial<ResourceAllocation> & { project_id: string; resource_name: string }): Promise<ResourceAllocation> {
    const payload = {
      project_id: input.project_id,
      resource_type: input.resource_type || 'MANPOWER',
      resource_name: input.resource_name,
      trade: input.trade || null,
      quantity: input.quantity ?? 1,
      unit: input.unit || 'persons',
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      daily_rate: input.daily_rate ?? 0,
      status: input.status || 'PLANNED',
      notes: input.notes || null,
      created_by_name: input.created_by_name || null,
    };
    const { data, error } = await supabase.from('project_resource_allocations').insert(payload).select('*').single();
    if (error) throw error;
    auditService.logEvent({ module: 'Projects', action: 'CREATE', entity_type: 'resource_allocation', entity_id: data.id, summary: `Allocated ${payload.quantity} ${payload.unit} ${payload.resource_name}` });
    return decorate(data);
  },

  async update(id: string, patch: Partial<ResourceAllocation>): Promise<void> {
    const allowed: any = {};
    for (const k of ['resource_type', 'resource_name', 'trade', 'quantity', 'unit', 'start_date', 'end_date', 'daily_rate', 'status', 'notes'])
      if (k in patch) allowed[k] = (patch as any)[k];
    allowed.updated_at = new Date().toISOString();
    const { error } = await supabase.from('project_resource_allocations').update(allowed).eq('id', id);
    if (error) throw error;
    auditService.logEvent({ module: 'Projects', action: 'UPDATE', entity_type: 'resource_allocation', entity_id: id, summary: 'Updated allocation' });
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('project_resource_allocations').delete().eq('id', id);
    if (error) throw error;
    auditService.logEvent({ module: 'Projects', action: 'DELETE', entity_type: 'resource_allocation', entity_id: id, summary: 'Removed allocation' });
  },

  // Cross-project utilization for a given day (defaults to today): which
  // resources are committed where, and where the same resource is double-booked.
  async utilization(onDate?: string): Promise<{ resource_name: string; resource_type: ResourceType; total_qty: number; projects: number; overbooked: boolean }[]> {
    const day = onDate || new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('project_resource_allocations')
      .select('resource_name, resource_type, quantity, project_id, start_date, end_date, status')
      .neq('status', 'RELEASED');
    if (error) throw error;
    const active = (data || []).filter((r: any) => (!r.start_date || r.start_date <= day) && (!r.end_date || r.end_date >= day));
    const m = new Map<string, { resource_name: string; resource_type: ResourceType; total_qty: number; projects: Set<string> }>();
    active.forEach((r: any) => {
      const key = `${r.resource_type}::${r.resource_name}`;
      if (!m.has(key)) m.set(key, { resource_name: r.resource_name, resource_type: r.resource_type, total_qty: 0, projects: new Set() });
      const e = m.get(key)!;
      e.total_qty += Number(r.quantity || 0);
      e.projects.add(r.project_id);
    });
    return [...m.values()]
      .map(e => ({ resource_name: e.resource_name, resource_type: e.resource_type, total_qty: r2(e.total_qty), projects: e.projects.size, overbooked: e.projects.size > 1 }))
      .sort((a, b) => b.total_qty - a.total_qty);
  },
};

export default resourcePlanningService;
