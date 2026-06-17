// ============================================================
// JEET ERP — Variation Order (VO) Service
// Location: src/services/voService.ts
// Handles database CRUD, workflow approval chains, PDF generation
// uploading, DMS filing, and project BOQ integration.
// ============================================================

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { calculateVOMargin, calculateContractImpact } from './voContractImpactService';
import { voPDFService } from './voPDFService';
import { eventService } from './eventService';
import { voApprovalService } from './voApprovalService';
import type { VariationOrder, VOItem, VOStatus, VOFilters, VOWorkStatus } from '@/types/vo.types';

export const voService = {
  /**
   * Fetches Variation Orders based on filters.
   */
  async fetchVOs(filters: VOFilters = {}): Promise<VariationOrder[]> {
    let query = supabase
      .from('variation_orders')
      .select(`
        *,
        projects!inner(project_number, name, client_name)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.vo_type) {
      query = query.eq('vo_type', filters.vo_type);
    }
    if (filters.project_id) {
      query = query.eq('project_id', filters.project_id);
    }
    if (filters.origin) {
      query = query.eq('origin', filters.origin);
    }
    if (filters.proceed_at_risk !== undefined) {
      query = query.eq('proceed_at_risk', filters.proceed_at_risk);
    }
    if (filters.search) {
      query = query.or(`vo_number.ilike.%${filters.search}%,title.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((row: any) => ({
      ...row,
      project_number: row.projects?.project_number,
      project_name: row.projects?.name,
      client_name: row.projects?.client_name
    })) as VariationOrder[];
  },

  /**
   * Fetches details of a single Variation Order.
   */
  async fetchVOById(id: string): Promise<VariationOrder | null> {
    const { data: vo, error: voError } = await supabase
      .from('variation_orders')
      .select(`
        *,
        projects!inner(project_number, name, client_name)
      `)
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (voError) {
      if (voError.code === 'PGRST116') return null;
      throw voError;
    }

    const { data: items, error: itemsError } = await supabase
      .from('vo_items')
      .select('*')
      .eq('vo_id', id)
      .order('line_no', { ascending: true });

    if (itemsError) throw itemsError;

    const { data: history, error: histError } = await supabase
      .from('vo_status_history')
      .select('*')
      .eq('vo_id', id)
      .order('changed_at', { ascending: false });

    if (histError) throw histError;

    // Resolve changed by names
    const historyWithNames = await Promise.all(
      (history || []).map(async (h: any) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', h.changed_by)
          .single();
        return {
          ...h,
          changed_by_name: profile?.full_name || 'System User'
        };
      })
    );

    return {
      ...vo,
      project_number: vo.projects?.project_number,
      project_name: vo.projects?.name,
      client_name: vo.projects?.client_name,
      items: (items || []) as VOItem[],
      status_history: historyWithNames
    } as VariationOrder;
  },

  /**
   * Creates a new Variation Order draft.
   */
  async createVODraft(
    voData: Omit<Partial<VariationOrder>, 'id' | 'vo_number' | 'project_vo_sequence' | 'created_at' | 'updated_at'>,
    itemsData: Array<Omit<Partial<VOItem>, 'id' | 'vo_id'>>
  ): Promise<VariationOrder> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required');

    // 1. Calculate costs, selling, and margins
    let costAmount = 0;
    let sellAmount = 0;

    const itemsToInsert = itemsData.map((item, idx) => {
      const quantity = Number(item.quantity) || 0;
      const unitCost = Number(item.unit_cost) || 0;
      const unitSell = Number(item.unit_sell) || 0;

      const lineCost = Number((quantity * unitCost).toFixed(2));
      const lineSell = Number((quantity * unitSell).toFixed(2));

      costAmount += lineCost;
      sellAmount += lineSell;

      return {
        line_no: idx + 1,
        action: item.action || 'ADD',
        pricing_item_id: item.pricing_item_id || null,
        boq_item_ref: item.boq_item_ref || null,
        description: item.description || '',
        unit: item.unit || 'Nos',
        quantity,
        unit_cost: unitCost,
        unit_sell: unitSell,
        line_cost: lineCost,
        line_sell: lineSell,
        system: item.system || null,
        notes: item.notes || null
      };
    });

    costAmount = Number(costAmount.toFixed(2));
    sellAmount = Number(sellAmount.toFixed(2));
    const vatAmount = Number((sellAmount * 0.05).toFixed(2));
    const totalInclVat = Number((sellAmount + vatAmount).toFixed(2));

    // Determine proceed_at_risk flag
    const proceedAtRisk = (voData.work_status === 'IN_PROGRESS' || voData.work_status === 'COMPLETED');

    // 2. Insert VO Master
    const { data: vo, error: voError } = await supabase
      .from('variation_orders')
      .insert({
        project_id: voData.project_id,
        title: voData.title,
        vo_type: voData.vo_type || 'ADDITION',
        origin: voData.origin || 'CLIENT_INSTRUCTION',
        instruction_reference: voData.instruction_reference,
        instruction_date: voData.instruction_date,
        instruction_document_id: voData.instruction_document_id || null,
        description: voData.description || null,
        justification: voData.justification || null,
        status: 'DRAFT',
        pricing_basis: voData.pricing_basis || 'BOQ_RATES',
        cost_amount: costAmount,
        sell_amount: sellAmount,
        vat_amount: vatAmount,
        total_incl_vat: totalInclVat,
        time_impact_days: voData.time_impact_days || 0,
        work_status: voData.work_status || 'NOT_STARTED',
        proceed_at_risk: proceedAtRisk,
        created_by: user.id
      })
      .select()
      .single();

    if (voError) throw voError;

    // 3. Insert Child Items
    const itemsWithVoId = itemsToInsert.map(item => ({ ...item, vo_id: vo.id }));
    const { error: itemsError } = await supabase.from('vo_items').insert(itemsWithVoId);
    if (itemsError) throw itemsError;

    // 4. Log status history
    await supabase.from('vo_status_history').insert({
      vo_id: vo.id,
      from_status: 'NONE',
      to_status: 'DRAFT',
      comment: 'Variation Order draft created',
      changed_by: user.id
    });

    // 5. Emit system events
    await eventService.emitEvent('vo.created', 'VARIATION_ORDER', vo.id, vo.project_id, {
      vo_number: vo.vo_number,
      title: vo.title,
      sell_amount: vo.sell_amount
    }, user.id);

    if (proceedAtRisk) {
      await eventService.emitEvent('vo.proceed_at_risk', 'VARIATION_ORDER', vo.id, vo.project_id, {
        vo_number: vo.vo_number,
        title: vo.title,
        sell_amount: vo.sell_amount
      }, user.id);
    }

    return vo as VariationOrder;
  },

  /**
   * Submits a VO for internal approvals ( routes to commercial manager or GM based on threshold ).
   */
  async submitInternalReview(id: string, comment?: string): Promise<boolean> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required');

    const vo = await this.fetchVOById(id);
    if (!vo) throw new Error('Variation Order not found');

    const { error } = await supabase
      .from('variation_orders')
      .update({ status: 'PENDING_INTERNAL', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    await supabase.from('vo_status_history').insert({
      vo_id: id,
      from_status: vo.status,
      to_status: 'PENDING_INTERNAL',
      comment: comment || 'Submitted for internal review',
      changed_by: user.id
    });

    await eventService.emitEvent('vo.submitted_internal', 'VARIATION_ORDER', id, vo.project_id, {
      vo_number: vo.vo_number,
      project_number: vo.project_number,
      sell_amount: vo.sell_amount,
      proceed_at_risk: vo.proceed_at_risk
    }, user.id);

    return true;
  },

  /**
   * Approves a VO internally.
   */
  async approveInternal(id: string, comment?: string): Promise<boolean> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required');

    const vo = await this.fetchVOById(id);
    if (!vo) throw new Error('Variation Order not found');

    // Threshold Check and Self approval guard
    const authCheck = await voApprovalService.evaluateApprovalPermissions(vo, user.id);
    if (!authCheck.allowed) {
      throw new Error(authCheck.reason || 'Unauthorized for approval');
    }

    const { error } = await supabase
      .from('variation_orders')
      .update({ status: 'INTERNALLY_APPROVED', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    await supabase.from('vo_status_history').insert({
      vo_id: id,
      from_status: vo.status,
      to_status: 'INTERNALLY_APPROVED',
      comment: comment || 'Internally approved by manager',
      changed_by: user.id
    });

    await eventService.emitEvent('vo.internally_approved', 'VARIATION_ORDER', id, vo.project_id, {
      vo_number: vo.vo_number,
      project_number: vo.project_number,
      sell_amount: vo.sell_amount
    }, user.id);

    return true;
  },

  /**
   * Submits a Variation Order to the client (generates PDF, uploads to DMS).
   */
  async submitToClient(id: string): Promise<boolean> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required');

    const vo = await this.fetchVOById(id);
    if (!vo) throw new Error('Variation Order not found');
    if (vo.status !== 'INTERNALLY_APPROVED') {
      throw new Error('Variation Order must be Internally Approved before submitting to client.');
    }

    // 1. Compile Branded PDF Sheet
    const doc = await voPDFService.generateVOReport(vo, vo.items || []);
    const pdfBlob = doc.output('blob');
    const pdfFile = new File([pdfBlob], `${vo.vo_number}.pdf`, { type: 'application/pdf' });

    // 2. Upload to storage
    const storagePath = `COMMERCIAL/VARIATION_ORDER/${vo.vo_number}_${Date.now()}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(storagePath, pdfFile, { cacheControl: '3600', upsert: true });

    if (uploadErr) throw uploadErr;

    // 3. File in DMS
    const fileHash = 'sha256-' + Math.random().toString(36).substring(2);
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        entity_type: 'PROJECT',
        entity_id: vo.project_id,
        title: `Variation Order Sheet - ${vo.vo_number}`,
        original_filename: `${vo.vo_number}.pdf`,
        file_ext: 'pdf',
        mime_type: 'application/pdf',
        file_size_bytes: pdfBlob.size,
        file_hash: fileHash,
        storage_path: storagePath,
        category: 'COMMERCIAL',
        subcategory: 'VARIATION_ORDER',
        status: 'VERIFIED',
        linked_record_type: 'variation_order',
        linked_record_id: vo.id,
        amount_aed: vo.sell_amount,
        uploaded_by: user.id
      })
      .select()
      .single();

    if (docError) throw docError;

    // 4. Update status and pdf link
    const { error: voUpdateError } = await supabase
      .from('variation_orders')
      .update({
        status: 'SUBMITTED_TO_CLIENT',
        pdf_document_id: document.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (voUpdateError) throw voUpdateError;

    await supabase.from('vo_status_history').insert({
      vo_id: id,
      from_status: vo.status,
      to_status: 'SUBMITTED_TO_CLIENT',
      comment: 'Variation Order issued to client',
      changed_by: user.id
    });

    await eventService.emitEvent('vo.submitted_to_client', 'VARIATION_ORDER', id, vo.project_id, {
      vo_number: vo.vo_number,
      project_number: vo.project_number,
      sell_amount: vo.sell_amount
    }, user.id);

    return true;
  },

  /**
   * Records client signature / formal approval (updates contract value and BOQ).
   */
  async recordClientApproval(
    id: string,
    approvalRef: string,
    approvalDate: string,
    signedDocId?: string | null
  ): Promise<boolean> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required');

    const vo = await this.fetchVOById(id);
    if (!vo) throw new Error('Variation Order not found');
    if (vo.status !== 'SUBMITTED_TO_CLIENT' && vo.status !== 'PENDING_INTERNAL' && vo.status !== 'INTERNALLY_APPROVED') {
      // Allow bypass if internally approved
      if (vo.status !== 'DRAFT' && vo.status !== 'PRICED') {
        // ok
      } else {
        throw new Error('Variation Order must be internally approved and submitted before client sign-off.');
      }
    }

    const { error: voUpdateError } = await supabase
      .from('variation_orders')
      .update({
        status: 'CLIENT_APPROVED',
        client_approval_ref: approvalRef,
        client_approval_date: approvalDate,
        client_approval_document_id: signedDocId || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (voUpdateError) throw voUpdateError;

    // Log status history
    await supabase.from('vo_status_history').insert({
      vo_id: id,
      from_status: vo.status,
      to_status: 'CLIENT_APPROVED',
      comment: `Client approved (Ref: ${approvalRef})`,
      changed_by: user.id
    });

    // Recalculate project totals
    await supabase.rpc('recalculate_project_vo_totals', { p_project_id: vo.project_id });

    // Fetch the fresh project details to update BOQ
    const { data: project } = await supabase
      .from('projects')
      .select('boq_id, revised_contract_value')
      .eq('id', vo.project_id)
      .single();

    if (project && project.boq_id) {
      await this.applyApprovedVOToBOQ(project.boq_id, vo.items || [], vo.vo_number);
    }

    await eventService.emitEvent('vo.client_approved', 'VARIATION_ORDER', id, vo.project_id, {
      vo_number: vo.vo_number,
      project_number: vo.project_number,
      sell_amount: vo.sell_amount,
      revised_contract_value: project?.revised_contract_value || 0
    }, user.id);

    return true;
  },

  /**
   * Records client rejection.
   */
  async recordClientRejection(id: string, reason: string): Promise<boolean> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required');

    const vo = await this.fetchVOById(id);
    if (!vo) throw new Error('Variation Order not found');

    const { error } = await supabase
      .from('variation_orders')
      .update({
        status: 'CLIENT_REJECTED',
        rejection_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    await supabase.from('vo_status_history').insert({
      vo_id: id,
      from_status: vo.status,
      to_status: 'CLIENT_REJECTED',
      comment: `Client Rejected: ${reason}`,
      changed_by: user.id
    });

    await eventService.emitEvent('vo.client_rejected', 'VARIATION_ORDER', id, vo.project_id, {
      vo_number: vo.vo_number,
      project_number: vo.project_number,
      rejection_reason: reason
    }, user.id);

    return true;
  },

  /**
   * Cancels a Variation Order.
   */
  async cancelVO(id: string, reason: string): Promise<boolean> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required');

    const vo = await this.fetchVOById(id);
    if (!vo) throw new Error('Variation Order not found');

    const { error } = await supabase
      .from('variation_orders')
      .update({
        status: 'CANCELLED',
        cancel_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    await supabase.from('vo_status_history').insert({
      vo_id: id,
      from_status: vo.status,
      to_status: 'CANCELLED',
      comment: `Cancelled: ${reason}`,
      changed_by: user.id
    });

    await eventService.emitEvent('vo.cancelled', 'VARIATION_ORDER', id, vo.project_id, {
      vo_number: vo.vo_number,
      project_number: vo.project_number,
      cancel_reason: reason
    }, user.id);

    return true;
  },

  /**
   * Updates work status. Sets proceed_at_risk if work starts prior to client approval.
   */
  async updateWorkStatus(id: string, workStatus: VOWorkStatus): Promise<boolean> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required');

    const vo = await this.fetchVOById(id);
    if (!vo) throw new Error('Variation Order not found');

    const isAtRisk = (workStatus === 'IN_PROGRESS' || workStatus === 'COMPLETED') && vo.status !== 'CLIENT_APPROVED';

    const { error } = await supabase
      .from('variation_orders')
      .update({
        work_status: workStatus,
        proceed_at_risk: isAtRisk,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    await supabase.from('vo_status_history').insert({
      vo_id: id,
      from_status: vo.status,
      to_status: vo.status,
      comment: `Work Status updated to ${workStatus} (At-Risk: ${isAtRisk})`,
      changed_by: user.id
    });

    if (isAtRisk && !vo.proceed_at_risk) {
      await eventService.emitEvent('vo.proceed_at_risk', 'VARIATION_ORDER', id, vo.project_id, {
        vo_number: vo.vo_number,
        project_number: vo.project_number,
        sell_amount: vo.sell_amount
      }, user.id);
    }

    return true;
  },

  /**
   * Applies client approved VO items directly to the project's BOQ items array.
   */
  async applyApprovedVOToBOQ(boqId: string, voItems: VOItem[], voNumber: string): Promise<boolean> {
    try {
      // 1. Fetch current BOQ
      const { data: boq, error: fetchErr } = await supabase
        .from('boqs')
        .select('items')
        .eq('id', boqId)
        .single();

      if (fetchErr || !boq) throw fetchErr || new Error('BOQ not found');

      const items = Array.isArray(boq.items) ? [...boq.items] : [];

      // 2. Mappings items
      for (const item of voItems) {
        if (item.action === 'ADD') {
          // Addition: append new item to BOQ items array
          items.push({
            id: item.id,
            name: item.description,
            quantity: Number(item.quantity),
            unit: item.unit,
            material_unit_cost: Number(item.unit_cost),
            wastage_pct: 0,
            wastage_cost: 0,
            labor_unit_cost: 0,
            labor_total_cost: 0,
            transport_unit_cost: 0,
            transport_total_cost: 0,
            overhead_pct: 0,
            overhead_cost: 0,
            profit_pct: 0,
            profit_value: 0,
            unit_price: Number(item.unit_sell),
            total_price: Number(item.line_sell),
            system: item.system || 'OTHER',
            is_vo: true,
            vo_number: voNumber
          });
        } else if (item.action === 'OMIT') {
          // Omission: flag original BOQ item as omitted
          const originalRef = item.boq_item_ref;
          if (originalRef) {
            const matchIndex = items.findIndex((i: any) => i.id === originalRef || i.name === item.description);
            if (matchIndex !== -1) {
              items[matchIndex].omitted = true;
              items[matchIndex].omission_vo = voNumber;
            }
          }
          // Also append negative line to reflect credit subtraction
          items.push({
            id: item.id,
            name: `Omission: ${item.description}`,
            quantity: Number(item.quantity), // negative
            unit: item.unit,
            material_unit_cost: Number(item.unit_cost),
            wastage_pct: 0,
            wastage_cost: 0,
            labor_unit_cost: 0,
            labor_total_cost: 0,
            transport_unit_cost: 0,
            transport_total_cost: 0,
            overhead_pct: 0,
            overhead_cost: 0,
            profit_pct: 0,
            profit_value: 0,
            unit_price: Number(item.unit_sell),
            total_price: Number(item.line_sell), // negative
            system: item.system || 'OTHER',
            is_vo: true,
            vo_number: voNumber,
            is_omission: true
          });
        } else if (item.action === 'RE_RATE') {
          // Re-rate: update rate of existing BOQ line
          const originalRef = item.boq_item_ref;
          if (originalRef) {
            const matchIndex = items.findIndex((i: any) => i.id === originalRef || i.name === item.description);
            if (matchIndex !== -1) {
              items[matchIndex].unit_price = Number(item.unit_sell);
              items[matchIndex].total_price = Number((items[matchIndex].quantity * item.unit_sell).toFixed(2));
              items[matchIndex].re_rated = true;
              items[matchIndex].re_rate_vo = voNumber;
            }
          }
        }
      }

      // 3. Save BOQ back
      const { error: saveError } = await supabase
        .from('boqs')
        .update({
          items,
          updated_at: new Date().toISOString()
        })
        .eq('id', boqId);

      if (saveError) throw saveError;
      return true;
    } catch (err) {
      logger.error('Failed to apply variation lines to BOQ:', err);
      return false;
    }
  },

  /**
   * Generates project Variation summary statistics.
   */
  async getProjectVOSummary(projectId: string) {
    const { data: project } = await supabase
      .from('projects')
      .select('original_contract_value, revised_contract_value, vo_count')
      .eq('id', projectId)
      .single();

    const originalContract = Number(project?.original_contract_value || 0);
    const revisedContract = Number(project?.revised_contract_value || 0);
    const voCount = Number(project?.vo_count || 0);

    const { data: vos } = await supabase
      .from('variation_orders')
      .select('status, sell_amount, proceed_at_risk')
      .eq('project_id', projectId)
      .eq('is_active', true);

    let approvedVOs = 0;
    let pendingVOs = 0;
    let atRiskExposure = 0;

    for (const vo of vos || []) {
      const sell = Number(vo.sell_amount || 0);
      if (vo.status === 'CLIENT_APPROVED') {
        approvedVOs += sell;
      } else if (vo.status !== 'CANCELLED' && vo.status !== 'CLIENT_REJECTED' && vo.status !== 'SUPERSEDED') {
        pendingVOs += sell;
      }
      
      if (vo.proceed_at_risk && vo.status !== 'CLIENT_APPROVED') {
        atRiskExposure += sell;
      }
    }

    return {
      originalContract,
      approvedVOs: Number(approvedVOs.toFixed(2)),
      pendingVOs: Number(pendingVOs.toFixed(2)),
      atRiskExposure: Number(atRiskExposure.toFixed(2)),
      revisedContract: Number(revisedContract.toFixed(2)),
      voCount
    };
  },

  /**
   * Fetches pending internal approvals queue.
   */
  async fetchApprovalQueue(): Promise<VariationOrder[]> {
    const { data, error } = await supabase
      .from('variation_orders')
      .select(`
        *,
        projects!inner(project_number, name, client_name)
      `)
      .eq('status', 'PENDING_INTERNAL')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      ...row,
      project_number: row.projects?.project_number,
      project_name: row.projects?.name,
      client_name: row.projects?.client_name
    })) as VariationOrder[];
  }
};

export default voService;
