// ============================================================
// JEET ERP — Quotation Module Supabase Service
// Data access, workflow logic, audit logs, and integrations
// ============================================================

import { logger } from '@/lib/logger';
import { supabase } from './supabase';
import { amountToWords } from './amount-to-words';
import { eventService } from '@/services/eventService';
import { generateProjectNumber } from './project-number-service';
import { recordAudit } from './audit/recordAudit';
import type { 
  QuotationInput, 
  QuotationLineInput, 
  QuotationApprovalInput 
} from './quotation-validation';

export type QuotationStatus = 
  | 'DRAFT' 
  | 'PENDING_COMMERCIAL' 
  | 'PENDING_GM' 
  | 'APPROVED' 
  | 'SENT_TO_CLIENT' 
  | 'ACCEPTED' 
  | 'REJECTED' 
  | 'REVISED' 
  | 'SUPERSEDED';

export type QuotationFilters = {
  company_id?: string;
  status?: string;
  project_id?: string;
  client_id?: string;
  date_from?: string;
  date_to?: string;
  prepared_by?: string;
  search?: string;
};

// Helper to fetch user profile metadata
export async function getProfileById(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}

// Helper to send in-app notification
export async function sendNotification(userId: string, message: string) {
  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      message,
      read: false
    });
  if (error) {
    logger.error('Failed to create notification:', error);
  }
}

// Helper to get all users of a specific role
export async function getUsersByRole(role: 'admin' | 'manager' | 'engineer') {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', role);
  if (error) return [];
  return data.map(d => d.id);
}

// ============================================================
// CORE SERVICE METHODS
// ============================================================

