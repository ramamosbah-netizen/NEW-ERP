// ============================================================
// JEET ERP — Projects: Daily Site Report (DSR) service
// ============================================================

import { supabase } from '@/lib/supabase';
import { auditService } from './auditService';

export interface ManpowerLine { trade: string; count: number; }
export interface DailySiteReport {
  id: string;
  project_id: string;
  project_number?: string;
  project_name?: string;
  report_date: string;
  weather: string | null;
  temperature_c: number | null;
  manpower: ManpowerLine[];
  total_manpower: number;
  work_done: string | null;
  materials_received: string | null;
  equipment_on_site: string | null;
  delays_issues: string | null;
  safety_notes: string | null;
  visitors: string | null;
  photo_document_ids: string[];
  status: 'DRAFT' | 'SUBMITTED';
  prepared_by_name: string | null;
  created_at: string;
}

export interface DSRInput {
  project_id: string;
  report_date: string;
  weather?: string | null;
  temperature_c?: number | null;
  manpower?: ManpowerLine[];
  work_done?: string | null;
  materials_received?: string | null;
  equipment_on_site?: string | null;
  delays_issues?: string | null;
  safety_notes?: string | null;
  visitors?: string | null;
  photo_document_ids?: string[];
  prepared_by_name?: string | null;
  status?: 'DRAFT' | 'SUBMITTED';
}

const safe = async <T>(p: PromiseLike<{ data: T | null; error: unknown }>, fb: T): Promise<T> => {
  try { const { data } = await p; return data ?? fb; } catch { return fb; }
};

async function withProjects(rows: any[]): Promise<DailySiteReport[]> {
  const ids = Array.from(new Set(rows.map(r => r.project_id).filter(Boolean)));
  const projects = ids.length ? await safe<any[]>(supabase.from('projects').select('id, project_number, name').in('id', ids), []) : [];
  const pm = new Map(projects.map((p: any) => [p.id, p]));
  return rows.map(r => ({
    ...r,
    manpower: Array.isArray(r.manpower) ? r.manpower : [],
    photo_document_ids: r.photo_document_ids || [],
    project_number: pm.get(r.project_id)?.project_number || '—',
    project_name: pm.get(r.project_id)?.name || '',
  })) as DailySiteReport[];
}

export const dailySiteReportService = {
  async list(filters: { projectId?: string } = {}): Promise<DailySiteReport[]> {
    let q = supabase.from('daily_site_reports').select('*').order('report_date', { ascending: false }).limit(300);
    if (filters.projectId) q = q.eq('project_id', filters.projectId);
    const rows = await safe<any[]>(q, []);
    return withProjects(rows);
  },

  async get(id: string): Promise<DailySiteReport | null> {
    const row = await safe<any>(supabase.from('daily_site_reports').select('*').eq('id', id).maybeSingle(), null);
    if (!row) return null;
    return (await withProjects([row]))[0];
  },

  async create(input: DSRInput): Promise<string> {
    const { data: auth } = await supabase.auth.getUser();
    if (!input.project_id) throw new Error('Select a project.');
    const manpower = (input.manpower || []).filter(m => m.trade?.trim() && Number(m.count) > 0);
    const total = manpower.reduce((s, m) => s + (Number(m.count) || 0), 0);
    const { data, error } = await supabase.from('daily_site_reports').insert({
      project_id: input.project_id, report_date: input.report_date,
      weather: input.weather || null, temperature_c: input.temperature_c ?? null,
      manpower, total_manpower: total,
      work_done: input.work_done || null, materials_received: input.materials_received || null,
      equipment_on_site: input.equipment_on_site || null, delays_issues: input.delays_issues || null,
      safety_notes: input.safety_notes || null, visitors: input.visitors || null,
      photo_document_ids: input.photo_document_ids || [],
      status: input.status || 'DRAFT', prepared_by_name: input.prepared_by_name || null,
      created_by: auth?.user?.id ?? null,
    }).select('id').single();
    if (error) throw new Error(error.message);
    auditService.logEvent({ module: 'PROJECTS', action: 'CREATE', entity_type: 'DAILY_SITE_REPORT', entity_id: data.id, summary: `Daily site report ${input.report_date} (${total} manpower)` });
    return data.id;
  },

  async setStatus(id: string, status: 'DRAFT' | 'SUBMITTED'): Promise<void> {
    await supabase.from('daily_site_reports').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    auditService.logEvent({ module: 'PROJECTS', action: status === 'SUBMITTED' ? 'SUBMIT' : 'UPDATE', entity_type: 'DAILY_SITE_REPORT', entity_id: id, summary: `Daily site report ${status.toLowerCase()}` });
  },
};

export default dailySiteReportService;
