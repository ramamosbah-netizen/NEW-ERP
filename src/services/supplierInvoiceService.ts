// ============================================================
// JEET ERP — Supplier Invoice (Accounts Payable) Service
// Handles: Registration, 3-way matching, exception overrides,
// approvals, and event triggers.
// ============================================================

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import type { SupplierInvoice, SupplierInvoiceItem } from '@/types/finance.types';
import { performThreeWayMatch } from './threeWayMatchService';
import { eventService } from './eventService';

export const supplierInvoiceService = {
  /**
   * Fetches supplier invoices with filters.
   */
  async fetchSupplierInvoices(filters: {
    status?: string;
    poId?: string;
    supplierId?: string;
    projectId?: string;
    companyId?: string;
  } = {}): Promise<SupplierInvoice[]> {
    let query = supabase
      .from('supplier_invoices')
      .select('*, pricing_suppliers(name)')
      .order('invoice_date', { ascending: false });

    // Multi-company scope (wave 2): active company's invoices + untagged rows.
    if (filters.companyId) query = query.or(`company_id.eq.${filters.companyId},company_id.is.null`);
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.poId) {
      query = query.eq('po_id', filters.poId);
    }
    if (filters.supplierId) {
      query = query.eq('supplier_id', filters.supplierId);
    }
    if (filters.projectId) {
      query = query.eq('project_id', filters.projectId);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    // Map denormalized supplier name
    return (data || []).map(row => ({
      ...row,
      supplier_name: row.pricing_suppliers?.name || 'Unknown Supplier'
    })) as unknown as SupplierInvoice[];
  },

  /**
   * Fetches details of a single supplier invoice.
   */
  async fetchSupplierInvoiceById(id: string): Promise<(SupplierInvoice & { items: SupplierInvoiceItem[] }) | null> {
    const { data: invoice, error: invError } = await supabase
      .from('supplier_invoices')
      .select('*, pricing_suppliers(name)')
      .eq('id', id)
      .single();

    if (invError) {
      if (invError.code === 'PGRST116') return null;
      throw invError;
    }

    const { data: items, error: itemsError } = await supabase
      .from('supplier_invoice_items')
      .select('*')
      .eq('supplier_invoice_id', id);

    if (itemsError) throw itemsError;

    return {
      ...(invoice as unknown as SupplierInvoice),
      supplier_name: (invoice as any).pricing_suppliers?.name || 'Unknown Supplier',
      items: (items || []) as SupplierInvoiceItem[]
    };
  },

  /**
   * Auto-creates an "expected" Accounts Payable bill the moment an LPO is
   * emitted to a supplier, so every purchase surfaces in AP without waiting
   * for the supplier's tax invoice. The accountant later completes it (real
   * invoice number, amounts, PDF) and submits it through the approval workflow.
   *
   * Idempotent: skips if a bill already exists for this PO. Best-effort —
   * callers should not let a failure block sending the LPO.
   */
  async createExpectedFromPO(poId: string): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Skip if a bill already exists for this PO
    const { data: existing } = await supabase
      .from('supplier_invoices')
      .select('id')
      .eq('po_id', poId)
      .limit(1);
    if (existing && existing.length > 0) return existing[0].id;

    const { data: po } = await supabase
      .from('purchase_orders')
      .select('po_number, supplier_id, project_id, subtotal, discount_amount, vat_amount, total, payment_terms_days, proforma_invoice_path, proforma_invoice_name')
      .eq('id', poId)
      .single();
    if (!po) return null;

    const today = new Date();
    const due = new Date(today);
    due.setDate(due.getDate() + (Number(po.payment_terms_days) || 30));
    const taxable = Math.round(((Number(po.subtotal) || 0) - (Number(po.discount_amount) || 0)) * 100) / 100;
    const hasProforma = !!po.proforma_invoice_path;

    // Best-effort: tolerate DBs where the DRAFT/proforma migration isn't applied
    const payload: Record<string, any> = {
      supplier_id: po.supplier_id,
      supplier_invoice_number: `AWAITING-${po.po_number}`, // placeholder until the real invoice arrives
      po_id: poId,
      project_id: po.project_id || null,
      invoice_type: 'PO_MATCHED',
      invoice_date: today.toISOString().slice(0, 10),
      received_date: today.toISOString().slice(0, 10),
      due_date: due.toISOString().slice(0, 10),
      taxable_amount: taxable,
      vat_amount: Number(po.vat_amount) || 0,
      total: Number(po.total) || 0,
      match_status: 'NA',
      status: 'DRAFT',
      cost_bucket: po.project_id ? 'PROJECT' : 'OFFICE',
      proforma_path: po.proforma_invoice_path || null,
      proforma_name: po.proforma_invoice_name || null,
      notes: `Action to spend: created from approved LPO ${po.po_number}.` +
        (hasProforma ? ` Supplier proforma "${po.proforma_invoice_name}" auto-imported.` : '') +
        ' Upload and validate the supplier tax invoice to register it.',
      created_by: user.id,
    };

    let { data, error } = await supabase.from('supplier_invoices').insert(payload).select('id').single();
    if (error && /(status|cost_bucket|proforma)/i.test(error.message || '')) {
      // migration not yet applied — fall back to a registered bill without the new fields
      const { proforma_path, proforma_name, cost_bucket, ...legacy } = payload;
      legacy.status = 'REGISTERED';
      ({ data, error } = await supabase.from('supplier_invoices').insert(legacy).select('id').single());
    }
    if (error) throw error;
    return data?.id ?? null;
  },

  /**
   * Validates a DRAFT payable into a registered bill: records the supplier's
   * actual invoice number, amounts and attached document. The internal_ref
   * (id) already exists; this confirms the real invoice against it.
   */
  async validateExpected(id: string, input: {
    supplier_invoice_number: string;
    invoice_date?: string;
    taxable_amount: number;
    vat_amount: number;
    total: number;
    source_document_id?: string | null;
  }): Promise<void> {
    if (!input.supplier_invoice_number?.trim()) throw new Error('Enter the supplier invoice number to validate.');
    const patch: Record<string, any> = {
      supplier_invoice_number: input.supplier_invoice_number.trim(),
      taxable_amount: Number(input.taxable_amount) || 0,
      vat_amount: Number(input.vat_amount) || 0,
      total: Number(input.total) || 0,
      status: 'REGISTERED',
      updated_at: new Date().toISOString(),
    };
    if (input.invoice_date) patch.invoice_date = input.invoice_date;
    if (input.source_document_id) patch.source_document_id = input.source_document_id;
    const { error } = await supabase.from('supplier_invoices').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
  },

  /**
   * Records a direct expense (non-LPO purchase, car petrol, petty cash, office
   * expense) as an AP bill. Always carries an invoice/receipt reference and a
   * cost bucket (PROJECT via LPO, PETTY_CASH project-linked, or OFFICE). If
   * paid, it debits the chosen payment account (no separate supplier_payment,
   * so payee-less expenses work — the bill itself holds amount_paid + account).
   */
  async recordExpense(input: {
    cost_bucket: 'PROJECT' | 'PETTY_CASH' | 'OFFICE';
    project_id?: string | null;
    po_id?: string | null;
    supplier_id?: string | null;
    payee_name?: string | null;
    expense_category: string;
    supplier_invoice_number: string;   // the invoice / receipt reference (required)
    invoice_date: string;
    taxable_amount: number;
    vat_amount: number;
    total: number;
    payment_account_id?: string | null;
    source_document_id?: string | null;
    mark_paid?: boolean;
    notes?: string | null;
  }): Promise<SupplierInvoice> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required');

    if (!input.supplier_invoice_number?.trim()) throw new Error('An invoice / receipt reference is required for every expense.');
    if (!(Number(input.total) > 0)) throw new Error('Enter an amount greater than zero.');
    if ((input.cost_bucket === 'PROJECT' || input.cost_bucket === 'PETTY_CASH') && !input.project_id) {
      throw new Error('Select the project this expense belongs to.');
    }
    if (input.mark_paid && !input.payment_account_id) {
      throw new Error('Choose the card / account it was paid from.');
    }

    const today = new Date();
    const due = new Date(input.invoice_date); due.setDate(due.getDate() + 30);

    const payload: Record<string, any> = {
      supplier_id: input.supplier_id || null,
      supplier_invoice_number: input.supplier_invoice_number.trim(),
      po_id: input.po_id || null,
      project_id: (input.cost_bucket === 'OFFICE') ? null : (input.project_id || null),
      invoice_type: input.po_id ? 'PO_MATCHED' : 'DIRECT_EXPENSE',
      invoice_date: input.invoice_date,
      received_date: today.toISOString().slice(0, 10),
      due_date: due.toISOString().slice(0, 10),
      taxable_amount: Number(input.taxable_amount) || 0,
      vat_amount: Number(input.vat_amount) || 0,
      total: Number(input.total),
      match_status: 'NA',
      status: input.mark_paid ? 'PAID' : 'REGISTERED',
      amount_paid: input.mark_paid ? Number(input.total) : 0,
      cost_bucket: input.cost_bucket,
      payment_account_id: input.payment_account_id || null,
      payee_name: input.payee_name?.trim() || null,
      expense_category: input.expense_category || 'OTHER',
      source_document_id: input.source_document_id || null,
      notes: input.notes?.trim() || null,
      created_by: user.id,
    };

    const { data, error } = await supabase.from('supplier_invoices').insert(payload).select('*').single();
    if (error) throw new Error(error.message);
    return data as unknown as SupplierInvoice;
  },

  /**
   * Registers a new supplier invoice and triggers the 3-way matching engine.
   */
  async registerSupplierInvoice(
    invoiceData: Omit<Partial<SupplierInvoice>, 'id' | 'internal_ref' | 'created_by' | 'created_at' | 'updated_at'>,
    itemsData: Array<Omit<Partial<SupplierInvoiceItem>, 'id' | 'supplier_invoice_id' | 'created_at'>>,
    invoiceSupplierTrn?: string | null
  ): Promise<SupplierInvoice> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required');

    let matchStatus: SupplierInvoice['match_status'] = 'NA';
    let matchResults: SupplierInvoice['match_results'] = {};

    // 1. If PO-Matched, run the 3-Way Match Engine
    if (invoiceData.invoice_type === 'PO_MATCHED' && invoiceData.po_id) {
      const poId = invoiceData.po_id;

      // A. Fetch PO Header for supplier TRN
      const { data: po } = await supabase
        .from('purchase_orders')
        .select('supplier_trn')
        .eq('id', poId)
        .single();

      // B. Fetch PO Items
      const { data: poItems } = await supabase
        .from('po_items')
        .select('id, description, quantity, unit_price, qty_received, qty_rejected')
        .eq('po_id', poId);

      // C. Fetch Previously Invoiced quantities on APPROVED/REGISTERED past supplier invoices
      const { data: pastInvoicedLines } = await supabase
        .from('supplier_invoice_items')
        .select('po_item_id, quantity, supplier_invoices(status)')
        .eq('supplier_invoices.po_id', poId)
        .not('supplier_invoices.status', 'eq', 'CANCELLED');

      const previouslyInvoicedQtys: Record<string, number> = {};
      if (pastInvoicedLines) {
        for (const line of pastInvoicedLines) {
          if (line.po_item_id) {
            previouslyInvoicedQtys[line.po_item_id] = (previouslyInvoicedQtys[line.po_item_id] || 0) + Number(line.quantity);
          }
        }
      }

      // D. Map inputs for match engine
      const engineInvoiceItems = itemsData.map(item => ({
        po_item_id: item.po_item_id || null,
        description: item.description || '',
        quantity: Number(item.quantity) || 0,
        unit_price: Number(item.unit_price) || 0
      }));

      const enginePOItems = (poItems || []).map(item => ({
        id: item.id,
        description: item.description,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        qty_received: Number(item.qty_received),
        qty_rejected: Number(item.qty_rejected)
      }));

      // E. Run matching
      const matchOutput = performThreeWayMatch({
        invoiceItems: engineInvoiceItems,
        poItems: enginePOItems,
        previouslyInvoicedQtys,
        invoiceSupplierTrn,
        dbSupplierTrn: po?.supplier_trn
      });

      matchStatus = matchOutput.status;
      matchResults = matchOutput.results;
    }

    // Calculate totals
    let taxable = 0;
    let vat = 0;
    for (const item of itemsData) {
      const lineTax = Number(item.quantity || 0) * Number(item.unit_price || 0);
      const lineVat = lineTax * ((item.vat_rate !== undefined ? Number(item.vat_rate) : 5.00) / 100);
      taxable += lineTax;
      vat += lineVat;
    }
    
    // Round to 2 decimals
    taxable = Math.round(taxable * 100) / 100;
    vat = Math.round(vat * 100) / 100;
    const total = Math.round((taxable + vat) * 100) / 100;

    // 2. Insert Supplier Invoice Header
    const { data: invoice, error: insertError } = await supabase
      .from('supplier_invoices')
      .insert({
        supplier_id: invoiceData.supplier_id,
        supplier_invoice_number: invoiceData.supplier_invoice_number,
        po_id: invoiceData.po_id || null,
        project_id: invoiceData.project_id || null,
        invoice_type: invoiceData.invoice_type || 'DIRECT_EXPENSE',
        invoice_date: invoiceData.invoice_date || new Date().toISOString().split('T')[0],
        received_date: invoiceData.received_date || new Date().toISOString().split('T')[0],
        due_date: invoiceData.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        taxable_amount: taxable,
        vat_amount: vat,
        total: total,
        match_status: matchStatus,
        match_results: matchResults,
        status: 'REGISTERED',
        source_document_id: invoiceData.source_document_id || null,
        expense_category: invoiceData.expense_category || null,
        notes: invoiceData.notes || null,
        created_by: user.id
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 3. Insert Supplier Invoice Items
    const itemsToInsert = itemsData.map(item => ({
      supplier_invoice_id: invoice.id,
      po_item_id: item.po_item_id || null,
      description: item.description || '',
      quantity: Number(item.quantity) || 0,
      unit_price: Number(item.unit_price) || 0,
      taxable_amount: Math.round((Number(item.quantity) * Number(item.unit_price)) * 100) / 100,
      vat_rate: item.vat_rate !== undefined ? Number(item.vat_rate) : 5.00,
      vat_amount: Math.round(((Number(item.quantity) * Number(item.unit_price)) * 0.05) * 100) / 100,
    }));

    const { error: itemsError } = await supabase
      .from('supplier_invoice_items')
      .insert(itemsToInsert);

    if (itemsError) throw itemsError;

    // 4. Emit Event if match exceptions occurred
    if (matchStatus === 'EXCEPTION') {
      const { data: supplier } = await supabase
        .from('pricing_suppliers')
        .select('name')
        .eq('id', invoiceData.supplier_id)
        .single();

      const exceptionsList: string[] = [];
      if (matchResults.priceExceptions && matchResults.priceExceptions.length > 0) {
        exceptionsList.push(`${matchResults.priceExceptions.length} price mismatch(es)`);
      }
      if (matchResults.qtyExceptions && matchResults.qtyExceptions.length > 0) {
        exceptionsList.push(`${matchResults.qtyExceptions.length} quantity mismatch(es)`);
      }
      if (!matchResults.trnValid) {
        exceptionsList.push(matchResults.trnError || 'TRN validation failed');
      }

      await eventService.emitEvent(
        'supplier_invoice.match_exception',
        'SUPPLIER_INVOICE',
        invoice.id,
        invoiceData.project_id || undefined,
        {
          supplier_invoice_number: invoice.supplier_invoice_number,
          supplier_name: supplier?.name || 'Supplier',
          exceptions: exceptionsList.join(', ')
        }
      );
    }

    // 5. Auto-update the catalogue material costs from the billed prices.
    //    Best-effort — never blocks invoice registration.
    try {
      const { priceUpdateService } = await import('./priceUpdateService');
      await priceUpdateService.applyFromSupplierInvoice(invoice.id);
    } catch (err) {
      logger.warn('Catalogue price auto-update from supplier invoice failed:', err);
    }

    return invoice as SupplierInvoice;
  },

  /**
   * Approves a registered supplier invoice for payment schedule.
   */
  async approveSupplierInvoice(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('supplier_invoices')
      .update({ status: 'APPROVED', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  /**
   * Overrides match exceptions, forcing approval with a reason.
   */
  async overrideMatchException(id: string, reason: string): Promise<boolean> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required');

    const { error } = await supabase
      .from('supplier_invoices')
      .update({
        match_status: 'OVERRIDDEN',
        override_reason: reason,
        override_by: user.id,
        status: 'APPROVED',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  /**
   * Records disbursement details for AP scheduling.
   */
  async recordSupplierPayment(
    paymentData: {
      supplier_id: string;
      amount: number;
      payment_date: string;
      method: string;
      reference?: string;
      bank_account?: string;
      payment_account_id?: string | null;
      notes?: string;
    },
    allocations: Array<{ invoiceId: string; amount: number }>
  ): Promise<any> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required');

    // 1. Insert Supplier Payment (links to a payment account so balances stay accurate)
    const payInsert: Record<string, any> = {
      supplier_id: paymentData.supplier_id,
      amount: Number(paymentData.amount),
      payment_date: paymentData.payment_date,
      method: paymentData.method,
      reference: paymentData.reference || null,
      bank_account: paymentData.bank_account || null,
      payment_account_id: paymentData.payment_account_id || null,
      notes: paymentData.notes || null,
      created_by: user.id
    };
    let { data: payment, error: payError } = await supabase.from('supplier_payments').insert(payInsert).select().single();
    if (payError && /payment_account_id/i.test(payError.message || '')) {
      const { payment_account_id, ...legacy } = payInsert;
      ({ data: payment, error: payError } = await supabase.from('supplier_payments').insert(legacy).select().single());
    }

    if (payError) throw payError;

    // 2. Process Allocations
    for (const alloc of allocations) {
      if (alloc.amount <= 0) continue;

      const { error: allocError } = await supabase
        .from('supplier_payment_allocations')
        .insert({
          payment_id: payment.id,
          supplier_invoice_id: alloc.invoiceId,
          allocated_amount: Number(alloc.amount)
        });

      if (allocError) throw allocError;

      // Fetch invoice details to increment amount_paid
      const { data: invoice } = await supabase
        .from('supplier_invoices')
        .select('amount_paid, total')
        .eq('id', alloc.invoiceId)
        .single();

      if (invoice) {
        const newPaid = Number(invoice.amount_paid) + Number(alloc.amount);
        const total = Number(invoice.total);
        const status = newPaid >= total ? 'PAID' : 'PARTIALLY_PAID';

        await supabase
          .from('supplier_invoices')
          .update({
            amount_paid: newPaid,
            status,
            updated_at: new Date().toISOString()
          })
          .eq('id', alloc.invoiceId);
      }
    }

    return payment;
  }
};
export default supplierInvoiceService;