export const quotationService = {
  
  // 1. Fetch all quotations matching filters
  async fetchQuotations(filters: QuotationFilters) {
    let query = supabase
      .from('quotations')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.project_id) query = query.eq('project_id', filters.project_id);
    if (filters.client_id) query = query.eq('client_id', filters.client_id);
    // Multi-company scope (Phase 0d): active company's quotations + untagged rows.
    if (filters.company_id) query = query.or(`company_id.eq.${filters.company_id},company_id.is.null`);
    if (filters.prepared_by) query = query.eq('prepared_by', filters.prepared_by);
    
    if (filters.date_from) query = query.gte('quotation_date', filters.date_from);
    if (filters.date_to) query = query.lte('quotation_date', filters.date_to);

    if (filters.search) {
      const s = `%${filters.search}%`;
      query = query.or(`quotation_number.ilike.${s},client_name.ilike.${s},subject.ilike.${s},project_ref.ilike.${s}`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // 2. Fetch single quotation details (including lines, approvals, and revisions)
  async fetchQuotationById(id: string, currentUserId?: string) {
    // A. Fetch quotation row
    const { data: quote, error: quoteError } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', id)
      .single();

    if (quoteError) throw quoteError;
    if (!quote) return null;

    // B. Fetch quotation lines
    const { data: lines, error: linesError } = await supabase
      .from('quotation_lines')
      .select('*')
      .eq('quotation_id', id)
      .order('sort_order', { ascending: true });

    if (linesError) throw linesError;

    // C. Fetch approvals log
    const { data: approvals, error: approvalsError } = await supabase
      .from('quotation_approvals')
      .select('*')
      .eq('quotation_id', id)
      .order('acted_at', { ascending: true });

    if (approvalsError) throw approvalsError;

    // D. Fetch all revisions for this quotation chain (same quotation number)
    const { data: revisions, error: revError } = await supabase
      .from('quotations')
      .select('id, revision, revision_label, status, grand_total_with_vat, created_at')
      .eq('quotation_number', quote.quotation_number)
      .order('revision', { ascending: true });

    if (revError) throw revError;

    // E. Enforce RLS on internal notes at application level
    let filteredNotesInternal = quote.notes_internal;
    if (currentUserId) {
      const { data: isApprover } = await supabase.rpc('has_permission', {
        p_user_id: currentUserId,
        p_perm_key: 'quotation.approve'
      });
      if (!isApprover && quote.prepared_by !== currentUserId) {
        filteredNotesInternal = null; // Hide internal notes for non-approvers and non-owners
      }
    }

    return {
      ...quote,
      notes_internal: filteredNotesInternal,
      lines: lines || [],
      approvals: approvals || [],
      revisions: revisions || []
    };
  },

  // 3. Create a quotation from a BOQ
  async createFromBOQ(boqId: string, quoteData: Partial<QuotationInput> & { lines: QuotationLineInput[]; company_id?: string | null }) {
    // Fetch BOQ and Tender details to verify status is FINALIZED
    const { data: boq, error: boqError } = await supabase
      .from('boqs')
      .select('*, tenders(*)')
      .eq('id', boqId)
      .single();

    if (boqError || !boq) {
      throw new Error('Linked BOQ not found.');
    }

    if (boq.status !== 'finalized') {
      throw new Error('Quotation cannot be created if linked BOQ status is not FINALIZED.');
    }

    // Check if there is already an active quotation for this BOQ
    const { data: activeQuotes, error: activeError } = await supabase
      .from('quotations')
      .select('id, quotation_number, status')
      .eq('boq_id', boqId)
      .in('status', ['DRAFT', 'PENDING_COMMERCIAL', 'PENDING_GM', 'APPROVED', 'SENT_TO_CLIENT', 'ACCEPTED']);

    if (activeError) throw activeError;
    if (activeQuotes && activeQuotes.length > 0) {
      throw new Error(`Only one active quotation per BOQ is allowed. Quotation ${activeQuotes[0].quotation_number} is currently active in status ${activeQuotes[0].status}.`);
    }

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required.');

    const profile = await getProfileById(user.id);
    const preparedByName = profile?.full_name || user.email || 'Estimator';
    const preparedByTitle = profile?.role === 'admin' ? 'Administrator' : 'Estimator';

    // Auto-calculate grand totals from lines
    const subtotal_ex_vat = quoteData.lines.reduce((sum, line) => sum + (Number(line.line_total) || 0), 0);
    const discount_amount = Number(quoteData.discount_amount) || 0;
    const subtotal_after_discount = Math.max(0, subtotal_ex_vat - discount_amount);
    const vat_amount = Math.round(subtotal_after_discount * 0.05 * 100) / 100;
    const grand_total_with_vat = subtotal_after_discount + vat_amount;
    const grand_total_in_words = amountToWords(subtotal_after_discount, 'AED');

    // Create quotation header row
    const { data: newQuote, error: insertQuoteError } = await supabase
      .from('quotations')
      .insert({
        company_id: quoteData.company_id || null, // multi-company tag (Phase 0d)
        status: 'DRAFT',
        boq_id: boqId,
        project_id: boq.tender_id,
        project_ref: quoteData.project_ref || boq.tenders?.title || 'JI-REF',
        tender_ref: quoteData.tender_ref || '',
        client_id: quoteData.client_id,
        client_name: quoteData.client_name,
        client_address_line1: quoteData.client_address_line1 || '',
        client_address_line2: quoteData.client_address_line2 || '',
        client_city: quoteData.client_city || '',
        client_country: quoteData.client_country || 'UAE',
        client_contact_person: quoteData.client_contact_person || '',
        client_contact_email: quoteData.client_contact_email || '',
        client_contact_phone: quoteData.client_contact_phone || '',
        quotation_date: quoteData.quotation_date || new Date().toISOString().split('T')[0],
        valid_until: quoteData.valid_until || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        subject: quoteData.subject || '',
        scope_summary: quoteData.scope_summary || '',
        currency: 'AED',
        subtotal_ex_vat,
        discount_amount,
        subtotal_after_discount,
        vat_rate: 5.00,
        vat_amount,
        grand_total_with_vat,
        grand_total_in_words,
        payment_terms: quoteData.payment_terms || '',
        delivery_period: quoteData.delivery_period || '',
        warranty_terms: quoteData.warranty_terms || '',
        terms_and_conditions: quoteData.terms_and_conditions || '',
        exclusions: quoteData.exclusions || '',
        inclusions: quoteData.inclusions || '',
        notes_internal: quoteData.notes_internal || '',
        notes_client: quoteData.notes_client || '',
        prepared_by: user.id,
        prepared_by_name: preparedByName,
        prepared_by_title: preparedByTitle,
        is_locked: false
      })
      .select()
      .single();

    if (insertQuoteError) throw insertQuoteError;

    // Insert lines
    const linesToInsert = quoteData.lines.map((line, idx) => ({
      quotation_id: newQuote.id,
      line_number: idx + 1,
      pricing_item_id: line.pricing_item_id || null,
      item_code: line.item_code || null,
      description: line.description,
      system: line.system,
      category: line.category,
      unit: line.unit,
      quantity: line.quantity,
      unit_sell_price: line.unit_sell_price,
      discount_pct: line.discount_pct || 0,
      unit_sell_price_after_discount: line.unit_sell_price_after_discount || line.unit_sell_price,
      line_total: line.line_total || (line.quantity * line.unit_sell_price),
      vat_applicable: line.vat_applicable ?? true,
      is_optional: line.is_optional ?? false,
      notes: line.notes || '',
      sort_order: idx
    }));

    const { error: insertLinesError } = await supabase
      .from('quotation_lines')
      .insert(linesToInsert);

    if (insertLinesError) {
      // Rollback quotation row on lines failure
      await supabase.from('quotations').delete().eq('id', newQuote.id);
      throw insertLinesError;
    }

    return newQuote;
  },

  // 4. Update quotation (DRAFT only)
  async updateQuotation(id: string, quoteData: Partial<QuotationInput> & { lines?: QuotationLineInput[] }) {
    const { data: existing } = await supabase
      .from('quotations')
      .select('status, is_locked')
      .eq('id', id)
      .single();

    if (!existing) throw new Error('Quotation not found.');
    if (existing.status !== 'DRAFT' || existing.is_locked) {
      throw new Error('Only DRAFT quotations can be updated.');
    }

    // Calculations
    let totals: any = {};
    if (quoteData.lines) {
      const subtotal_ex_vat = quoteData.lines.reduce((sum, line) => sum + (Number(line.line_total) || 0), 0);
      const discount_amount = Number(quoteData.discount_amount ?? 0);
      const subtotal_after_discount = Math.max(0, subtotal_ex_vat - discount_amount);
      const vat_amount = Math.round(subtotal_after_discount * 0.05 * 100) / 100;
      const grand_total_with_vat = subtotal_after_discount + vat_amount;
      const grand_total_in_words = amountToWords(subtotal_after_discount, 'AED');

      totals = {
        subtotal_ex_vat,
        discount_amount,
        subtotal_after_discount,
        vat_amount,
        grand_total_with_vat,
        grand_total_in_words
      };
    }

    // Update Header
    const { error: headerError } = await supabase
      .from('quotations')
      .update({
        client_id: quoteData.client_id,
        client_name: quoteData.client_name,
        client_address_line1: quoteData.client_address_line1,
        client_address_line2: quoteData.client_address_line2,
        client_city: quoteData.client_city,
        client_country: quoteData.client_country,
        client_contact_person: quoteData.client_contact_person,
        client_contact_email: quoteData.client_contact_email,
        client_contact_phone: quoteData.client_contact_phone,
        quotation_date: quoteData.quotation_date,
        valid_until: quoteData.valid_until,
        subject: quoteData.subject,
        scope_summary: quoteData.scope_summary,
        payment_terms: quoteData.payment_terms,
        delivery_period: quoteData.delivery_period,
        warranty_terms: quoteData.warranty_terms,
        terms_and_conditions: quoteData.terms_and_conditions,
        exclusions: quoteData.exclusions,
        inclusions: quoteData.inclusions,
        notes_internal: quoteData.notes_internal,
        notes_client: quoteData.notes_client,
        tender_ref: quoteData.tender_ref,
        ...totals,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (headerError) throw headerError;

    // Update lines if provided (Delete and recreate)
    if (quoteData.lines) {
      const { error: deleteError } = await supabase
        .from('quotation_lines')
        .delete()
        .eq('quotation_id', id);

      if (deleteError) throw deleteError;

      const linesToInsert = quoteData.lines.map((line, idx) => ({
        quotation_id: id,
        line_number: idx + 1,
        pricing_item_id: line.pricing_item_id || null,
        item_code: line.item_code || null,
        description: line.description,
        system: line.system,
        category: line.category,
        unit: line.unit,
        quantity: line.quantity,
        unit_sell_price: line.unit_sell_price,
        discount_pct: line.discount_pct || 0,
        unit_sell_price_after_discount: line.unit_sell_price_after_discount || line.unit_sell_price,
        line_total: line.line_total || (line.quantity * line.unit_sell_price),
        vat_applicable: line.vat_applicable ?? true,
        is_optional: line.is_optional ?? false,
        notes: line.notes || '',
        sort_order: idx
      }));

      const { error: insertLinesError } = await supabase
        .from('quotation_lines')
        .insert(linesToInsert);

      if (insertLinesError) throw insertLinesError;
    }

    return true;
  },

  // 5. Submit Quotation for Commercial Review
  async submitForReview(id: string) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required.');

    const profile = await getProfileById(user.id);
    const actorName = profile?.full_name || user.email || 'Estimator';
    const actorTitle = profile?.role === 'admin' ? 'Administrator' : 'Estimator';

    // 1. Update quotation status
    const { data: quote, error: updateError } = await supabase
      .from('quotations')
      .update({ status: 'PENDING_COMMERCIAL', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 2. Log in approvals audit trail
    await supabase
      .from('quotation_approvals')
      .insert({
        quotation_id: id,
        stage: 'ESTIMATOR',
        action: 'SUBMITTED',
        actor_id: user.id,
        actor_name: actorName,
        actor_title: actorTitle,
        comment: 'Submitted for Commercial Review'
      });

    // 4. Emit event on system event bus
    await eventService.emitEvent(
      'quotation.submitted',
      'QUOTATION',
      quote.id,
      quote.project_id || undefined,
      {
        quotation_number: quote.quotation_number,
        grand_total: quote.grand_total_with_vat,
        client_name: quote.client_name,
        subject: quote.subject
      },
      user.id
    );

    return quote;
  },

  // 6. Commercial Manager Review - Approve
  async commercialApprove(id: string, comment: string) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required.');

    const profile = await getProfileById(user.id);
    const actorName = profile?.full_name || user.email || 'Commercial Manager';
    const actorTitle = 'Commercial Manager';

    // 1. Update quotation
    const { data: quote, error: updateError } = await supabase
      .from('quotations')
      .update({
        status: 'PENDING_GM',
        commercial_reviewer_id: user.id,
        commercial_reviewed_at: new Date().toISOString(),
        commercial_comment: comment,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 2. Log approval
    await supabase
      .from('quotation_approvals')
      .insert({
        quotation_id: id,
        stage: 'COMMERCIAL',
        action: 'APPROVED',
        actor_id: user.id,
        actor_name: actorName,
        actor_title: actorTitle,
        comment
      });

    // 3. Emit event on system event bus (notifies admins/GMs and creates tasks)
    await eventService.emitEvent(
      'quotation.commercial_approved',
      'QUOTATION',
      quote.id,
      quote.project_id || undefined,
      {
        quotation_number: quote.quotation_number,
        grand_total: quote.grand_total_with_vat,
        client_name: quote.client_name
      },
      user.id
    );

    return quote;
  },

  // 7. Commercial Manager Review - Return to Draft (Reject)
  async commercialReject(id: string, reason: string) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required.');

    const profile = await getProfileById(user.id);
    const actorName = profile?.full_name || user.email || 'Commercial Manager';
    const actorTitle = 'Commercial Manager';

    // 1. Return to DRAFT, record reason
    const { data: quote, error: updateError } = await supabase
      .from('quotations')
      .update({
        status: 'DRAFT',
        rejection_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 2. Log action
    await supabase
      .from('quotation_approvals')
      .insert({
        quotation_id: id,
        stage: 'COMMERCIAL',
        action: 'RETURNED',
        actor_id: user.id,
        actor_name: actorName,
        actor_title: actorTitle,
        comment: reason
      });



    // 4. Emit event on system event bus
    await eventService.emitEvent(
      'quotation.rejected',
      'QUOTATION',
      quote.id,
      quote.project_id || undefined,
      {
        quotation_number: quote.quotation_number,
        reason,
        grand_total: quote.grand_total_with_vat
      },
      user.id
    );

    return quote;
  },

  // 8. GM Approval (Signs and Approves)
  async gmApprove(id: string, comment: string, signatureRef: string) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required.');

    const profile = await getProfileById(user.id);
    const actorName = profile?.full_name || user.email || 'General Manager';
    const actorTitle = 'General Manager';

    // 1. Update status to APPROVED, lock edits, and save signature
    const { data: quote, error: updateError } = await supabase
      .from('quotations')
      .update({
        status: 'APPROVED',
        gm_approver_id: user.id,
        gm_approved_at: new Date().toISOString(),
        gm_comment: comment,
        gm_signature_ref: signatureRef,
        is_locked: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 2. Log action
    await supabase
      .from('quotation_approvals')
      .insert({
        quotation_id: id,
        stage: 'GM',
        action: 'APPROVED',
        actor_id: user.id,
        actor_name: actorName,
        actor_title: actorTitle,
        comment
      });



    // 4. Emit event on system event bus
    await eventService.emitEvent(
      'quotation.approved',
      'QUOTATION',
      quote.id,
      quote.project_id || undefined,
      {
        quotation_number: quote.quotation_number,
        grand_total: quote.grand_total_with_vat,
        client_name: quote.client_name
      },
      user.id
    );

    return quote;
  },

  // 9. GM Reject (Return to Draft)
  async gmReject(id: string, reason: string) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required.');

    const profile = await getProfileById(user.id);
    const actorName = profile?.full_name || user.email || 'General Manager';
    const actorTitle = 'General Manager';

    // 1. Return status to DRAFT, record reason
    const { data: quote, error: updateError } = await supabase
      .from('quotations')
      .update({
        status: 'DRAFT',
        rejection_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 2. Log action
    await supabase
      .from('quotation_approvals')
      .insert({
        quotation_id: id,
        stage: 'GM',
        action: 'RETURNED',
        actor_id: user.id,
        actor_name: actorName,
        actor_title: actorTitle,
        comment: reason
      });



    // 4. Emit event on system event bus
    await eventService.emitEvent(
      'quotation.rejected',
      'QUOTATION',
      quote.id,
      quote.project_id || undefined,
      {
        quotation_number: quote.quotation_number,
        reason,
        grand_total: quote.grand_total_with_vat
      },
      user.id
    );

    return quote;
  },

  // 10. Estimator Sends to Client
  async sendToClient(id: string) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required.');

    // Fetch quotation first to know its previous status for safe rollback and to get details
    const { data: quote, error: fetchErr } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchErr || !quote) throw new Error(`Quotation not found: ${fetchErr?.message || ''}`);

    const originalStatus = quote.status;

    // 1. Update status to SENT_TO_CLIENT
    const { data: updatedQuote, error: updateError } = await supabase
      .from('quotations')
      .update({
        status: 'SENT_TO_CLIENT',
        sent_to_client_at: new Date().toISOString(),
        sent_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    try {
      // 2. Guard: check if a project already exists for this tender opportunity chain
      const { data: existingProject, error: projectFetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('tender_id', quote.project_id)
        .eq('is_active', true)
        .maybeSingle();

      if (projectFetchError) throw projectFetchError;

      let projectId: string;

      if (existingProject) {
        projectId = existingProject.id;
        
        // Link this quotation revision (and all revisions) to the existing project
        const { error: linkQuoteError } = await supabase
          .from('quotations')
          .update({ actual_project_id: projectId })
          .eq('quotation_number', quote.quotation_number);
        
        if (linkQuoteError) throw linkQuoteError;
      } else {
        // Create new project
        // A. Generate unique project number
        const projectNumber = await generateProjectNumber();

        // B. Fetch unique systems from quotation lines
        const { data: lines } = await supabase
          .from('quotation_lines')
          .select('system')
          .eq('quotation_id', id);

        const systemsSet = new Set<string>();
        if (lines) {
          lines.forEach(l => {
            if (l.system) systemsSet.add(l.system);
          });
        }
        const systemsArray = Array.from(systemsSet);

        // C. Fetch client details to get city/emirate
        const { data: client } = await supabase
          .from('clients')
          .select('city')
          .eq('id', quote.client_id)
          .single();

        let clientEmirate: any = 'DUBAI';
        if (client?.city) {
          const cityUpper = client.city.toUpperCase().replace(/\s+/g, '_');
          const validEmirates = ['DUBAI', 'ABU_DHABI', 'SHARJAH', 'AJMAN', 'UMM_AL_QUWAIN', 'RAS_AL_KHAIMAH', 'FUJAIRAH'];
          if (validEmirates.includes(cityUpper)) {
            clientEmirate = cityUpper;
          }
        }

        // C2. Import the target/budget cost from the linked BOQ (direct + indirect)
        let budgetCost = 0;
        if (quote.boq_id) {
          const { data: boq } = await supabase
            .from('boqs')
            .select('financials')
            .eq('id', quote.boq_id)
            .maybeSingle();
          const fin = (boq?.financials || {}) as any;
          budgetCost = Number(fin.direct_total || 0) + Number(fin.indirect_total || 0);
          if (budgetCost <= 0 && fin.total_selling_price) {
            budgetCost = Number(fin.total_selling_price || 0) - Number(fin.profit_value || 0);
          }
        }

        // D. Insert projects row
        const { data: newProject, error: projectCreateError } = await supabase
          .from('projects')
          .insert({
            project_number: projectNumber,
            name: quote.subject || `Project for ${quote.client_name}`,
            client_id: quote.client_id,
            client_name: quote.client_name,
            site_address: quote.client_address_line1 || '',
            emirate: clientEmirate,
            project_type: 'SUPPLY_INSTALL', // Default type
            systems: systemsArray,
            tender_id: quote.project_id, // quotation.project_id is the tender ID
            boq_id: quote.boq_id,
            quotation_id: id,
            contract_value: 0, // pre-award contract values remain zero/empty
            original_contract_value: 0,
            budget_cost: Math.round(budgetCost * 100) / 100, // Target cost from BOQ
            status: 'SUBMITTED', // Created in SUBMITTED stage
            sira_applicable: systemsArray.includes('CCTV') || systemsArray.includes('ACCESS_CONTROL'),
            created_by: user.id,
            is_active: true
          })
          .select()
          .single();

        if (projectCreateError) throw projectCreateError;
        projectId = newProject.id;

        // E. Create project status history
        const { error: historyError } = await supabase
          .from('project_status_history')
          .insert({
            project_id: projectId,
            from_status: 'NONE',
            to_status: 'SUBMITTED',
            comment: `Project auto-created on Quotation sent (${quote.quotation_number})`,
            changed_by: user.id
          });
        
        if (historyError) throw historyError;

        // F. Link primary contact from Client info
        if (quote.client_contact_person) {
          const { error: contactError } = await supabase
            .from('project_contacts')
            .insert({
              project_id: projectId,
              name: quote.client_contact_person,
              role: 'CLIENT_REP',
              email: quote.client_contact_email || '',
              phone: quote.client_contact_phone || '',
              is_primary: true
            });
          if (contactError) throw contactError;
        }

        // G. Back-link all pre-existing records:
        // Update tenders
        const { error: tenderUpdateError } = await supabase
          .from('tenders')
          .update({ project_id: projectId })
          .eq('id', quote.project_id);
        if (tenderUpdateError) throw tenderUpdateError;

        // Update boqs
        const { error: boqUpdateError } = await supabase
          .from('boqs')
          .update({ project_id: projectId })
          .eq('id', quote.boq_id);
        if (boqUpdateError) throw boqUpdateError;

        // Update tender_documents
        const { error: tenderDocsUpdateError } = await supabase
          .from('tender_documents')
          .update({ project_id: projectId })
          .eq('tender_id', quote.project_id);
        if (tenderDocsUpdateError) throw tenderDocsUpdateError;

        // Update quotations in revision chain
        const { error: quoteUpdateError } = await supabase
          .from('quotations')
          .update({ actual_project_id: projectId })
          .eq('quotation_number', quote.quotation_number);
        if (quoteUpdateError) throw quoteUpdateError;

        // Update supplier comparisons
        const { error: compUpdateError } = await supabase
          .from('supplier_comparisons')
          .update({ actual_project_id: projectId })
          .eq('project_id', quote.project_id);
        if (compUpdateError) throw compUpdateError;

        // Update pre-existing DMS documents (from tenders, boqs, or quotations)
        const { error: docsUpdateError } = await supabase
          .from('documents')
          .update({ entity_type: 'PROJECT', entity_id: projectId })
          .eq('entity_type', 'PROJECT')
          .in('entity_id', [quote.project_id, quote.boq_id, quote.id]);
        if (docsUpdateError) throw docsUpdateError;
      }

      // Emit send event
      await eventService.emitEvent(
        'quotation.sent_to_client',
        'QUOTATION',
        updatedQuote.id,
        projectId,
        {
          quotation_number: updatedQuote.quotation_number,
          grand_total: updatedQuote.grand_total_with_vat,
          client_name: updatedQuote.client_name,
          subject: updatedQuote.subject
        },
        user.id
      );

      return updatedQuote;

    } catch (err) {
      // Rollback quotation status on failure!
      await supabase
        .from('quotations')
        .update({
          status: originalStatus,
          sent_to_client_at: quote.sent_to_client_at,
          sent_by: quote.sent_by,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      logger.error('Error during sendToClient transactional project creation:', err);
      throw err;
    }
  },

  // 11. Client Accepted
  /**
   * Returns the project this quotation belongs to (via linked_project_id, or
   * the legacy project.quotation_id link), or null if none yet.
   */
  async getLinkedProject(quotationId: string): Promise<{ id: string; project_number: string } | null> {
    // Prefer the explicit link
    const { data: q } = await supabase
      .from('quotations')
      .select('linked_project_id')
      .eq('id', quotationId)
      .maybeSingle();
    const linkedId = (q as any)?.linked_project_id;
    if (linkedId) {
      const { data: p } = await supabase
        .from('projects').select('id, project_number').eq('id', linkedId).maybeSingle();
      if (p) return p as any;
    }
    // Fall back to a project that was created from this quotation
    const { data: byOrigin } = await supabase
      .from('projects')
      .select('id, project_number')
      .eq('quotation_id', quotationId)
      .maybeSingle();
    return (byOrigin as any) || null;
  },

  /** Associates a quotation with an existing project (many quotations → one project). */
  async linkToProject(quotationId: string, projectId: string): Promise<void> {
    const { error } = await supabase
      .from('quotations')
      .update({ linked_project_id: projectId, updated_at: new Date().toISOString() })
      .eq('id', quotationId);
    if (error) throw error;

    await recordAudit({
      action: 'UPDATE', entity_type: 'QUOTATION', entity_id: quotationId,
      entity_label: quotationId, summary: `Quotation linked to project ${projectId}`,
      module: 'QUOTATION',
    }).catch(() => {});
  },

  async markAccepted(id: string, poNumber: string) {
    // 1. Update status to ACCEPTED
    const { data: quote, error: updateError } = await supabase
      .from('quotations')
      .update({
        status: 'ACCEPTED',
        client_po_number: poNumber,
        client_responded_at: new Date().toISOString(),
        client_response: 'ACCEPTED',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 2. Increment usage count for all catalog pricing items referenced in the lines
    const { data: lines } = await supabase
      .from('quotation_lines')
      .select('pricing_item_id')
      .eq('quotation_id', id);

    if (lines && lines.length > 0) {
      const itemsToIncrement = lines
        .map(l => l.pricing_item_id)
        .filter(Boolean) as string[];

      for (const itemId of itemsToIncrement) {
        // Fetch current count
        const { data: item } = await supabase
          .from('pricing_items')
          .select('usage_count')
          .eq('id', itemId)
          .single();
        
        if (item) {
          const currentCount = item.usage_count || 0;
          await supabase
            .from('pricing_items')
            .update({ usage_count: currentCount + 1 })
            .eq('id', itemId);
        }
      }
    }

    // 3. SUBMITTED -> MOBILIZATION transition (fills commercial terms on the existing project)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('tender_id', quote.project_id)
      .eq('is_active', true)
      .maybeSingle();

    if (projectError) throw projectError;

    if (project) {
      // Update project with commercial terms and status
      const { error: projectUpdateError } = await supabase
        .from('projects')
        .update({
          contract_value: quote.subtotal_after_discount || 0,
          original_contract_value: quote.subtotal_after_discount || 0,
          client_lpo_number: poNumber,
          client_lpo_date: new Date().toISOString().split('T')[0],
          payment_terms: quote.payment_terms || '',
          start_date: new Date().toISOString().split('T')[0],
          status: 'MOBILIZATION',
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id);

      if (projectUpdateError) throw projectUpdateError;

      const user = (await supabase.auth.getUser()).data.user;

      // Log status transition in history
      await supabase.from('project_status_history').insert({
        project_id: project.id,
        from_status: 'SUBMITTED',
        to_status: 'MOBILIZATION',
        comment: `Project status advanced to MOBILIZATION upon quotation acceptance (${quote.quotation_number})`,
        changed_by: user?.id || quote.prepared_by
      });

      // Insert default milestones if they do not exist
      const { data: existingMilestones } = await supabase
        .from('project_milestones')
        .select('id')
        .eq('project_id', project.id);

      if (!existingMilestones || existingMilestones.length === 0) {
        const defaultMilestones = [
          { title: 'Mobilization & Material Submittal', sort_order: 1, payment_linked: false },
          { title: 'First Fix Installation & Conduit Piping', sort_order: 2, payment_linked: true, payment_pct: 30 },
          { title: 'Second Fix Cable Pulling & Device Fitting', sort_order: 3, payment_linked: true, payment_pct: 40 },
          { title: 'Testing, Commissioning & SIRA Inspection', sort_order: 4, payment_linked: true, payment_pct: 20 },
          { title: 'Handover & Training', sort_order: 5, payment_linked: true, payment_pct: 10 }
        ];
        const milestonesToInsert = defaultMilestones.map(m => ({
          project_id: project.id,
          title: m.title,
          sort_order: m.sort_order,
          status: 'PENDING',
          payment_linked: m.payment_linked,
          payment_pct: m.payment_pct || null
        }));
        await supabase.from('project_milestones').insert(milestonesToInsert);
      }

      // Link contact if not exists
      if (quote.client_contact_person) {
        const { data: existingContacts } = await supabase
          .from('project_contacts')
          .select('id')
          .eq('project_id', project.id);

        if (!existingContacts || existingContacts.length === 0) {
          await supabase.from('project_contacts').insert({
            project_id: project.id,
            name: quote.client_contact_person,
            role: 'CLIENT_REP',
            email: quote.client_contact_email || '',
            phone: quote.client_contact_phone || '',
            is_primary: true
          });
        }
      }
    }

    // 4. Emit event on system event bus
    await eventService.emitEvent(
      'quotation.accepted_by_client',
      'QUOTATION',
      quote.id,
      project ? project.id : (quote.project_id || undefined),
      {
        quotation_number: quote.quotation_number,
        grand_total: quote.grand_total_with_vat,
        client_name: quote.client_name,
        client_po_number: poNumber
      }
    );

    // 5. Update tender/project status to 'Completed' (or another status if applicable)
    await supabase
      .from('tenders')
      .update({ status: 'Completed', updated_at: new Date().toISOString() })
      .eq('id', quote.project_id);

    return quote;
  },

  // 12. Client Rejected
  async markRejected(id: string, reason: string) {
    // 1. Update status
    const { data: quote, error: updateError } = await supabase
      .from('quotations')
      .update({
        status: 'REJECTED',
        rejection_reason: reason,
        client_responded_at: new Date().toISOString(),
        client_response: 'REJECTED',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Transition project to LOST if it exists
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('tender_id', quote.project_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!projectError && project) {
      await supabase
        .from('projects')
        .update({
          status: 'LOST',
          cancel_reason: reason || 'Quotation rejected by client',
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id);

      const user = (await supabase.auth.getUser()).data.user;
      await supabase.from('project_status_history').insert({
        project_id: project.id,
        from_status: project.status,
        to_status: 'LOST',
        comment: `Project status set to LOST upon quotation rejection: ${reason || 'Rejected by client'}`,
        changed_by: user?.id || quote.prepared_by
      });
    }

    // 2. Emit event on system event bus (notifies stakeholders of client rejection)
    const user = (await supabase.auth.getUser()).data.user;
    await eventService.emitEvent(
      'quotation.rejected',
      'QUOTATION',
      quote.id,
      project ? project.id : (quote.project_id || undefined),
      {
        quotation_number: quote.quotation_number,
        reason: reason || 'Rejected by client',
        approver_name: 'Client'
      },
      user?.id
    );

    return quote;
  },

  // 13. Create Revision (creates incremented quotation, supersedes old one)
  async createRevision(id: string) {
    // A. Fetch old quotation header and lines
    const oldQuoteDetails = await this.fetchQuotationById(id);
    if (!oldQuoteDetails) throw new Error('Quotation not found.');

    if (oldQuoteDetails.status === 'SUPERSEDED' || oldQuoteDetails.status === 'REVISED') {
      throw new Error('This quotation revision has already been superseded or revised.');
    }

    const nextRevNum = oldQuoteDetails.revision + 1;
    const nextRevLabel = `Rev.${nextRevNum}`;

    // B. Mark old quotation as SUPERSEDED and lock it
    const { error: supersedeError } = await supabase
      .from('quotations')
      .update({
        status: 'SUPERSEDED',
        is_locked: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (supersedeError) throw supersedeError;

    // C. Create new quotation record copying all old fields with incremented revision
    const { data: newQuote, error: insertError } = await supabase
      .from('quotations')
      .insert({
        quotation_number: oldQuoteDetails.quotation_number,
        revision: nextRevNum,
        revision_label: nextRevLabel,
        status: 'DRAFT',
        boq_id: oldQuoteDetails.boq_id,
        project_id: oldQuoteDetails.project_id,
        project_ref: oldQuoteDetails.project_ref,
        tender_ref: oldQuoteDetails.tender_ref,
        previous_quotation_id: id,
        client_id: oldQuoteDetails.client_id,
        client_name: oldQuoteDetails.client_name,
        client_address_line1: oldQuoteDetails.client_address_line1,
        client_address_line2: oldQuoteDetails.client_address_line2,
        client_city: oldQuoteDetails.client_city,
        client_country: oldQuoteDetails.client_country,
        client_contact_person: oldQuoteDetails.client_contact_person,
        client_contact_email: oldQuoteDetails.client_contact_email,
        client_contact_phone: oldQuoteDetails.client_contact_phone,
        quotation_date: new Date().toISOString().split('T')[0],
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        subject: oldQuoteDetails.subject,
        scope_summary: oldQuoteDetails.scope_summary,
        currency: oldQuoteDetails.currency,
        subtotal_ex_vat: oldQuoteDetails.subtotal_ex_vat,
        discount_amount: oldQuoteDetails.discount_amount,
        subtotal_after_discount: oldQuoteDetails.subtotal_after_discount,
        vat_rate: oldQuoteDetails.vat_rate,
        vat_amount: oldQuoteDetails.vat_amount,
        grand_total_with_vat: oldQuoteDetails.grand_total_with_vat,
        grand_total_in_words: oldQuoteDetails.grand_total_in_words,
        payment_terms: oldQuoteDetails.payment_terms,
        delivery_period: oldQuoteDetails.delivery_period,
        warranty_terms: oldQuoteDetails.warranty_terms,
        terms_and_conditions: oldQuoteDetails.terms_and_conditions,
        exclusions: oldQuoteDetails.exclusions,
        inclusions: oldQuoteDetails.inclusions,
        notes_internal: oldQuoteDetails.notes_internal,
        notes_client: oldQuoteDetails.notes_client,
        prepared_by: oldQuoteDetails.prepared_by,
        prepared_by_name: oldQuoteDetails.prepared_by_name,
        prepared_by_title: oldQuoteDetails.prepared_by_title,
        is_locked: false
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // D. Copy all old lines onto the new quotation revision
    const linesToInsert = oldQuoteDetails.lines.map((line: any) => ({
      quotation_id: newQuote.id,
      line_number: line.line_number,
      pricing_item_id: line.pricing_item_id,
      item_code: line.item_code,
      description: line.description,
      system: line.system,
      category: line.category,
      unit: line.unit,
      quantity: line.quantity,
      unit_sell_price: line.unit_sell_price,
      discount_pct: line.discount_pct,
      unit_sell_price_after_discount: line.unit_sell_price_after_discount,
      line_total: line.line_total,
      vat_applicable: line.vat_applicable,
      is_optional: line.is_optional,
      notes: line.notes,
      sort_order: line.sort_order
    }));

    const { error: linesError } = await supabase
      .from('quotation_lines')
      .insert(linesToInsert);

    if (linesError) {
      // Clean up and delete partial quote row
      await supabase.from('quotations').delete().eq('id', newQuote.id);
      throw linesError;
    }

    return newQuote.id;
  }
};
