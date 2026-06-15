// ============================================================
// JEET ERP — Request for Quotation (RFQ) service
// Drafts a sourcing request from a BOQ, records it as a log, and
// supports listing/export. The next step (AI) reads supplier email
// replies against the recorded items and suggests prices.
// ============================================================

import { supabase } from '@/lib/supabase';

export interface RFQItem {
  item_code?: string;
  description: string;
  unit: string;
  quantity: number;
}

export interface RFQSupplier {
  id: string;
  name: string;
  email: string | null;
  type: string; // SUPPLIER | SUBCONTRACTOR | BOTH
}

export type RFQStatus = 'DRAFT' | 'SENT' | 'AWAITING' | 'CLOSED';

export interface RFQ {
  id: string;
  rfq_number: string;
  tender_id: string | null;
  boq_id: string | null;
  project_title: string | null;
  subject: string;
  message: string | null;
  due_date: string | null;
  items: RFQItem[];
  suppliers: RFQSupplier[];
  status: RFQStatus;
  created_by: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RFQInput {
  tender_id?: string | null;
  boq_id?: string | null;
  project_title?: string | null;
  subject: string;
  message?: string | null;
  due_date?: string | null;
  items: RFQItem[];
  suppliers: RFQSupplier[];
  status?: RFQStatus;
}

const safe = async <T>(p: PromiseLike<{ data: T | null; error: unknown }>, fb: T): Promise<T> => {
  try { const { data } = await p; return data ?? fb; } catch { return fb; }
};

export const rfqService = {
  // Suppliers + subcontractors that can be sent an RFQ
  async getRecipients(): Promise<RFQSupplier[]> {
    const rows = await safe<any[]>(
      supabase.from('pricing_suppliers')
        .select('id, name, email, supplier_type, trade')
        .eq('is_active', true)
        .order('name'),
      []
    );
    return rows.map(r => ({ id: r.id, name: r.name, email: r.email, type: r.supplier_type || 'SUPPLIER' }));
  },

  // BOQ items mapped to RFQ lines (cost columns intentionally dropped — suppliers quote the price)
  async getBoqItems(boqId: string): Promise<{ tenderId: string | null; projectTitle: string | null; items: RFQItem[] }> {
    const boq = await safe<any>(
      supabase.from('boqs').select('id, tender_id, items').eq('id', boqId).maybeSingle(),
      null
    );
    if (!boq) return { tenderId: null, projectTitle: null, items: [] };

    let projectTitle: string | null = null;
    if (boq.tender_id) {
      const tender = await safe<any>(
        supabase.from('tenders').select('title, project_name').eq('id', boq.tender_id).maybeSingle(),
        null
      );
      projectTitle = tender?.project_name || tender?.title || null;
    }

    const items: RFQItem[] = (Array.isArray(boq.items) ? boq.items : []).map((it: any) => ({
      item_code: it.item_code || '',
      description: it.name || it.description || 'Item',
      unit: it.unit || 'Pcs',
      quantity: Number(it.quantity) || 0,
    }));
    return { tenderId: boq.tender_id || null, projectTitle, items };
  },

  async create(input: RFQInput): Promise<RFQ> {
    const { data: auth } = await supabase.auth.getUser();
    const payload = {
      tender_id: input.tender_id ?? null,
      boq_id: input.boq_id ?? null,
      project_title: input.project_title ?? null,
      subject: input.subject,
      message: input.message ?? null,
      due_date: input.due_date ?? null,
      items: input.items,
      suppliers: input.suppliers,
      status: input.status ?? 'DRAFT',
      created_by: auth?.user?.id ?? null,
      sent_at: input.status === 'SENT' ? new Date().toISOString() : null,
    };
    const { data, error } = await supabase.from('rfqs').insert(payload).select('*').single();
    if (error) throw new Error(error.message);
    return data as RFQ;
  },

  async list(): Promise<RFQ[]> {
    return safe<any[]>(supabase.from('rfqs').select('*').order('created_at', { ascending: false }), []) as Promise<RFQ[]>;
  },

  async get(id: string): Promise<RFQ | null> {
    return safe<any>(supabase.from('rfqs').select('*').eq('id', id).maybeSingle(), null);
  },

  async markSent(id: string): Promise<void> {
    await supabase.from('rfqs').update({ status: 'SENT', sent_at: new Date().toISOString() }).eq('id', id);
  },
};

export default rfqService;
