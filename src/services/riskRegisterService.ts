// ============================================================
// JEET ERP — Projects: Risk Register service
// CRUD over project_risks + 5x5 matrix scoring. Audit-logged.
// ============================================================

import { supabase } from '@/lib/supabase';
import { auditService } from './auditService';

export type RiskCategory = 'TECHNICAL' | 'COMMERCIAL' | 'SCHEDULE' | 'SAFETY' | 'EXTERNAL' | 'RESOURCE';
export type RiskStatus = 'OPEN' | 'MITIGATING' | 'CLOSED';

export interface ProjectRisk {
  id: string;
  project_id: string;
  project_label?: string;
  ref_code: string | null;
  title: string;
  description: string | null;
  category: RiskCategory;
  likelihood: number;
  impact: number;
  mitigation: string | null;
  owner_name: string | null;
  status: RiskStatus;
  due_date: string | null;
  created_by_name: string | null;
  created_at: string;
  // computed
  score: number;
  rating: 'Low' | 'Medium' | 'High' | 'Critical';
}

export function ratingFor(score: number): ProjectRisk['rating'] {
  if (score >= 20) return 'Critical';
  if (score >= 12) return 'High';
  if (score >= 6) return 'Medium';
  return 'Low';
}

function decorate(row: any): ProjectRisk {
  const score = Number(row.likelihood || 0) * Number(row.impact || 0);
  return { ...row, likelihood: Number(row.likelihood || 0), impact: Number(row.impact || 0), score, rating: ratingFor(score) };
}

async function projectLabels(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const { data } = await supabase.from('projects').select('id, project_number, name').in('id', ids);
  (data || []).forEach((p: any) => map.set(p.id, `${p.project_number} — ${p.name}`));
  return map;
}

export const riskRegisterService = {
  async list(opts?: { projectId?: string }): Promise<ProjectRisk[]> {
    let q = supabase.from('project_risks').select('*').order('created_at', { ascending: false });
    if (opts?.projectId) q = q.eq('project_id', opts.projectId);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data || []).map(decorate).sort((a, b) => b.score - a.score);
    const labels = await projectLabels([...new Set(rows.map(r => r.project_id))]);
    rows.forEach(r => { r.project_label = labels.get(r.project_id); });
    return rows;
  },

  async nextRefCode(projectId: string): Promise<string> {
    const { count } = await supabase.from('project_risks').select('id', { count: 'exact', head: true }).eq('project_id', projectId);
    return `RISK-${String((count || 0) + 1).padStart(3, '0')}`;
  },

  async create(input: Partial<ProjectRisk> & { project_id: string; title: string }): Promise<ProjectRisk> {
    const ref = input.ref_code || (await this.nextRefCode(input.project_id));
    const payload = {
      project_id: input.project_id,
      ref_code: ref,
      title: input.title,
      description: input.description || null,
      category: input.category || 'TECHNICAL',
      likelihood: input.likelihood ?? 3,
      impact: input.impact ?? 3,
      mitigation: input.mitigation || null,
      owner_name: input.owner_name || null,
      status: input.status || 'OPEN',
      due_date: input.due_date || null,
      created_by_name: input.created_by_name || null,
    };
    const { data, error } = await supabase.from('project_risks').insert(payload).select('*').single();
    if (error) throw error;
    auditService.logEvent({ module: 'Projects', action: 'CREATE', entity_type: 'project_risk', entity_id: data.id, summary: `Risk ${ref}: ${payload.title}` });
    return decorate(data);
  },

  async update(id: string, patch: Partial<ProjectRisk>): Promise<void> {
    const allowed: any = {};
    for (const k of ['ref_code', 'title', 'description', 'category', 'likelihood', 'impact', 'mitigation', 'owner_name', 'status', 'due_date'])
      if (k in patch) allowed[k] = (patch as any)[k];
    allowed.updated_at = new Date().toISOString();
    const { error } = await supabase.from('project_risks').update(allowed).eq('id', id);
    if (error) throw error;
    auditService.logEvent({ module: 'Projects', action: 'UPDATE', entity_type: 'project_risk', entity_id: id, summary: 'Updated risk' });
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('project_risks').delete().eq('id', id);
    if (error) throw error;
    auditService.logEvent({ module: 'Projects', action: 'DELETE', entity_type: 'project_risk', entity_id: id, summary: 'Removed risk' });
  },
};

export default riskRegisterService;
