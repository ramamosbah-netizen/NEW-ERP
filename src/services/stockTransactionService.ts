// ============================================================
// JEET ERP — Stock Transaction Service
// ============================================================

import { supabase } from '@/lib/supabase';
import { eventService } from './eventService';
import type { StockTransaction, StockTransactionType, StockBalance, SerialUnit } from '@/types/stock.types';

export const stockTransactionService = {
  /**
   * Records a stock movement in the ledger.
   * This inserts a transaction row, which triggers database updates on stock_balances.
   * Also manages serial numbers for serialized items.
   */
  async recordTransaction(
    tx: Omit<StockTransaction, 'id' | 'transaction_number' | 'created_at' | 'performed_by'>,
    options?: {
      serialNumbers?: string[];
      overrideNegativeStock?: boolean;
      overrideReason?: string;
    }
  ): Promise<string> {
    try {
      // 1. Get current authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required to record stock transaction.');

      // 2. Fetch user role for override checks
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      const userRole = profile?.role || 'engineer';

      // 3. Fetch Stock Item details to check serialization
      const { data: stockItem } = await supabase
        .from('stock_items')
        .select('*, pricing_items(description, unit, item_code)')
        .eq('id', tx.stock_item_id)
        .single();

      if (!stockItem) throw new Error('Stock item definition not found.');

      // 4. Fetch the current stock balance
      const { data: balance } = await supabase
        .from('stock_balances')
        .select('*')
        .eq('stock_item_id', tx.stock_item_id)
        .eq('location_id', tx.location_id)
        .maybeSingle();

      const curAvailable = balance ? Number(balance.qty_available) : 0;
      const curOnHand = balance ? Number(balance.qty_on_hand) : 0;

      // 5. Enforce Negative Stock Guard and Count Freeze
      const isDeduction = tx.qty < 0;
      const absoluteQty = Math.abs(tx.qty);

      if (isDeduction) {
        // Count freeze check: block issues if a count is in progress
        const { data: activeCount } = await supabase
          .from('stock_counts')
          .select('id, count_number')
          .eq('location_id', tx.location_id)
          .eq('status', 'IN_PROGRESS')
          .maybeSingle();

        if (activeCount) {
          throw new Error(
            `Transaction Blocked: A physical stock count (${activeCount.count_number}) is currently IN PROGRESS at this location. All stock issues are frozen.`
          );
        }

        // Enforce that we don't exceed available stock
        if (curAvailable < absoluteQty) {
          const isAllowedToOverride = ['commercial_mgr', 'gm', 'admin'].includes(userRole);
          const hasOverrideFlag = options?.overrideNegativeStock === true;
          const hasReason = !!options?.overrideReason;

          if (hasOverrideFlag && isAllowedToOverride && hasReason) {
            // Log warning, allow write-off/issue to proceed (physical stock cannot go below zero, but available can drop below zero if reserved items are issued)
            // Note: DB check constraint on qty_on_hand >= 0 will still protect against physical negative stock.
          } else {
            throw new Error(
              `Insufficient Stock: Requested ${absoluteQty} ${stockItem.pricing_items?.unit || 'units'}, but only ${curAvailable} is available (On Hand: ${curOnHand}, Reserved: ${balance ? balance.qty_reserved : 0}).` +
              (!isAllowedToOverride ? ' Your role is not authorized to override this block.' : '') +
              (!hasReason ? ' Override requires an explicit reason explanation.' : '')
            );
          }
        }
      }

      // 6. Serial Number Validation
      const isSerialized = stockItem.is_serialized;
      const serials = options?.serialNumbers || [];

      if (isSerialized) {
        if (serials.length !== absoluteQty) {
          throw new Error(
            `Serial Mismatch: Item is serialized. You must provide exactly ${absoluteQty} serial numbers, but got ${serials.length}.`
          );
        }

        // If it's an issue/deduction, verify that all serials actually exist at this location and are IN_STORE
        if (isDeduction) {
          const { data: activeSerials } = await supabase
            .from('serial_units')
            .select('serial_no, status, current_location_id')
            .eq('stock_item_id', tx.stock_item_id)
            .in('serial_no', serials);

          for (const sNo of serials) {
            const match = activeSerials?.find(s => s.serial_no === sNo);
            if (!match || match.status !== 'IN_STORE' || match.current_location_id !== tx.location_id) {
              throw new Error(
                `Serial Unit Invalid: Serial "${sNo}" is either not in stock, located at another warehouse, or has already been issued.`
              );
            }
          }
        }
      }

      // 7. Insert Transaction (autonumber trigger fires)
      const totalValue = Math.abs(tx.qty) * tx.unit_cost;
      const basePayload: Record<string, any> = {
        type: tx.type,
        stock_item_id: tx.stock_item_id,
        location_id: tx.location_id,
        qty: tx.qty,
        unit_cost: tx.unit_cost,
        total_value: totalValue,
        source_type: tx.source_type,
        source_id: tx.source_id || null,
        project_id: tx.project_id || null,
        counterparty_location_id: tx.counterparty_location_id || null,
        reason: tx.reason || options?.overrideReason || null,
        received_by_name: (tx as any).received_by_name || null,
        performed_by: user.id
      };

      let { data: insertedTx, error: insertErr } = await supabase
        .from('stock_transactions').insert(basePayload).select().single();

      // Tolerate a not-yet-applied received_by_name migration (PGRST204)
      if (insertErr && /received_by_name/i.test(insertErr.message || '')) {
        const { received_by_name, ...withoutReceiver } = basePayload;
        ({ data: insertedTx, error: insertErr } = await supabase
          .from('stock_transactions').insert(withoutReceiver).select().single());
      }

      if (insertErr) throw insertErr;

      // 8. Update Serial Units status
      if (isSerialized && serials.length > 0) {
        for (const sNo of serials) {
          if (!isDeduction) {
            // Receipt: Add/return serial to store
            await supabase
              .from('serial_units')
              .upsert({
                stock_item_id: tx.stock_item_id,
                serial_no: sNo,
                status: 'IN_STORE',
                current_location_id: tx.location_id,
                project_id: null,
                grn_id: tx.source_type === 'GRN' ? tx.source_id : null,
                notes: `Received via transaction ${insertedTx.transaction_number}`
              }, { onConflict: 'stock_item_id,serial_no' });
          } else {
            // Issue/Deduction: check-out serial
            let newStatus: SerialUnit['status'] = 'ISSUED';
            let installedTicketId = null;
            let prjId = tx.project_id || null;

            if (tx.type === 'ISSUE_TO_TICKET') {
              newStatus = 'INSTALLED';
              installedTicketId = tx.source_id;
            } else if (tx.type === 'WRITE_OFF') {
              newStatus = 'FAULTY';
            }

            await supabase
              .from('serial_units')
              .update({
                status: newStatus,
                current_location_id: null,
                project_id: prjId,
                installed_ticket_id: installedTicketId,
                notes: `Issued via transaction ${insertedTx.transaction_number}`
              })
              .eq('stock_item_id', tx.stock_item_id)
              .eq('serial_no', sNo);
          }
        }
      }

      // 9. Check and Emit Reorder Alert
      const { data: updatedBalance } = await supabase
        .from('stock_balances')
        .select('qty_available')
        .eq('stock_item_id', tx.stock_item_id)
        .eq('location_id', tx.location_id)
        .single();

      const finalAvailable = updatedBalance ? Number(updatedBalance.qty_available) : 0;
      const reorderLevel = Number(stockItem.reorder_level || 0);

      if (finalAvailable <= reorderLevel && reorderLevel > 0 && isDeduction) {
        // Fetch preferred supplier name
        let supplierName = 'None configured';
        if (stockItem.preferred_supplier_id) {
          const { data: supplier } = await supabase
            .from('pricing_suppliers')
            .select('name')
            .eq('id', stockItem.preferred_supplier_id)
            .maybeSingle();
          if (supplier) supplierName = supplier.name;
        }

        await eventService.emitEvent(
          'stock.reorder_needed',
          'STOCK_ITEM',
          tx.stock_item_id,
          tx.project_id || undefined,
          {
            item_name: stockItem.pricing_items?.description || 'Stock Item',
            reorder_qty: Number(stockItem.reorder_qty || 0),
            unit: stockItem.pricing_items?.unit || 'EA',
            supplier_name: supplierName
          },
          user.id
        );
      }

      return insertedTx.id;
    } catch (err) {
      console.error('Error in recordTransaction service:', err);
      throw err;
    }
  }
};

export default stockTransactionService;
