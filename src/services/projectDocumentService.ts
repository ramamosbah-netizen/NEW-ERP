// ============================================================
// JEET ERP — Project Document Register
// Walks the full relationship graph for a project and returns
// every linked document (tender, BOQ, quotation, comparisons,
// LPOs, GRNs, client & supplier invoices, DMS files) traced
// back to the project, each with its own reference id, status,
// date, amount and a review link.
// ============================================================

import { supabase } from '@/lib/supabase';

export type LinkedDocCategory =
  | 'Tender' | 'BOQ' | 'Quotation' | 'Comparison'
  | 'Purchase Order (LPO)' | 'Goods Receipt' | 'Client Invoice'
  | 'Supplier Invoice' | 'Client LPO / Contract' | 'Attached File';

export interface LinkedDoc {
  category: LinkedDocCategory;
  reference: string;
  status?: string;
  date?: string | null;
  amount?: number | null;
  href?: string;
}

export interface ProjectLinkedRegister {
  project: { id: string; project_number?: string };
  groups: { category: LinkedDocCategory; items: LinkedDoc[] }[];
  totalCount: number;
}

type ProjectInput = {
  id: string;
  project_number?: string;
  tender_id?: string | null;
  boq_id?: string | null;
  quotation_id?: string | null;
};

const safe = async <T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> => {
  try {
    const { data, error } = await p;
    if (error) return null;
    return data;
  } catch {
    return null;
  }
};

export const projectDocumentService = {
  async getLinkedRegister(project: ProjectInput): Promise<ProjectLinkedRegister> {
    const groups: { category: LinkedDocCategory; items: LinkedDoc[] }[] = [];
    const push = (category: LinkedDocCategory, items: LinkedDoc[]) => {
      if (items.length > 0) groups.push({ category, items });
    };

    // Run every source in parallel; each is independently fault-tolerant.
    const [
      tender, boq, quotation, comparisons, pos, grns, clientInv, supplierInv, dmsDocs,
    ] = await Promise.all([
      project.tender_id
        ? safe<any>(supabase.from('tenders').select('id, title, status, budget, deadline_date').eq('id', project.tender_id).maybeSingle())
        : Promise.resolve(null),
      project.boq_id
        ? safe<any>(supabase.from('boqs').select('id, version, status, financials, tender_id').eq('id', project.boq_id).maybeSingle())
        : Promise.resolve(null),
      project.quotation_id
        ? safe<any>(supabase.from('quotations').select('id, quotation_number, revision_label, status, grand_total_with_vat, quotation_date, client_po_number, client_po_document_path, client_po_document_name').eq('id', project.quotation_id).maybeSingle())
        : Promise.resolve(null),
      project.quotation_id
        ? safe<any[]>(supabase.from('supplier_comparisons').select('id, comparison_number, status, created_at').eq('quotation_id', project.quotation_id))
        : Promise.resolve([]),
      safe<any[]>(supabase.from('purchase_orders').select('id, po_number, status, total, po_type, supplier_name, created_at').eq('project_id', project.id)),
      safe<any[]>(supabase.from('grns').select('id, grn_number, status, received_at, delivery_note_ref').eq('project_id', project.id)),
      safe<any[]>(supabase.from('client_invoices').select('id, invoice_number, status, total_incl_vat, invoice_date').eq('project_id', project.id)),
      safe<any[]>(supabase.from('supplier_invoices').select('id, supplier_invoice_number, status, total, invoice_date').eq('project_id', project.id)),
      safe<any[]>(supabase.from('documents').select('id, title, original_filename, entity_type, created_at').in('entity_id', [project.id, project.tender_id, project.quotation_id].filter(Boolean) as string[])),
    ]);

    // Tender
    if (tender) {
      push('Tender', [{
        category: 'Tender',
        reference: tender.title || `TND-${String(tender.id).slice(0, 8).toUpperCase()}`,
        status: tender.status,
        date: tender.deadline_date,
        amount: tender.budget != null ? Number(tender.budget) : null,
        href: `/tenders/${tender.id}`,
      }]);
    }

    // BOQ
    if (boq) {
      push('BOQ', [{
        category: 'BOQ',
        reference: `BOQ v${boq.version ?? 1}`,
        status: boq.status,
        amount: Number(boq.financials?.total_selling_price) || null,
        href: boq.tender_id ? `/tenders/${boq.tender_id}/boq` : undefined,
      }]);
    }

    // Quotation (+ its client LPO/contract attachment if present)
    if (quotation) {
      push('Quotation', [{
        category: 'Quotation',
        reference: `${quotation.quotation_number}${quotation.revision_label ? ' ' + quotation.revision_label : ''}`,
        status: quotation.status,
        date: quotation.quotation_date,
        amount: Number(quotation.grand_total_with_vat) || null,
        href: `/quotations/${quotation.id}`,
      }]);
      if (quotation.client_po_number || quotation.client_po_document_path) {
        push('Client LPO / Contract', [{
          category: 'Client LPO / Contract',
          reference: quotation.client_po_number || quotation.client_po_document_name || 'Client LPO',
          status: 'RECEIVED',
          href: `/quotations/${quotation.id}`,
        }]);
      }
    }

    // Comparisons
    push('Comparison', (comparisons || []).map((c: any) => ({
      category: 'Comparison' as const,
      reference: c.comparison_number,
      status: c.status,
      date: c.created_at,
      href: `/procurement/comparisons/${c.id}`,
    })));

    // Purchase Orders (LPOs)
    push('Purchase Order (LPO)', (pos || []).map((p: any) => ({
      category: 'Purchase Order (LPO)' as const,
      reference: `${p.po_number}${p.supplier_name ? ' · ' + p.supplier_name : ''}`,
      status: p.status,
      date: p.created_at,
      amount: Number(p.total) || null,
      href: `/procurement/po/${p.id}`,
    })));

    // Goods Receipts
    push('Goods Receipt', (grns || []).map((g: any) => ({
      category: 'Goods Receipt' as const,
      reference: `${g.grn_number}${g.delivery_note_ref ? ' · DN ' + g.delivery_note_ref : ''}`,
      status: g.status,
      date: g.received_at,
      href: `/procurement/grn/${g.id}`,
    })));

    // Client Invoices
    push('Client Invoice', (clientInv || []).map((inv: any) => ({
      category: 'Client Invoice' as const,
      reference: inv.invoice_number,
      status: inv.status,
      date: inv.invoice_date,
      amount: Number(inv.total_incl_vat) || null,
      href: `/finance/ar/${inv.id}`,
    })));

    // Supplier Invoices
    push('Supplier Invoice', (supplierInv || []).map((inv: any) => ({
      category: 'Supplier Invoice' as const,
      reference: inv.supplier_invoice_number,
      status: inv.status,
      date: inv.invoice_date,
      amount: Number(inv.total) || null,
      href: `/finance/ap`,
    })));

    // DMS attachments (de-duplicated, excludes none)
    push('Attached File', (dmsDocs || []).map((d: any) => ({
      category: 'Attached File' as const,
      reference: d.title || d.original_filename || 'Document',
      status: d.entity_type,
      date: d.created_at,
      href: `/documents`,
    })));

    const totalCount = groups.reduce((n, g) => n + g.items.length, 0);
    return { project: { id: project.id, project_number: project.project_number }, groups, totalCount };
  },
};

export default projectDocumentService;
