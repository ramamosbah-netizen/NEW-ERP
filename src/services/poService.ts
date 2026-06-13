// ============================================================
// JEET ERP — Purchase Order (LPO) Core Service
// ============================================================

import { supabase } from '@/lib/supabase';
import { eventService } from './eventService';
import { supplierPerformanceService } from './supplierPerformanceService';
import type { PurchaseOrder, POItem, POStatus } from '@/types/po.types';

export const poService = {
  /**
   * Retrieves all PO records matching the filter criteria.
   */
  async getPOs(filters?: {
    status?: POStatus;
    project_id?: string;
    supplier_id?: string;
    search?: string;
  }): Promise<PurchaseOrder[]> {
    try {
      let query = supabase
        .from('purchase_orders')
        .select(`
          *,
          projects (project_number, name),
          profiles:created_by (full_name)
        `)
        .eq('is_active', true)
        .eq('is_latest', true)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.project_id) {
        query = query.eq('project_id', filters.project_id);
      }
      if (filters?.supplier_id) {
        query = query.eq('supplier_id', filters.supplier_id);
      }
      if (filters?.search) {
        query = query.or(
          `po_number.ilike.%${filters.search}%,supplier_name.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map(p => ({
        ...p,
        project_number: p.projects?.project_number,
        project_name: p.projects?.name,
        creator_name: p.profiles?.full_name
      })) as PurchaseOrder[];
    } catch (err) {
      console.error('Error fetching PO list:', err);
      throw err;
    }
  },

  /**
   * Retrieves details of a single PO, including items and approvals history.
   */
  async getPODetail(poId: string): Promise<PurchaseOrder> {
    try {
      const { data: po, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          projects (project_number, name),
          profiles:created_by (full_name)
        `)
        .eq('id', poId)
        .single();

      if (error) throw error;
      if (!po) throw new Error('Purchase Order not found');

      // Fetch items
      const { data: items, error: itemsErr } = await supabase
        .from('po_items')
        .select('*')
        .eq('po_id', poId)
        .order('line_no', { ascending: true });

      if (itemsErr) throw itemsErr;

      // Fetch approvals (approver_id references auth.users, not profiles, so
      // PostgREST can't embed it — resolve approver names separately).
      const { data: approvals, error: appErr } = await supabase
        .from('po_approvals')
        .select('*')
        .eq('po_id', poId)
        .order('created_at', { ascending: true });

      if (appErr) throw appErr;

      const approverIds = Array.from(new Set((approvals || []).map(a => a.approver_id).filter(Boolean)));
      const approverNames = new Map<string, string>();
      if (approverIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', approverIds);
        for (const p of profs || []) approverNames.set(p.id, p.full_name);
      }

      const formattedApprovals = (approvals || []).map(app => ({
        ...app,
        approver_name: approverNames.get(app.approver_id) || null,
      }));

      return {
        ...po,
        project_number: po.projects?.project_number,
        project_name: po.projects?.name,
        creator_name: po.profiles?.full_name,
        items: items || [],
        approvals: formattedApprovals
      } as PurchaseOrder;
    } catch (err) {
      console.error(`Error loading PO details for ${poId}:`, err);
      throw err;
    }
  },

  /**
   * Creates a new Purchase Order in DRAFT status with its line items.
   */
  async createPO(
    poData: Omit<PurchaseOrder, 'id' | 'po_number' | 'revision_number' | 'is_latest' | 'status' | 'is_active' | 'created_by' | 'created_at' | 'updated_at'>,
    items: Array<Omit<POItem, 'id' | 'po_id' | 'line_no' | 'qty_received' | 'qty_rejected' | 'receipt_status' | 'created_at'>>
  ): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required.');

      // 1. Insert PO Header
      // Trigger will generate autonumber JI-PO-YYYY-NNN race-safely
      const { data: po, error: poErr } = await supabase
        .from('purchase_orders')
        .insert({
          ...poData,
          po_number: '', // database trigger handles this if empty
          revision_number: 0,
          is_latest: true,
          status: 'DRAFT',
          created_by: user.id
        })
        .select()
        .single();

      if (poErr || !po) throw poErr || new Error('Failed to create PO header');

      // 2. Insert PO Items
      const formattedItems = items.map((it, idx) => ({
        ...it,
        po_id: po.id,
        line_no: idx + 1,
        qty_received: 0,
        qty_rejected: 0,
        receipt_status: 'PENDING'
      }));

      const { error: itemsErr } = await supabase
        .from('po_items')
        .insert(formattedItems);

      if (itemsErr) {
        // Rollback created LPO header since it failed
        await supabase.from('purchase_orders').delete().eq('id', po.id);
        throw itemsErr;
      }

      // 3. Emit event
      await eventService.emitEvent(
        'po.created',
        'PROJECT',
        po.id,
        po.project_id || undefined,
        {
          po_number: po.po_number,
          total: po.total,
          supplier_name: po.supplier_name,
          created_by_id: po.created_by
        },
        user.id
      );

      return po.id;
    } catch (err) {
      console.error('Error creating Purchase Order:', err);
      throw err;
    }
  },

  /**
   * Updates an existing DRAFT Purchase Order and resets/rewrites its line items.
   */
  async updatePO(
    poId: string,
    poData: Partial<PurchaseOrder>,
    items?: Array<Omit<POItem, 'id' | 'po_id' | 'line_no' | 'qty_received' | 'qty_rejected' | 'receipt_status' | 'created_at'>>
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required.');

      // 1. Fetch current status
      const { data: existing } = await supabase
        .from('purchase_orders')
        .select('status')
        .eq('id', poId)
        .single();

      if (!existing) throw new Error('LPO not found');
      if (existing.status !== 'DRAFT') {
        throw new Error(`Only Draft POs can be edited. Current status is ${existing.status}`);
      }

      // 2. Update Header
      const { error: poErr } = await supabase
        .from('purchase_orders')
        .update({
          ...poData,
          updated_at: new Date().toISOString()
        })
        .eq('id', poId);

      if (poErr) throw poErr;

      // 3. Rewrite items if passed
      if (items) {
        // Delete existing items
        const { error: delErr } = await supabase
          .from('po_items')
          .delete()
          .eq('po_id', poId);

        if (delErr) throw delErr;

        // Insert new ones
        const formattedItems = items.map((it, idx) => ({
          ...it,
          po_id: poId,
          line_no: idx + 1,
          qty_received: 0,
          qty_rejected: 0,
          receipt_status: 'PENDING'
        }));

        const { error: insErr } = await supabase
          .from('po_items')
          .insert(formattedItems);

        if (insErr) throw insErr;
      }

    } catch (err) {
      console.error(`Error updating PO ${poId}:`, err);
      throw err;
    }
  },

  /**
   * Sets a Purchase Order status to SENT.
   */
  async sendPO(poId: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required.');

      const { data: po } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', poId)
        .single();

      if (!po) throw new Error('LPO not found');
      if (po.status !== 'APPROVED') {
        throw new Error(`Only Approved POs can be marked as Sent. Current status is ${po.status}`);
      }

      const { error } = await supabase
        .from('purchase_orders')
        .update({
          status: 'SENT',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', poId);

      if (error) throw error;

      // Emit event
      await eventService.emitEvent(
        'po.sent',
        'PROJECT',
        poId,
        po.project_id || undefined,
        {
          po_number: po.po_number,
          supplier_name: po.supplier_name,
          sent_by: user.id,
          created_by_id: po.created_by
        },
        user.id
      );

    } catch (err) {
      console.error(`Error marking PO ${poId} as Sent:`, err);
      throw err;
    }
  },

  /**
   * Sets a Purchase Order status to ACKNOWLEDGED and records the reference.
   */
  async acknowledgePO(poId: string, ackReference: string, ackDate?: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required.');

      const { data: po } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', poId)
        .single();

      if (!po) throw new Error('LPO not found');
      if (po.status !== 'SENT') {
        throw new Error(`Only Sent POs can be marked as Acknowledged. Current status is ${po.status}`);
      }

      const formattedDate = ackDate ? new Date(ackDate).toISOString() : new Date().toISOString();

      const { error } = await supabase
        .from('purchase_orders')
        .update({
          status: 'ACKNOWLEDGED',
          acknowledged_at: formattedDate,
          supplier_ack_reference: ackReference,
          updated_at: new Date().toISOString()
        })
        .eq('id', poId);

      if (error) throw error;

      // Emit event
      await eventService.emitEvent(
        'po.acknowledged',
        'PROJECT',
        poId,
        po.project_id || undefined,
        {
          po_number: po.po_number,
          supplier_name: po.supplier_name,
          ack_reference: ackReference,
          acknowledged_by: user.id,
          created_by_id: po.created_by
        },
        user.id
      );

    } catch (err) {
      console.error(`Error marking PO ${poId} as Acknowledged:`, err);
      throw err;
    }
  },

  /**
   * Cancels a Purchase Order.
   */
  async cancelPO(poId: string, reason: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required.');

      const { data: po } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', poId)
        .single();

      if (!po) throw new Error('LPO not found');
      if (['CLOSED', 'DELIVERED', 'CANCELLED'].includes(po.status)) {
        throw new Error(`Cannot cancel a PO in terminal status: ${po.status}`);
      }

      const { error } = await supabase
        .from('purchase_orders')
        .update({
          status: 'CANCELLED',
          cancel_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', poId);

      if (error) throw error;

      // Emit event
      await eventService.emitEvent(
        'po.cancelled',
        'PROJECT',
        poId,
        po.project_id || undefined,
        {
          po_number: po.po_number,
          reason,
          cancelled_by: user.id,
          created_by_id: po.created_by
        },
        user.id
      );

      // Recalculate supplier score if applicable
      await supplierPerformanceService.recalculateSupplierPerformance(po.supplier_id);

    } catch (err) {
      console.error(`Error cancelling PO ${poId}:`, err);
      throw err;
    }
  },

  /**
   * Closes a PO short (when deliveries are partially completed, but no more are expected).
   */
  async closeShortPO(poId: string, reason: string): Promise<void> {
    try {
      const { data: po } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', poId)
        .single();

      if (!po) throw new Error('LPO not found');

      const { error } = await supabase
        .from('purchase_orders')
        .update({
          status: 'CLOSED',
          closed_short_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', poId);

      if (error) throw error;

      // Mark all pending/partial line items as CLOSED_SHORT
      const { error: itemsErr } = await supabase
        .from('po_items')
        .update({ receipt_status: 'CLOSED_SHORT' })
        .eq('po_id', poId)
        .in('receipt_status', ['PENDING', 'PARTIAL']);

      if (itemsErr) throw itemsErr;

      // Trigger recalculation of supplier performance score
      await supplierPerformanceService.recalculateSupplierPerformance(po.supplier_id);

    } catch (err) {
      console.error(`Error closing short PO ${poId}:`, err);
      throw err;
    }
  },

  /**
   * Creates a new PO revision clone.
   * Deprecates/Supersedes the old revision and spawns a new editable DRAFT.
   */
  async revisePO(poId: string): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required.');

      // 1. Fetch details of old PO
      const oldPO = await this.getPODetail(poId);
      if (!oldPO.is_latest) {
        throw new Error('Only the latest revision of a PO can be revised.');
      }
      if (['DRAFT', 'PENDING_APPROVAL', 'CANCELLED', 'SUPERSEDED'].includes(oldPO.status)) {
        throw new Error(`PO in status ${oldPO.status} cannot be revised.`);
      }

      // 2. Mark old PO as superseded
      const { error: updateOldErr } = await supabase
        .from('purchase_orders')
        .update({
          is_latest: false,
          status: 'SUPERSEDED',
          updated_at: new Date().toISOString()
        })
        .eq('id', poId);

      if (updateOldErr) throw updateOldErr;

      // 3. Create new PO header clone
      const newRevisionNumber = oldPO.revision_number + 1;
      const { data: newPO, error: newErr } = await supabase
        .from('purchase_orders')
        .insert({
          po_number: oldPO.po_number, // same number
          revision_number: newRevisionNumber,
          supersedes_id: oldPO.id,
          is_latest: true,
          origin: oldPO.origin,
          comparison_id: oldPO.comparison_id,
          project_id: oldPO.project_id,
          po_type: oldPO.po_type,
          
          supplier_id: oldPO.supplier_id,
          supplier_name: oldPO.supplier_name,
          supplier_trn: oldPO.supplier_trn,
          supplier_contact: oldPO.supplier_contact,
          supplier_email: oldPO.supplier_email,
          supplier_phone: oldPO.supplier_phone,
          
          delivery_address: oldPO.delivery_address,
          required_delivery_date: oldPO.required_delivery_date,
          promised_delivery_days: oldPO.promised_delivery_days,
          payment_terms_days: oldPO.payment_terms_days,
          payment_terms_text: oldPO.payment_terms_text,
          
          currency: oldPO.currency,
          exchange_rate: oldPO.exchange_rate,
          
          subtotal: oldPO.subtotal,
          discount_amount: oldPO.discount_amount,
          vat_amount: oldPO.vat_amount,
          total: oldPO.total,
          
          no_comparison_justification: oldPO.no_comparison_justification,
          terms_conditions: oldPO.terms_conditions,
          notes_to_supplier: oldPO.notes_to_supplier,
          internal_notes: oldPO.internal_notes,
          
          status: 'DRAFT', // revisions start back as draft for edits
          created_by: user.id
        })
        .select()
        .single();

      if (newErr || !newPO) {
        // Recover: revert old PO status
        await supabase
          .from('purchase_orders')
          .update({ is_latest: true, status: oldPO.status })
          .eq('id', poId);
        throw newErr || new Error('Failed to insert new LPO revision clone');
      }

      // 4. Clone line items
      const newItems = (oldPO.items || []).map(it => ({
        po_id: newPO.id,
        line_no: it.line_no,
        comparison_item_id: it.comparison_item_id,
        pricing_item_id: it.pricing_item_id,
        item_code: it.item_code,
        description: it.description,
        brand: it.brand,
        unit: it.unit,
        quantity: it.quantity,
        unit_price: it.unit_price,
        discount_pct: it.discount_pct,
        vat_applicable: it.vat_applicable,
        line_total: it.line_total,
        qty_received: it.qty_received, // preserve received quantities if already delivered
        qty_rejected: it.qty_rejected,
        receipt_status: it.receipt_status,
        system: it.system,
        notes: it.notes
      }));

      const { error: itemsInsErr } = await supabase
        .from('po_items')
        .insert(newItems);

      if (itemsInsErr) {
        // Rollback new LPO header
        await supabase.from('purchase_orders').delete().eq('id', newPO.id);
        // Revert old PO status
        await supabase
          .from('purchase_orders')
          .update({ is_latest: true, status: oldPO.status })
          .eq('id', poId);
        throw itemsInsErr;
      }

      // 5. Emit revised event
      await eventService.emitEvent(
        'po.revised',
        'PROJECT',
        newPO.id,
        newPO.project_id || undefined,
        {
          po_number: newPO.po_number,
          revision: newRevisionNumber,
          old_revision_id: oldPO.id,
          created_by_id: newPO.created_by
        },
        user.id
      );

      return newPO.id;
    } catch (err) {
      console.error('Error revising Purchase Order:', err);
      throw err;
    }
  }
};

export default poService;
