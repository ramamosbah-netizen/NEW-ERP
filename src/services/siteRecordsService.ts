// ============================================================
// JEET ERP — Projects: RFI / SI / NCR register service
// One table, doc_type discriminator, per-type running ref.
// Audit-logged; separate-lookup pattern.
// ============================================================

import { supabase } from '@/lib/supabase';
import { auditService } from './auditService';

export type SiteDocType = 'RFI' | 'SI' | 'NCR';
export type SitePriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type SiteStatus = 'OPEN' | 'IN_PROGRESS' | 'ANSWERED' | 'CLOSED' | 'VOID';

export interface SiteRecord {
  id: string;
  project_id: string;
  project_label?: string;
  doc_type: SiteDocType;
  ref_code: string | null;
  title: string;
  description: string | null;
  discipline: string | null;
  raised_by_name: string | null;
  directed_to: string | null;
  date_raised: string | null;
  date_required: string | null;
  priority: SitePriority;
  status: SiteStatus;
  response: string | null;
  response_date: string | null;
  cost_impact: number;
  time_impact_days: number;
  document_ids: string[];
  created_by_name: string | null;
  created_at: string;
  // computed
  overdue: boolean;
}

const OPEN_STATES: SiteStatus[] = ['OPEN', 'IN_PROGRESS'];

function decorate(row: any): SiteRecord {
  const overdue = !!row.date_required && OPEN_STATES.includes(row.status) && new Date(row.date_required).getTime() < Date.now();
  return { ...row, cost_impact: Number(row.cost_impact || 0), time_impact_days: Number(row.time_impact_days || 0), document_ids: row.document_ids || [], overdue };
}

async function projectLabels(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const { data } = await supabase.from('projects').select('id, project_number, name').in('id', ids);
  (data || []).forEach((p: any) => map.set(p.id, `${p.project_number} — ${p.name}`));
  return map;
}

export const siteRecordsService = {
  async list(opts?: { projectId?: string; docType?: SiteDocType }): Promise<SiteRecord[]> {
    let q = supabase.from('project_site_records').select('*').order('created_at', { ascending: false });
    if (opts?.projectId) q = q.eq('project_id', opts.projectId);
    if (opts?.docType) q = q.eq('doc_type', opts.docType);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data || []).map(decorate);
    const labels = await projectLabels([...new Set(rows.map(r => r.project_id))]);
    rows.forEach(r => { r.project_label = labels.get(r.project_id); });
    return rows;
  },

  async nextRef(projectId: string, docType: SiteDocType): Promise<string> {
    const { count } = await supabase.from('project_site_records').select('id', { count: 'exact', head: true }).eq('project_id', projectId).eq('doc_type', docType);
    return `${docType}-${String((count || 0) + 1).padStart(3, '0')}`;
  },

  async create(input: Partial<SiteRecord> & { project_id: string; doc_type: SiteDocType; title: string }): Promise<SiteRecord> {
    const ref = input.ref_code || (await this.nextRef(input.project_id, input.doc_type));
    const payload = {
      project_id: input.project_id, doc_type: input.doc_type, ref_code: ref,
      title: input.title, description: input.description || null, discipline: input.discipline || null,
      raised_by_name: input.raised_by_name || null, directed_to: input.directed_to || null,
      date_raised: input.date_raised || new Date().toISOString().slice(0, 10), date_required: input.date_required || null,
      priority: input.priority || 'MEDIUM', status: input.status || 'OPEN',
      response: input.response || null, response_date: input.response_date || null,
      cost_impact: input.cost_impact ?? 0, time_impact_days: input.time_impact_days ?? 0,
      document_ids: input.document_ids || [], created_by_name: input.created_by_name || null,
    };
    const { data, error } = await supabase.from('project_site_records').insert(payload).select('*').single();
    if (error) throw error;
    auditService.logEvent({ module: 'Projects', action: 'CREATE', entity_type: 'site_record', entity_id: data.id, summary: `${input.doc_type} ${ref}: ${payload.title}` });
    return decorate(data);
  },

  async update(id: string, patch: Partial<SiteRecord>): Promise<void> {
    const allowed: any = {};
    for (const k of ['doc_type', 'ref_code', 'title', 'description', 'discipline', 'raised_by_name', 'directed_to', 'date_raised', 'date_required', 'priority', 'status', 'response', 'response_date', 'cost_impact', 'time_impact_days', 'document_ids'])
      if (k in patch) allowed[k] = (patch as any)[k];
    if (patch.response && !('response_date' in patch)) allowed.response_date = new Date().toISOString().slice(0, 10);
    allowed.updated_at = new Date().toISOString();
    const { error } = await supabase.from('project_site_records').update(allowed).eq('id', id);
    if (error) throw error;
    auditService.logEvent({ module: 'Projects', action: 'UPDATE', entity_type: 'site_record', entity_id: id, summary: 'Updated site record' });
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('project_site_records').delete().eq('id', id);
    if (error) throw error;
    auditService.logEvent({ module: 'Projects', action: 'DELETE', entity_type: 'site_record', entity_id: id, summary: 'Removed site record' });
  },
};

export default siteRecordsService;
