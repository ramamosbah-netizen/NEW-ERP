// ============================================================
// JEET ERP — Client Invoice Service
// Handles: CRUD, approvals, status transitions, PDF uploads,
// retention ledgering, and event triggers.
// ============================================================

import { supabase } from '@/lib/supabase';
import type { ClientInvoice, ClientInvoiceItem } from '@/types/finance.types';
import { calculateInvoiceTotals } from './invoiceMathService';
import { invoicePDFService } from './invoicePDFService';
import { eventService } from './eventService';
import { validateInvoiceCeiling } from './voContractImpactService';
import { validate, ValidationError } from '@/lib/validation/validate';
import { invoiceDraftSchema, invoiceItemDraftSchema } from '@/lib/validation/finance.schemas';

export const invoiceService = {
  /** Completed (DONE) milestones for a project that can be billed now. */
  async getBillableMilestones(projectId: string): Promise<{ id: string; title: string }[]> {
    const { data } = await supabase
      .from('project_milestones')
      .select('id, title, status')
      .eq('project_id', projectId)
      .eq('status', 'DONE')
      .order('created_at');
    return (data || []).map((m: any) => ({ id: m.id, title: m.title }));
  },

  /**
   * Generates a PROGRESS client invoice from completed project phases.
   * Each line is a completed milestone with a claim amount; advance recovery
   * and retention are auto-applied from the project's contract terms. The
   * draft then flows through the configurable INV approval workflow.
   */
  async generateProgressFromMilestones(
    projectId: string,
    lines: Array<{ milestone_id: string; description: string; amount: number }>,
  ): Promise<ClientInvoice> {
    const billable = lines.filter(l => Number(l.amount) > 0);
    if (billable.length === 0) throw new Error('Add at least one phase with a claim amount.');

    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('client_id, advance_pct, retention_pct, payment_terms')
      .eq('id', projectId)
      .single();
    if (projErr || !project) throw new Error('Project not found');

    const gross = Math.round(billable.reduce((s, l) => s + Number(l.amount), 0) * 100) / 100;
    const advanceRecovery = Math.round(gross * (Number(project.advance_pct) || 0) / 100 * 100) / 100;
    const retentionHeld = Math.round(gross * (Number(project.retention_pct) || 0) / 100 * 100) / 100;

    const today = new Date();
    const due = new Date(today); due.setDate(due.getDate() + 30);
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    return this.createInvoiceDraft(
      {
        project_id: projectId,
        client_id: project.client_id,
        invoice_type: 'PROGRESS',
        invoice_date: iso(today),
        supply_date: iso(today),
        due_date: iso(due),
        gross_claim: gross,
        advance_recovery: advanceRecovery,
        retention_held: retentionHeld,
        notes: 'Generated from completed project phases.',
      } as any,
      billable.map((l, i) => ({
        line_no: i + 1,
        description: l.description,
        milestone_id: l.milestone_id,
        quantity: 1,
        unit: 'LS',
        unit_price: Number(l.amount),
        vat_rate: 5.00,
      })) as any,
    );
  },

  /**
   * Fetches all client invoices matching the filters.
   */
  async fetchInvoices(filters: {
    status?: string;
    projectId?: string;
    clientId?: string;
    search?: string;
    companyId?: string;
  } = {}): Promise<ClientInvoice[]> {
    let query = supabase
      .from('client_invoices')
      .select('*')
      .eq('is_active', true)
      .order('invoice_date', { ascending: false });

    // Multi-company scope (wave 2): active company's invoices + untagged rows.
    if (filters.companyId) query = query.or(`company_id.eq.${filters.companyId},company_id.is.null`);
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.projectId) {
      query = query.eq('project_id', filters.projectId);
    }
    if (filters.clientId) {
      query = query.eq('client_id', filters.clientId);
    }
    if (filters.search) {
      query = query.or(`invoice_number.ilike.%${filters.search}%,client_name.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as ClientInvoice[];
  },

  /**
   * Fetches details of a single invoice, including line items.
   */
  async fetchInvoiceById(id: string): Promise<(ClientInvoice & { items: ClientInvoiceItem[] }) | null> {
    const { data: invoice, error: invError } = await supabase
      .from('client_invoices')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (invError) {
      if (invError.code === 'PGRST116') return null;
      throw invError;
    }

    const { data: items, error: itemsError } = await supabase
      .from('client_invoice_items')
      .select('*')
      .eq('invoice_id', id)
      .order('line_no', { ascending: true });

    if (itemsError) throw itemsError;

    return {
      ...(invoice as ClientInvoice),
      items: (items || []) as ClientInvoiceItem[],
    };
  },

  /**
   * Creates a new client invoice draft.
   */
  async createInvoiceDraft(
    invoiceData: Omit<Partial<ClientInvoice>, 'id' | 'created_at' | 'updated_at'>,
    itemsData: Array<Omit<Partial<ClientInvoiceItem>, 'id' | 'invoice_id' | 'created_at'>>
  ): Promise<ClientInvoice> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required');

    // Validate the inbound payload at the write boundary (mirrors DB constraints
    // with friendlier errors — rejects nothing Postgres would otherwise accept).
    validate(invoiceDraftSchema, invoiceData, 'invoice');
    if (!itemsData || itemsData.length === 0) {
      throw new ValidationError('Invalid invoice: at least one line item is required', []);
    }
    itemsData.forEach((item, i) => validate(invoiceItemDraftSchema, item, `line ${i + 1}`));

    // Fetch client details if client_name is not provided
    let clientName = invoiceData.client_name || '';
    let clientTrn = invoiceData.client_trn || null;
    let clientAddress = invoiceData.client_address || null;

    if (invoiceData.client_id && !clientName) {
      const { data: client } = await supabase
        .from('clients')
        .select('name, trn_number, billing_address')
        .eq('id', invoiceData.client_id)
        .single();
      if (client) {
        clientName = client.name;
        clientTrn = client.trn_number || null;
        clientAddress = client.billing_address || null;
      }
    }

    // Run math calculation engine
    const mathItems = itemsData.map(item => ({
      quantity: Number(item.quantity) || 0,
      unit_price: Number(item.unit_price) || 0,
      vat_rate: item.vat_rate !== undefined ? Number(item.vat_rate) : 5.00
    }));

    const mathOutput = calculateInvoiceTotals({
      items: mathItems,
      contract_value: invoiceData.certified_amount ? undefined : (invoiceData.gross_claim || 0), // fallback contract val
      total_advance_amount: invoiceData.advance_recovery || 0,
      retention_rate: invoiceData.retention_held ? (invoiceData.retention_held / (invoiceData.gross_claim || 1)) : 0,
      gross_claim_override: invoiceData.certified_amount ? Number(invoiceData.certified_amount) : undefined
    });

    // We can also let the UI pass recovery and retention rates explicitly if needed
    const finalGrossClaim = invoiceData.gross_claim !== undefined ? Number(invoiceData.gross_claim) : mathOutput.gross_claim;
    const finalAdvanceRecovery = invoiceData.advance_recovery !== undefined ? Number(invoiceData.advance_recovery) : mathOutput.advance_recovery;
    const finalRetentionHeld = invoiceData.retention_held !== undefined ? Number(invoiceData.retention_held) : mathOutput.retention_held;
    
    // Total taxable amount and VAT
    const finalTaxable = mathOutput.taxable_amount;
    const finalVat = mathOutput.vat_amount;
    const finalTotalInclVat = mathOutput.total_incl_vat;
    const finalNetDue = mathOutput.total_incl_vat - finalAdvanceRecovery - finalRetentionHeld;

    // Over-claim Ceiling Guard on Creation
    if (invoiceData.project_id) {
      const { data: project, error: projErr } = await supabase
        .from('projects')
        .select('revised_contract_value, original_contract_value, contract_value')
        .eq('id', invoiceData.project_id)
        .single();
      
      if (projErr) throw projErr;
      const revisedContractValue = Number(project.revised_contract_value ?? project.original_contract_value ?? project.contract_value ?? 0);

      // Fetch active, non-draft, non-cancelled invoices for this project
      const { data: otherInvoices, error: otherInvsErr } = await supabase
        .from('client_invoices')
        .select('gross_claim')
        .eq('project_id', invoiceData.project_id)
        .eq('is_active', true)
        .not('status', 'in', '("DRAFT","CANCELLED")');

      if (otherInvsErr) throw otherInvsErr;

      const cumulativeInvoiced = (otherInvoices || []).reduce((sum, inv) => sum + Number(inv.gross_claim || 0), 0);
      const ceilingCheck = validateInvoiceCeiling(revisedContractValue, cumulativeInvoiced, finalGrossClaim);
      if (!ceilingCheck.valid) {
        throw new Error(`Over-claim ceiling exceeded: Cumulative invoiced amount (${ceilingCheck.currentTotal.toFixed(2)} AED) would exceed the project's revised contract limit of ${ceilingCheck.ceiling.toFixed(2)} AED by ${ceilingCheck.exceededBy.toFixed(2)} AED.`);
      }
    }

    const { data: invoice, error: insertError } = await supabase
      .from('client_invoices')
      .insert({
        project_id: invoiceData.project_id || null,
        client_id: invoiceData.client_id,
        client_name: clientName,
        client_trn: clientTrn,
        client_address: clientAddress,
        invoice_type: invoiceData.invoice_type || 'STANDALONE',
        status: 'DRAFT',
        invoice_date: invoiceData.invoice_date || new Date().toISOString().split('T')[0],
        supply_date: invoiceData.supply_date || new Date().toISOString().split('T')[0],
        due_date: invoiceData.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        period_from: invoiceData.period_from || null,
        period_to: invoiceData.period_to || null,
        gross_claim: finalGrossClaim,
        advance_recovery: finalAdvanceRecovery,
        retention_held: finalRetentionHeld,
        taxable_amount: finalTaxable,
        vat_amount: finalVat,
        total_incl_vat: finalTotalInclVat,
        net_due: finalNetDue,
        amount_paid: 0.00,
        certified_amount: invoiceData.certified_amount ? Number(invoiceData.certified_amount) : null,
        notes: invoiceData.notes || null,
        created_by: user.id
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Insert invoice items
    const itemsToInsert = itemsData.map((item, idx) => {
      const lineMath = mathOutput.gross_claim > 0 ? mathOutput : calculateInvoiceTotals({ items: [{ quantity: Number(item.quantity) || 0, unit_price: Number(item.unit_price) || 0, vat_rate: item.vat_rate !== undefined ? Number(item.vat_rate) : 5.00 }] });
      return {
        invoice_id: invoice.id,
        line_no: idx + 1,
        description: item.description || '',
        milestone_id: item.milestone_id || null,
        boq_reference: item.boq_reference || null,
        quantity: Number(item.quantity) || 0,
        unit: item.unit || 'Nos',
        unit_price: Number(item.unit_price) || 0,
        taxable_amount: Number(item.quantity) * Number(item.unit_price),
        vat_rate: item.vat_rate !== undefined ? Number(item.vat_rate) : 5.00,
        vat_amount: (Number(item.quantity) * Number(item.unit_price)) * 0.05, // rounded at trigger/db or kept
        line_total: (Number(item.quantity) * Number(item.unit_price)) * 1.05,
      };
    });

    // Perform database level updates for items if required
    for (const item of itemsToInsert) {
      const lineMath = calculateInvoiceTotals({
        items: [{ quantity: item.quantity, unit_price: item.unit_price, vat_rate: item.vat_rate }]
      });
      item.taxable_amount = lineMath.taxable_amount;
      item.vat_amount = lineMath.vat_amount;
      item.line_total = lineMath.total_incl_vat;
    }

    const { error: itemsError } = await supabase
      .from('client_invoice_items')
      .insert(itemsToInsert);

    if (itemsError) throw itemsError;

    return invoice as ClientInvoice;
  },

  /**
   * Submits a draft invoice for manager review.
   */
  async submitForApproval(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('client_invoices')
      .update({ status: 'PENDING_APPROVAL', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'DRAFT');

    if (error) throw error;

    const invoice = await this.fetchInvoiceById(id);
    if (invoice) {
      await eventService.emitEvent(
        'invoice.submitted',
        'CLIENT_INVOICE',
        id,
        invoice.project_id || undefined,
        {
          invoice_number: invoice.invoice_number,
          client_name: invoice.client_name,
          net_due: invoice.net_due,
        }
      );
    }

    return true;
  },

  /**
   * Approves a client invoice.
   * Compiles the branded Tax Invoice PDF, uploads it to the DMS, and
   * creates retention records in the ledger if applicable.
   */
  async approveInvoice(id: string): Promise<boolean> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required');

    const invoice = await this.fetchInvoiceById(id);
    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status !== 'PENDING_APPROVAL' && invoice.status !== 'DRAFT') {
      throw new Error(`Cannot approve invoice in ${invoice.status} status.`);
    }

    // Over-claim Ceiling Guard on Approval
    if (invoice.project_id) {
      const { data: project, error: projErr } = await supabase
        .from('projects')
        .select('revised_contract_value, original_contract_value, contract_value')
        .eq('id', invoice.project_id)
        .single();
      
      if (projErr) throw projErr;
      const revisedContractValue = Number(project.revised_contract_value ?? project.original_contract_value ?? project.contract_value ?? 0);

      // Fetch OTHER active, non-draft, non-cancelled invoices for this project
      const { data: otherInvoices, error: otherInvsErr } = await supabase
        .from('client_invoices')
        .select('gross_claim')
        .eq('project_id', invoice.project_id)
        .eq('is_active', true)
        .not('status', 'in', '("DRAFT","CANCELLED")')
        .neq('id', id);

      if (otherInvsErr) throw otherInvsErr;

      const cumulativeInvoiced = (otherInvoices || []).reduce((sum, inv) => sum + Number(inv.gross_claim || 0), 0);
      const ceilingCheck = validateInvoiceCeiling(revisedContractValue, cumulativeInvoiced, Number(invoice.gross_claim || 0));
      if (!ceilingCheck.valid) {
        throw new Error(`Over-claim ceiling exceeded on approval: Cumulative invoiced amount (${ceilingCheck.currentTotal.toFixed(2)} AED) would exceed the project's revised contract limit of ${ceilingCheck.ceiling.toFixed(2)} AED by ${ceilingCheck.exceededBy.toFixed(2)} AED.`);
      }
    }

    // 1. Compile branded PDF
    const doc = await invoicePDFService.generateInvoicePDF(invoice, invoice.items);
    const pdfBlob = doc.output('blob');
    const pdfFile = new File([pdfBlob], `${invoice.invoice_number}.pdf`, { type: 'application/pdf' });

    // 2. Upload to Supabase Storage
    const storagePath = `COMMERCIAL/CLIENT_INVOICE/${invoice.invoice_number}_${Date.now()}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(storagePath, pdfFile, { cacheControl: '3600', upsert: true });

    if (uploadErr) throw uploadErr;

    // 3. Create Document DMS Record
    const fileHash = 'sha256-' + Math.random().toString(36).substring(2); // placeholder hash
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        entity_type: invoice.project_id ? 'PROJECT' : 'CLIENT',
        entity_id: invoice.project_id || invoice.client_id,
        title: `Tax Invoice - ${invoice.invoice_number}`,
        original_filename: `${invoice.invoice_number}.pdf`,
        file_ext: 'pdf',
        mime_type: 'application/pdf',
        file_size_bytes: pdfBlob.size,
        file_hash: fileHash,
        storage_path: storagePath,
        category: 'COMMERCIAL',
        subcategory: 'CLIENT_INVOICE',
        status: 'VERIFIED',
        linked_record_type: 'client_invoice',
        linked_record_id: invoice.id,
        amount_aed: invoice.net_due,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (docError) throw docError;

    // 4. Update Invoice Status and Link PDF
    const { error: updateError } = await supabase
      .from('client_invoices')
      .update({
        status: 'APPROVED',
        pdf_document_id: document.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // 5. Ledger retention if applicable
    if (invoice.retention_held > 0 && invoice.project_id) {
      const expectedReleaseDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Default 1 year DLP
      await supabase.from('project_retention_ledger').insert({
        project_id: invoice.project_id,
        invoice_id: invoice.id,
        direction: 'HELD',
        amount: invoice.retention_held,
        expected_release_date: expectedReleaseDate
      });
    }

    // 6. Emit event
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
    await eventService.emitEvent(
      'invoice.approved',
      'CLIENT_INVOICE',
      id,
      invoice.project_id || undefined,
      {
        invoice_number: invoice.invoice_number,
        client_name: invoice.client_name,
        approved_by_name: profile?.full_name || 'Manager',
      }
    );

    return true;
  },

  /**
   * Rejects / returns a client invoice with comments.
   */
  async rejectInvoice(id: string, reason: string): Promise<boolean> {
    const { error } = await supabase
      .from('client_invoices')
      .update({ status: 'DRAFT', notes: reason, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    const invoice = await this.fetchInvoiceById(id);
    if (invoice) {
      await eventService.emitEvent(
        'invoice.submitted', // trigger re-alert or return
        'CLIENT_INVOICE',
        id,
        invoice.project_id || undefined,
        {
          invoice_number: invoice.invoice_number,
          client_name: invoice.client_name,
          rejected: true,
          comment: reason
        }
      );
    }

    return true;
  },

  /**
   * Marks approved client invoice as sent to the customer.
   */
  async markAsSent(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('client_invoices')
      .update({ status: 'SENT', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'APPROVED');

    if (error) throw error;

    const invoice = await this.fetchInvoiceById(id);
    if (invoice) {
      await eventService.emitEvent(
        'invoice.sent',
        'CLIENT_INVOICE',
        id,
        invoice.project_id || undefined,
        {
          invoice_number: invoice.invoice_number,
          client_name: invoice.client_name,
        }
      );
    }

    return true;
  },

  /**
   * Writes off an overdue client invoice.
   */
  async writeOffInvoice(id: string, reason: string): Promise<boolean> {
    const { error } = await supabase
      .from('client_invoices')
      .update({
        status: 'WRITTEN_OFF',
        write_off_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    const invoice = await this.fetchInvoiceById(id);
    if (invoice) {
      await eventService.emitEvent(
        'invoice.written_off',
        'CLIENT_INVOICE',
        id,
        invoice.project_id || undefined,
        {
          invoice_number: invoice.invoice_number,
          client_name: invoice.client_name,
          write_off_reason: reason
        }
      );
    }

    return true;
  },

  /**
   * Soft deletes a client invoice draft.
   */
  async deleteInvoice(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('client_invoices')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'DRAFT');

    if (error) throw error;
    return true;
  },

  /**
   * Fetches retention ledger records for a project.
   */
  async fetchRetentionLedger(projectId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('project_retention_ledger')
      .select('*, client_invoices(invoice_number)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Explicitly releases retention for a project by inserting a RELEASED ledger record.
   */
  async releaseRetention(projectId: string, invoiceId: string, amount: number): Promise<boolean> {
    const { error } = await supabase
      .from('project_retention_ledger')
      .insert({
        project_id: projectId,
        invoice_id: invoiceId,
        direction: 'RELEASED',
        amount: amount,
      });

    if (error) throw error;
    return true;
  }
};
