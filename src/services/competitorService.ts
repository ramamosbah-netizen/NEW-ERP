// ============================================================
// JEET ERP — Pre-Sales: Competitor Tracking service
// Competitor register + per-tender competitive log (who won, their
// estimated price, reason we lost). Audit-logged; separate-lookup.
// Degrades to [] if the tables aren't migrated yet.
// ============================================================

import { supabase } from '@/lib/supabase';
import { auditService } from './auditService';

export type CompetitorType = 'CONTRACTOR' | 'ELV_SPECIALIST' | 'SUPPLIER' | 'CONSULTANT' | 'OTHER';

export interface Competitor {
  id: string;
  name: string;
  type: CompetitorType;
  location: string | null;
  strengths: string | null;
  weaknesses: string | null;
  notes: string | null;
  is_active: boolean;
  created_by_name: string | null;
  created_at: string;
  // computed
  wins?: number;
  value_won?: number;
  bids?: number;
}

export interface TenderCompetitor {
  id: string;
  tender_id: string;
  competitor_id: string;
  estimated_price: number;
  is_winner: boolean;
  reason_for_loss: string | null;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
  // joined
  competitor_name?: string;
  tender_label?: string;
  tender_client?: string;
}

const MISSING = (e: any) => e && (e.code === 'PGRST205' || e.code === 'PGRST204' || /could not find the table|does not exist/i.test(e.message || ''));

export const competitorService = {
  async listCompetitors(): Promise<Competitor[]> {
    const { data, error } = await supabase.from('competitors').select('*').order('name');
    if (error) { if (MISSING(error)) return []; throw error; }
    const rows = (data || []) as Competitor[];
    // enrich with bid/win stats
    const { data: tc } = await supabase.from('tender_competitors').select('competitor_id, estimated_price, is_winner');
    const stats = new Map<string, { bids: number; wins: number; value: number }>();
    (tc || []).forEach((r: any) => {
      const e = stats.get(r.competitor_id) || { bids: 0, wins: 0, value: 0 };
      e.bids++; if (r.is_winner) { e.wins++; e.value += Number(r.estimated_price || 0); }
      stats.set(r.competitor_id, e);
    });
    rows.forEach(c => { const s = stats.get(c.id); c.bids = s?.bids || 0; c.wins = s?.wins || 0; c.value_won = s?.value || 0; });
    return rows;
  },

  async createCompetitor(input: Partial<Competitor> & { name: string }): Promise<string> {
    const payload = { name: input.name, type: input.type || 'CONTRACTOR', location: input.location || null, strengths: input.strengths || null, weaknesses: input.weaknesses || null, notes: input.notes || null, is_active: input.is_active ?? true, created_by_name: input.created_by_name || null };
    const { data, error } = await supabase.from('competitors').insert(payload).select('id').single();
    if (error) throw error;
    auditService.logEvent({ module: 'Sales', action: 'CREATE', entity_type: 'competitor', entity_id: data.id, summary: `Competitor ${input.name}` });
    return data.id;
  },

  async updateCompetitor(id: string, patch: Partial<Competitor>): Promise<void> {
    const allowed: any = {};
    for (const k of ['name', 'type', 'location', 'strengths', 'weaknesses', 'notes', 'is_active']) if (k in patch) allowed[k] = (patch as any)[k];
    allowed.updated_at = new Date().toISOString();
    const { error } = await supabase.from('competitors').update(allowed).eq('id', id);
    if (error) throw error;
    auditService.logEvent({ module: 'Sales', action: 'UPDATE', entity_type: 'competitor', entity_id: id, summary: 'Updated competitor' });
  },

  async removeCompetitor(id: string): Promise<void> {
    const { error } = await supabase.from('competitors').delete().eq('id', id);
    if (error) throw error;
    auditService.logEvent({ module: 'Sales', action: 'DELETE', entity_type: 'competitor', entity_id: id, summary: 'Removed competitor' });
  },

  async listTenderCompetitors(opts?: { tenderId?: string }): Promise<TenderCompetitor[]> {
    let q = supabase.from('tender_competitors').select('*').order('created_at', { ascending: false });
    if (opts?.tenderId) q = q.eq('tender_id', opts.tenderId);
    const { data, error } = await q;
    if (error) { if (MISSING(error)) return []; throw error; }
    const rows = (data || []) as TenderCompetitor[];
    const compIds = [...new Set(rows.map(r => r.competitor_id).filter(Boolean))];
    const tenderIds = [...new Set(rows.map(r => r.tender_id).filter(Boolean))];
    const [cRes, tRes] = await Promise.all([
      compIds.length ? supabase.from('competitors').select('id, name').in('id', compIds) : Promise.resolve({ data: [] as any[] }),
      tenderIds.length ? supabase.from('tenders').select('id, title, project_name, client_name').in('id', tenderIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const cMap = new Map((cRes.data || []).map((c: any) => [c.id, c.name]));
    const tMap = new Map((tRes.data || []).map((t: any) => [t.id, { label: t.title || t.project_name || 'Tender', client: t.client_name }]));
    rows.forEach(r => { r.competitor_name = cMap.get(r.competitor_id); const t = tMap.get(r.tender_id); r.tender_label = t?.label; r.tender_client = t?.client; });
    return rows;
  },

  async addTenderCompetitor(input: Partial<TenderCompetitor> & { tender_id: string; competitor_id: string }): Promise<string> {
    const payload = { tender_id: input.tender_id, competitor_id: input.competitor_id, estimated_price: input.estimated_price ?? 0, is_winner: input.is_winner ?? false, reason_for_loss: input.reason_for_loss || null, notes: input.notes || null, created_by_name: input.created_by_name || null };
    const { data, error } = await supabase.from('tender_competitors').insert(payload).select('id').single();
    if (error) throw error;
    auditService.logEvent({ module: 'Sales', action: 'CREATE', entity_type: 'tender_competitor', entity_id: data.id, summary: `Logged competitor on tender${input.is_winner ? ' (winner)' : ''}` });
    return data.id;
  },

  async updateTenderCompetitor(id: string, patch: Partial<TenderCompetitor>): Promise<void> {
    const allowed: any = {};
    for (const k of ['estimated_price', 'is_winner', 'reason_for_loss', 'notes']) if (k in patch) allowed[k] = (patch as any)[k];
    allowed.updated_at = new Date().toISOString();
    const { error } = await supabase.from('tender_competitors').update(allowed).eq('id', id);
    if (error) throw error;
    auditService.logEvent({ module: 'Sales', action: 'UPDATE', entity_type: 'tender_competitor', entity_id: id, summary: 'Updated competitive entry' });
  },

  async removeTenderCompetitor(id: string): Promise<void> {
    const { error } = await supabase.from('tender_competitors').delete().eq('id', id);
    if (error) throw error;
    auditService.logEvent({ module: 'Sales', action: 'DELETE', entity_type: 'tender_competitor', entity_id: id, summary: 'Removed competitive entry' });
  },
};

export default competitorService;
