// ============================================================
// JEET ERP — Projects: DLP & Warranty Tracking service
// Warranty register (with expiry reminders) + DLP-period defect
// tracking. Extends the handover/DLP flow. Audit-logged.
// ============================================================

import { supabase } from '@/lib/supabase';
import { auditService } from './auditService';

export type WarrantyType = 'DLP' | 'MANUFACTURER' | 'SUPPLIER' | 'CONTRACTOR';
export type WarrantyStatus = 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'NO_DATE';
export type DefectSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL';
export type DefectStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface Warranty {
  id: string;
  project_id: string;
  project_label?: string;
  item_name: string;
  warranty_type: WarrantyType;
  provider: string | null;
  start_date: string | null;
  end_date: string | null;
  duration_months: number | null;
  document_id: string | null;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
  // computed
  days_to_expiry: number | null;
  status: WarrantyStatus;
}

export interface DlpDefect {
  id: string;
  project_id: string;
  project_label?: string;
  warranty_id: string | null;
  ref_code: string | null;
  title: string;
  description: string | null;
  severity: DefectSeverity;
  reported_date: string | null;
  status: DefectStatus;
  assigned_to_name: string | null;
  resolved_date: string | null;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
}

const DAY = 86400000;
const EXPIRING_DAYS = 30;

function warrantyStatus(end: string | null): { status: WarrantyStatus; days: number | null } {
  if (!end) return { status: 'NO_DATE', days: null };
  const days = Math.ceil((new Date(end).getTime() - Date.now()) / DAY);
  if (days < 0) return { status: 'EXPIRED', days };
  if (days <= EXPIRING_DAYS) return { status: 'EXPIRING', days };
  return { status: 'ACTIVE', days };
}

function decorateWarranty(row: any): Warranty {
  const { status, days } = warrantyStatus(row.end_date);
  return { ...row, duration_months: row.duration_months ?? null, status, days_to_expiry: days };
}

async function projectLabels(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const { data } = await supabase.from('projects').select('id, project_number, name').in('id', ids);
  (data || []).forEach((p: any) => map.set(p.id, `${p.project_number} — ${p.name}`));
  return map;
}

export const warrantyService = {
  // ---------------- Warranties ----------------
  async listWarranties(opts?: { projectId?: string }): Promise<Warranty[]> {
    let q = supabase.from('project_warranties').select('*').order('end_date', { ascending: true, nullsFirst: false });
    if (opts?.projectId) q = q.eq('project_id', opts.projectId);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data || []).map(decorateWarranty);
    const labels = await projectLabels([...new Set(rows.map(r => r.project_id))]);
    rows.forEach(r => { r.project_label = labels.get(r.project_id); });
    return rows;
  },

  async createWarranty(input: Partial<Warranty> & { project_id: string; item_name: string }): Promise<Warranty> {
    // derive end_date from start + duration when end not given
    let end = input.end_date || null;
    if (!end && input.start_date && input.duration_months) {
      const d = new Date(input.start_date); d.setMonth(d.getMonth() + Number(input.duration_months)); end = d.toISOString().slice(0, 10);
    }
    const payload = {
      project_id: input.project_id, item_name: input.item_name,
      warranty_type: input.warranty_type || 'DLP', provider: input.provider || null,
      start_date: input.start_date || null, end_date: end, duration_months: input.duration_months ?? null,
      document_id: input.document_id || null, notes: input.notes || null, created_by_name: input.created_by_name || null,
    };
    const { data, error } = await supabase.from('project_warranties').insert(payload).select('*').single();
    if (error) throw error;
    auditService.logEvent({ module: 'Projects', action: 'CREATE', entity_type: 'warranty', entity_id: data.id, summary: `Warranty: ${payload.item_name}` });
    return decorateWarranty(data);
  },

  async updateWarranty(id: string, patch: Partial<Warranty>): Promise<void> {
    const allowed: any = {};
    for (const k of ['item_name', 'warranty_type', 'provider', 'start_date', 'end_date', 'duration_months', 'document_id', 'notes'])
      if (k in patch) allowed[k] = (patch as any)[k];
    allowed.updated_at = new Date().toISOString();
    const { error } = await supabase.from('project_warranties').update(allowed).eq('id', id);
    if (error) throw error;
    auditService.logEvent({ module: 'Projects', action: 'UPDATE', entity_type: 'warranty', entity_id: id, summary: 'Updated warranty' });
  },

  async removeWarranty(id: string): Promise<void> {
    const { error } = await supabase.from('project_warranties').delete().eq('id', id);
    if (error) throw error;
    auditService.logEvent({ module: 'Projects', action: 'DELETE', entity_type: 'warranty', entity_id: id, summary: 'Removed warranty' });
  },

  // ---------------- DLP defects ----------------
  async listDefects(opts?: { projectId?: string }): Promise<DlpDefect[]> {
    let q = supabase.from('project_dlp_defects').select('*').order('created_at', { ascending: false });
    if (opts?.projectId) q = q.eq('project_id', opts.projectId);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data || []) as DlpDefect[];
    const labels = await projectLabels([...new Set(rows.map(r => r.project_id))]);
    rows.forEach(r => { r.project_label = labels.get(r.project_id); });
    return rows;
  },

  async nextDefectRef(projectId: string): Promise<string> {
    const { count } = await supabase.from('project_dlp_defects').select('id', { count: 'exact', head: true }).eq('project_id', projectId);
    return `DEF-${String((count || 0) + 1).padStart(3, '0')}`;
  },

  async createDefect(input: Partial<DlpDefect> & { project_id: string; title: string }): Promise<DlpDefect> {
    const ref = input.ref_code || (await this.nextDefectRef(input.project_id));
    const payload = {
      project_id: input.project_id, warranty_id: input.warranty_id || null, ref_code: ref,
      title: input.title, description: input.description || null, severity: input.severity || 'MINOR',
      reported_date: input.reported_date || new Date().toISOString().slice(0, 10), status: input.status || 'OPEN',
      assigned_to_name: input.assigned_to_name || null, resolved_date: input.resolved_date || null,
      notes: input.notes || null, created_by_name: input.created_by_name || null,
    };
    const { data, error } = await supabase.from('project_dlp_defects').insert(payload).select('*').single();
    if (error) throw error;
    auditService.logEvent({ module: 'Projects', action: 'CREATE', entity_type: 'dlp_defect', entity_id: data.id, summary: `DLP defect ${ref}: ${payload.title}` });
    return data as DlpDefect;
  },

  async updateDefect(id: string, patch: Partial<DlpDefect>): Promise<void> {
    const allowed: any = {};
    for (const k of ['warranty_id', 'ref_code', 'title', 'description', 'severity', 'reported_date', 'status', 'assigned_to_name', 'resolved_date', 'notes'])
      if (k in patch) allowed[k] = (patch as any)[k];
    if (patch.status === 'RESOLVED' && !('resolved_date' in patch)) allowed.resolved_date = new Date().toISOString().slice(0, 10);
    allowed.updated_at = new Date().toISOString();
    const { error } = await supabase.from('project_dlp_defects').update(allowed).eq('id', id);
    if (error) throw error;
    auditService.logEvent({ module: 'Projects', action: 'UPDATE', entity_type: 'dlp_defect', entity_id: id, summary: 'Updated DLP defect' });
  },

  async removeDefect(id: string): Promise<void> {
    const { error } = await supabase.from('project_dlp_defects').delete().eq('id', id);
    if (error) throw error;
    auditService.logEvent({ module: 'Projects', action: 'DELETE', entity_type: 'dlp_defect', entity_id: id, summary: 'Removed DLP defect' });
  },
};

export default warrantyService;
