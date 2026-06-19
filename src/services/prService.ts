// ============================================================
// JEET ERP — Purchase Request (PR) Service
// Raise a PR (with or without a project), validate/approve it,
// then convert it into an LPO. The LPO links back via pr_id.
// ============================================================

import { supabase } from '@/lib/supabase';
import numberingService from '@/services/numberingService';
import { recordAudit } from '@/lib/audit/recordAudit';

export type PRStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CONVERTED' | 'CANCELLED';
export type PRCategory = 'PROJECT_MATERIAL' | 'TOOLS' | 'IT_EQUIPMENT' | 'FURNITURE' | 'CONSUMABLES' | 'SAMPLE' | 'SERVICES' | 'OTHER';

export interface PRItemInput {
  description: string;
  brand?: string;
  unit?: string;
  quantity: number;
  estimated_unit_cost?: number;
  system?: string;
  pricing_item_id?: string | null;
  notes?: string;
}

export interface PRInput {
  title: string;
  category: PRCategory;
  project_id?: string | null;
  justification?: string;
  required_by_date?: string | null;
  preferred_supplier_id?: string | null;
  payment_method?: string | null;
  notes?: string;
  company_id?: string | null;
  items: PRItemInput[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export const prService = {
  async list(filters: { status?: string; category?: string; companyId?: string } = {}) {
    let q = supabase.from('purchase_requests').select('*').order('created_at', { ascending: false });
    if (filters.status) q = q.eq('status', filters.status);
    if (filters.category) q = q.eq('category', filters.category);
    // Multi-company scope (wave 2): active company's PRs + untagged rows.
    if (filters.companyId) q = q.or(`company_id.eq.${filters.companyId},company_id.is.null`);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async get(id: string) {
    const [{ data: pr, error }, { data: items }] = await Promise.all([
      supabase.from('purchase_requests').select('*').eq('id', id).single(),
      supabase.from('purchase_request_items').select('*').eq('pr_id', id).order('line_no'),
    ]);
    if (error) throw error;
    let projectNumber: string | null = null;
    if (pr.project_id) {
      const { data: proj } = await supabase.from('projects').select('project_number').eq('id', pr.project_id).maybeSingle();
      projectNumber = proj?.project_number || null;
    }
    return { ...pr, project_number: projectNumber, items: items || [] };
  },

  async create(input: PRInput): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();

    const prNumber = await numberingService.generateNumber('PR');
    const estimatedTotal = round2((input.items || []).reduce(
      (s, it) => s + (Number(it.quantity) || 0) * (Number(it.estimated_unit_cost) || 0), 0));

    const headerBase = {
      pr_number: prNumber,
      status: 'DRAFT',
      category: input.category,
      project_id: input.project_id || null,
      title: input.title,
      justification: input.justification || null,
      required_by_date: input.required_by_date || null,
      preferred_supplier_id: input.preferred_supplier_id || null,
      payment_method: input.payment_method || null,
      estimated_total: estimatedTotal,
      notes: input.notes || null,
      company_id: input.company_id || null,
      requested_by: user.id,
      requested_by_name: profile?.full_name || user.email || 'Requester',
    };

    let { data: pr, error } = await supabase
      .from('purchase_requests')
      .insert(headerBase)
      .select('id')
      .single();

    // Degrade gracefully if payment_method column not present yet (migration 20260613280000)
    if (error && error.code === 'PGRST204') {
      const { payment_method, company_id, ...fallback } = headerBase as any;
      void payment_method; void company_id;
      ({ data: pr, error } = await supabase
        .from('purchase_requests')
        .insert(fallback)
        .select('id')
        .single());
    }
    if (error || !pr) throw error || new Error('Failed to create purchase request');

    if (input.items?.length) {
      const rows = input.items.map((it, idx) => ({
        pr_id: pr.id,
        line_no: idx + 1,
        description: it.description,
        brand: it.brand || null,
        unit: it.unit || 'Pcs',
        quantity: Number(it.quantity) || 0,
        estimated_unit_cost: Number(it.estimated_unit_cost) || 0,
        estimated_line_total: round2((Number(it.quantity) || 0) * (Number(it.estimated_unit_cost) || 0)),
        system: it.system || 'OTHER',
        pricing_item_id: it.pricing_item_id || null,
        notes: it.notes || null,
      }));
      const { error: itemsErr } = await supabase.from('purchase_request_items').insert(rows);
      if (itemsErr) { await supabase.from('purchase_requests').delete().eq('id', pr.id); throw itemsErr; }
    }

    await recordAudit({
      action: 'CREATE', entity_type: 'PURCHASE_REQUEST', entity_id: pr.id,
      entity_label: prNumber, summary: `Created purchase request ${prNumber} (${input.category})`,
      module: 'PROCUREMENT',
    }).catch(() => {});
    return pr.id;
  },

  async submit(id: string) {
    return this._transition(id, 'SUBMITTED', ['DRAFT'], 'Submitted for approval');
  },

  async approve(id: string) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: pr } = await supabase.from('purchase_requests').select('status, pr_number').eq('id', id).single();
    if (!pr || pr.status !== 'SUBMITTED') throw new Error('Only submitted PRs can be approved.');
    const { error } = await supabase
      .from('purchase_requests')
      .update({ status: 'APPROVED', approved_by: user?.id || null, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    await recordAudit({ action: 'APPROVE', entity_type: 'PURCHASE_REQUEST', entity_id: id, entity_label: pr.pr_number, summary: `Approved PR ${pr.pr_number}`, module: 'PROCUREMENT' }).catch(() => {});
    return true;
  },

  async reject(id: string, reason: string) {
    const { data: pr } = await supabase.from('purchase_requests').select('status, pr_number').eq('id', id).single();
    if (!pr || pr.status !== 'SUBMITTED') throw new Error('Only submitted PRs can be rejected.');
    const { error } = await supabase
      .from('purchase_requests')
      .update({ status: 'REJECTED', rejection_reason: reason, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    await recordAudit({ action: 'REJECT', entity_type: 'PURCHASE_REQUEST', entity_id: id, entity_label: pr.pr_number, summary: `Rejected PR ${pr.pr_number}: ${reason}`, module: 'PROCUREMENT' }).catch(() => {});
    return true;
  },

  /** Returns the configurable direct-purchase threshold (AED). */
  async getDirectPurchaseThreshold(): Promise<number> {
    try {
      const { default: settingsService } = await import('@/services/settingsService');
      const t = await settingsService.getSettingByKey<number>('procurement.direct_purchase_threshold', 10000);
      return Number(t) || 10000;
    } catch {
      return 10000;
    }
  },

  /**
   * Marks an approved PR as directly purchased (no LPO), allowed only when its
   * estimated total is below the configurable threshold.
   */
  async markDirectPurchased(id: string) {
    const { data: pr } = await supabase
      .from('purchase_requests')
      .select('status, pr_number, estimated_total')
      .eq('id', id)
      .single();
    if (!pr || pr.status !== 'APPROVED') throw new Error('Only approved PRs can be directly purchased.');

    const threshold = await this.getDirectPurchaseThreshold();
    if (Number(pr.estimated_total) > threshold) {
      throw new Error(`Direct purchase is only allowed under ${threshold.toLocaleString()} AED. Convert to an LPO instead.`);
    }

    const { error } = await supabase
      .from('purchase_requests')
      .update({ status: 'DIRECT_PURCHASED', is_direct_purchase: true, direct_purchased_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;

    await recordAudit({ action: 'UPDATE', entity_type: 'PURCHASE_REQUEST', entity_id: id, entity_label: pr.pr_number, summary: `PR ${pr.pr_number} purchased directly (no LPO)`, module: 'PROCUREMENT' }).catch(() => {});
    return true;
  },

  /** Marks the PR as converted and links the created LPO. Called after the LPO is saved. */
  async markConverted(prId: string, poId: string) {
    const { error } = await supabase
      .from('purchase_requests')
      .update({ status: 'CONVERTED', converted_po_id: poId, converted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', prId);
    if (error) throw error;
    return true;
  },

  async _transition(id: string, to: PRStatus, allowedFrom: PRStatus[], summary: string) {
    const { data: pr } = await supabase.from('purchase_requests').select('status, pr_number').eq('id', id).single();
    if (!pr || !allowedFrom.includes(pr.status as PRStatus)) {
      throw new Error(`Cannot move PR from ${pr?.status} to ${to}.`);
    }
    const { error } = await supabase
      .from('purchase_requests')
      .update({ status: to, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    await recordAudit({ action: 'UPDATE', entity_type: 'PURCHASE_REQUEST', entity_id: id, entity_label: pr.pr_number, summary: `PR ${pr.pr_number}: ${summary}`, module: 'PROCUREMENT' }).catch(() => {});
    return true;
  },
};

export default prService;
