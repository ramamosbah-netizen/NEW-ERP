// ============================================================
// JEET ERP — Goods Receipt Note (GRN) Service
// ============================================================

import { supabase } from '@/lib/supabase';
import { eventService } from './eventService';
import { supplierPerformanceService } from './supplierPerformanceService';
import type { GoodsReceiptNote, GRNItem, GRNReturn, GRNReturnStatus } from '@/types/grn.types';

export const grnService = {
  /**
   * Records a new Goods Receipt Note inside a database transaction.
   */
  async recordGRN(
    grnData: Omit<GoodsReceiptNote, 'id' | 'grn_number' | 'received_by' | 'received_at' | 'status' | 'is_active' | 'created_at' | 'updated_at'>,
    items: Array<{
      po_item_id: string;
      qty_received: number;
      qty_rejected: number;
      rejection_reason?: string | null;
      rejection_photos?: string[] | null;
      notes?: string | null;
    }>,
    ignoreTolerance: boolean = false
  ): Promise<string> {
    try {
      // 1. Get current authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required to record GRN.');

      // 2. Call the DB transaction RPC function
      const { data: grnId, error } = await supabase.rpc('create_grn_transaction', {
        p_po_id: grnData.po_id,
        p_received_by: user.id,
        p_delivery_note_ref: grnData.delivery_note_ref,
        p_delivery_note_document_id: grnData.delivery_note_document_id || null,
        p_vehicle_no: grnData.vehicle_no || null,
        p_driver_name: grnData.driver_name || null,
        p_location: grnData.location,
        p_notes: grnData.notes || null,
        p_items: items.map(it => ({
          po_item_id: it.po_item_id,
          qty_received: it.qty_received,
          qty_rejected: it.qty_rejected,
          rejection_reason: it.rejection_reason || null,
          notes: it.notes || null
        })),
        p_ignore_tolerance: ignoreTolerance,
        p_is_stock_item: grnData.is_stock_item || false,
        p_stock_location_id: grnData.stock_location_id || null
      });

      if (error) {
        console.error('RPC create_grn_transaction failed:', error);
        throw error;
      }

      // 3. Update rejection photos in grn_items if any
      const itemsWithPhotos = items.filter(it => it.rejection_photos && it.rejection_photos.length > 0);
      if (itemsWithPhotos.length > 0) {
        const { data: dbGrnItems } = await supabase
          .from('grn_items')
          .select('id, po_item_id')
          .eq('grn_id', grnId);

        if (dbGrnItems) {
          for (const itemWithPhoto of itemsWithPhotos) {
            const dbItem = dbGrnItems.find(dbi => dbi.po_item_id === itemWithPhoto.po_item_id);
            if (dbItem) {
              await supabase
                .from('grn_items')
                .update({ rejection_photos: itemWithPhoto.rejection_photos })
                .eq('id', dbItem.id);
            }
          }
        }
      }

      // 4. Fetch the created GRN and updated PO details to check transition
      const { data: grn } = await supabase
        .from('grns')
        .select('*, purchase_orders(*)')
        .eq('id', grnId)
        .single();

      if (grn) {
        // A. Emit GRN recorded event
        await eventService.emitEvent(
          'grn.recorded',
          'PROJECT',
          grn.id,
          grn.project_id || undefined,
          {
            grn_number: grn.grn_number,
            delivery_note_ref: grn.delivery_note_ref,
            po_number: grn.purchase_orders?.po_number,
            item_count: items.length
          },
          user.id
        );

        // B. Emit GRN returned event if any items were rejected
        const totalRejectedCount = items.reduce((sum, it) => sum + (it.qty_rejected || 0), 0);
        if (totalRejectedCount > 0) {
          await eventService.emitEvent(
            'grn.returned',
            'PROJECT',
            grn.id,
            grn.project_id || undefined,
            {
              grn_number: grn.grn_number,
              po_number: grn.purchase_orders?.po_number,
              supplier_name: grn.purchase_orders?.supplier_name,
              rejected_items_count: items.filter(it => it.qty_rejected > 0).length,
              total_rejected_qty: totalRejectedCount
            },
            user.id
          );
        }

        // C. Emit PO delivery transition events if needed
        const poStatus = grn.purchase_orders?.status;
        if (poStatus === 'DELIVERED') {
          await eventService.emitEvent(
            'po.fully_delivered',
            'PROJECT',
            grn.po_id,
            grn.project_id || undefined,
            {
              po_number: grn.purchase_orders?.po_number,
              grn_number: grn.grn_number
            },
            user.id
          );
        } else if (poStatus === 'PARTIALLY_DELIVERED') {
          await eventService.emitEvent(
            'po.partially_delivered',
            'PROJECT',
            grn.po_id,
            grn.project_id || undefined,
            {
              po_number: grn.purchase_orders?.po_number,
              grn_number: grn.grn_number
            },
            user.id
          );
        }

        // Check for over-deliveries (> 2% tolerance) to emit grn.over_delivered event
        const { data: dbPoItems } = await supabase
          .from('po_items')
          .select('id, quantity, qty_received')
          .eq('po_id', grn.po_id);

        if (dbPoItems) {
          const overDeliveredItems = items.filter(it => {
            const dbItem = dbPoItems.find(dbi => dbi.id === it.po_item_id);
            if (!dbItem) return false;
            // Since the RPC already completed, dbItem.qty_received contains the updated received total
            return Number(dbItem.qty_received) > Number(dbItem.quantity) * 1.02;
          });

          if (overDeliveredItems.length > 0) {
            await eventService.emitEvent(
              'grn.over_delivered',
              'PROJECT',
              grn.id,
              grn.project_id || undefined,
              {
                grn_number: grn.grn_number,
                po_number: grn.purchase_orders?.po_number,
                supplier_name: grn.purchase_orders?.supplier_name,
                over_delivered_items_count: overDeliveredItems.length
              },
              user.id
            );
          }
        }

        // D. Trigger recalculation of supplier performance score
        if (grn.purchase_orders?.supplier_id) {
          await supplierPerformanceService.recalculateSupplierPerformance(grn.purchase_orders.supplier_id);
        }
      }

      return grnId;
    } catch (err) {
      console.error('Error in recordGRN service:', err);
      throw err;
    }
  },

  /**
   * Retrieves all GRN records, optionally filtered.
   */
  async getGRNs(filters?: {
    project_id?: string;
    po_id?: string;
    search?: string;
  }): Promise<GoodsReceiptNote[]> {
    try {
      let query = supabase
        .from('grns')
        .select(`
          *,
          purchase_orders (po_number),
          projects (project_number, name),
          profiles:received_by (full_name)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (filters?.project_id) {
        query = query.eq('project_id', filters.project_id);
      }
      if (filters?.po_id) {
        query = query.eq('po_id', filters.po_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map(g => ({
        ...g,
        po_number: g.purchase_orders?.po_number,
        project_number: g.projects?.project_number,
        project_name: g.projects?.name,
        receiver_name: g.profiles?.full_name
      })) as GoodsReceiptNote[];
    } catch (err) {
      console.error('Error fetching GRNs:', err);
      throw err;
    }
  },

  /**
   * Retrieves details of a single GRN.
   */
  async getGRNDetail(grnId: string): Promise<GoodsReceiptNote> {
    try {
      const { data: grn, error } = await supabase
        .from('grns')
        .select(`
          *,
          purchase_orders (po_number, supplier_name),
          projects (project_number, name),
          profiles:received_by (full_name)
        `)
        .eq('id', grnId)
        .single();

      if (error) throw error;
      if (!grn) throw new Error('GRN not found');

      // Fetch items
      const { data: items, error: itemsErr } = await supabase
        .from('grn_items')
        .select(`
          *,
          po_items (description, brand, unit, quantity, qty_received, qty_rejected, item_code, system)
        `)
        .eq('grn_id', grnId);

      if (itemsErr) throw itemsErr;

      const formattedItems = (items || []).map(it => ({
        ...it,
        description: it.po_items?.description,
        brand: it.po_items?.brand,
        unit: it.po_items?.unit,
        po_qty: it.po_items?.quantity,
        po_qty_received: it.po_items?.qty_received,
        po_qty_rejected: it.po_items?.qty_rejected,
        item_code: it.po_items?.item_code,
        system: it.po_items?.system
      }));

      return {
        ...grn,
        po_number: grn.purchase_orders?.po_number,
        supplier_name: grn.purchase_orders?.supplier_name,
        project_number: grn.projects?.project_number,
        project_name: grn.projects?.name,
        receiver_name: grn.profiles?.full_name,
        items: formattedItems
      } as GoodsReceiptNote;

    } catch (err) {
      console.error(`Error loading GRN ${grnId} details:`, err);
      throw err;
    }
  },

  /**
   * Retrieves returns tracker tickets.
   */
  async getReturns(filters?: {
    status?: GRNReturnStatus;
    project_id?: string;
  }): Promise<GRNReturn[]> {
    try {
      let query = supabase
        .from('grn_returns')
        .select(`
          *,
          grn_items!inner (
            qty_rejected,
            grns!inner (
              grn_number,
              project_id,
              purchase_orders!inner (
                po_number,
                supplier_name
              )
            ),
            po_items!inner (
              description,
              unit
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.project_id) {
        query = query.eq('grn_items.grns.project_id', filters.project_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map(r => ({
        id: r.id,
        grn_item_id: r.grn_item_id,
        qty: r.qty,
        reason: r.reason,
        status: r.status,
        expected_resolution_date: r.expected_resolution_date,
        resolved_at: r.resolved_at,
        resolution_notes: r.resolution_notes,
        created_at: r.created_at,
        grn_number: r.grn_items?.grns?.grn_number,
        po_number: r.grn_items?.grns?.purchase_orders?.po_number,
        supplier_name: r.grn_items?.grns?.purchase_orders?.supplier_name,
        item_description: r.grn_items?.po_items?.description,
        unit: r.grn_items?.po_items?.unit
      })) as GRNReturn[];

    } catch (err) {
      console.error('Error fetching GRN returns:', err);
      throw err;
    }
  },

  /**
   * Sign-off / Updates a return ticket status.
   */
  async updateReturnStatus(
    returnId: string,
    status: GRNReturnStatus,
    resolutionNotes?: string
  ): Promise<void> {
    try {
      const isResolved = ['REPLACED', 'CREDITED', 'COLLECTED'].includes(status);
      
      const { error } = await supabase
        .from('grn_returns')
        .update({
          status,
          resolution_notes: resolutionNotes || null,
          resolved_at: isResolved ? new Date().toISOString() : null
        })
        .eq('id', returnId);

      if (error) throw error;

      // Emit return status update event
      const { data: retData } = await supabase
        .from('grn_returns')
        .select(`
          *,
          grn_items (
            grns (
              grn_number,
              project_id,
              purchase_orders (
                po_number,
                supplier_name
              )
            )
          )
        `)
        .eq('id', returnId)
        .single();

      if (retData) {
        const pId = retData.grn_items?.grns?.project_id;
        await eventService.emitEvent(
          'grn.returned',
          'PROJECT',
          returnId,
          pId || undefined,
          {
            status,
            grn_number: retData.grn_items?.grns?.grn_number,
            po_number: retData.grn_items?.grns?.purchase_orders?.po_number,
            supplier_name: retData.grn_items?.grns?.purchase_orders?.supplier_name,
            qty: retData.qty
          }
        );
      }

    } catch (err) {
      console.error(`Error updating return status ${returnId}:`, err);
      throw err;
    }
  }
};

export default grnService;
