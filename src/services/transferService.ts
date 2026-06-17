// ============================================================
// JEET ERP — Stock Transfer Service
// ============================================================

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { stockTransactionService } from './stockTransactionService';

export const transferService = {
  /**
   * Records a warehouse-to-warehouse stock transfer.
   * Decrements source location via TRANSFER_OUT and increments destination via TRANSFER_IN.
   */
  async createTransfer(
    fromLocationId: string,
    toLocationId: string,
    items: Array<{ stock_item_id: string; qty: number; serialNumbers?: string[] }>,
    reason?: string
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required to process stock transfer.');

      if (fromLocationId === toLocationId) {
        throw new Error('Source and destination locations cannot be the same.');
      }

      // Process each transfer line item
      for (const item of items) {
        if (item.qty <= 0) continue;

        // 1. Fetch current average cost at source
        const { data: sourceBalance } = await supabase
          .from('stock_balances')
          .select('avg_unit_cost')
          .eq('stock_item_id', item.stock_item_id)
          .eq('location_id', fromLocationId)
          .single();

        if (!sourceBalance) {
          throw new Error(`Item is not in stock at source location.`);
        }

        const sourceCost = Number(sourceBalance.avg_unit_cost);

        // 2. Perform TRANSFER_OUT from source
        const txOutId = await stockTransactionService.recordTransaction({
          type: 'TRANSFER_OUT',
          stock_item_id: item.stock_item_id,
          location_id: fromLocationId,
          qty: -item.qty, // negative
          unit_cost: sourceCost,
          total_value: item.qty * sourceCost,
          source_type: 'TRANSFER',
          source_id: null,
          project_id: null,
          counterparty_location_id: toLocationId,
          reason: reason || 'Warehouse stock transfer.'
        }, {
          serialNumbers: item.serialNumbers
        });

        // 3. Perform TRANSFER_IN to destination (valued at source's cost)
        await stockTransactionService.recordTransaction({
          type: 'TRANSFER_IN',
          stock_item_id: item.stock_item_id,
          location_id: toLocationId,
          qty: item.qty, // positive
          unit_cost: sourceCost,
          total_value: item.qty * sourceCost,
          source_type: 'TRANSFER',
          source_id: txOutId, // link back to source transaction
          project_id: null,
          counterparty_location_id: fromLocationId,
          reason: reason || 'Warehouse stock transfer.'
        }, {
          serialNumbers: item.serialNumbers
        });
      }
    } catch (err) {
      logger.error('Error in createTransfer service:', err);
      throw err;
    }
  }
};

export default transferService;
