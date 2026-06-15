// ============================================================
// JEET ERP — Stock Count & Reconciliation Service
// ============================================================

import { supabase } from '@/lib/supabase';
import { stockTransactionService } from './stockTransactionService';
import type { StockCount, StockCountLine } from '@/types/stock.types';

export const stockCountService = {
  /**
   * Starts a new physical stock count, capturing the system quantity snapshot (freeze).
   */
  async startStockCount(locationId: string): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required to start stock count.');

      // 1. Create Stock Count Header
      const { data: count, error: countErr } = await supabase
        .from('stock_counts')
        .insert({
          location_id: locationId,
          status: 'IN_PROGRESS',
          counted_by: user.id,
          count_date: new Date().toISOString().split('T')[0]
        })
        .select('id')
        .single();

      if (countErr) throw countErr;

      // 2. Capture all stock balances at this location and insert as lines
      const { data: balances } = await supabase
        .from('stock_balances')
        .select('stock_item_id, qty_on_hand, avg_unit_cost')
        .eq('location_id', locationId);

      if (balances && balances.length > 0) {
        const linesToInsert = balances.map(b => {
          const qty = Number(b.qty_on_hand);
          return {
            stock_count_id: count.id,
            stock_item_id: b.stock_item_id,
            system_qty: qty,
            counted_qty: qty, // default to system quantity initially
            variance: 0.000,
            variance_value: 0.0000,
            recount_flag: false
          };
        });

        const { error: linesErr } = await supabase
          .from('stock_count_lines')
          .insert(linesToInsert);

        if (linesErr) throw linesErr;
      }

      return count.id;
    } catch (err) {
      console.error('Error starting stock count:', err);
      throw err;
    }
  },

  /**
   * Retrieves stock counts list.
   */
  async getStockCounts(locationId?: string): Promise<StockCount[]> {
    let query = supabase
      .from('stock_counts')
      .select(`
        *,
        stock_locations(name)
      `)
      .order('created_at', { ascending: false });

    if (locationId) {
      query = query.eq('location_id', locationId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];
    // counter name via separate lookup (no FK stock_counts -> profiles in this DB)
    const ids = [...new Set(rows.map((r: any) => r.counted_by).filter(Boolean))];
    const nameMap = new Map<string, string>();
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      (profs || []).forEach((p: any) => nameMap.set(p.id, p.full_name));
    }

    return rows.map((row: any) => ({
      ...row,
      location_name: row.stock_locations?.name,
      counter_name: row.counted_by ? nameMap.get(row.counted_by) : undefined
    })) as StockCount[];
  },

  /**
   * Retrieves count details with line items.
   */
  async getStockCountDetail(id: string): Promise<StockCount> {
    const { data: count, error: countErr } = await supabase
      .from('stock_counts')
      .select(`
        *,
        stock_locations(name, location_code)
      `)
      .eq('id', id)
      .single();

    if (countErr) throw countErr;

    // counter name via separate lookup (no FK stock_counts -> profiles in this DB)
    let counterName: string | undefined;
    if (count.counted_by) {
      const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', count.counted_by).maybeSingle();
      counterName = prof?.full_name;
    }

    const { data: lines, error: linesErr } = await supabase
      .from('stock_count_lines')
      .select(`
        *,
        stock_items(
          pricing_items(item_code, description, unit),
          stock_balances(avg_unit_cost)
        )
      `)
      .eq('stock_count_id', id);

    if (linesErr) throw linesErr;

    const formattedLines = (lines || []).map(row => {
      // Find balance matching location for WAC
      const balances = row.stock_items?.stock_balances || [];
      const balanceCost = balances.length > 0 ? Number(balances[0].avg_unit_cost) : 0.0000;

      return {
        ...row,
        item_code: row.stock_items?.pricing_items?.item_code,
        description: row.stock_items?.pricing_items?.description,
        unit: row.stock_items?.pricing_items?.unit,
        avg_unit_cost: balanceCost
      };
    });

    return {
      ...count,
      location_name: count.stock_locations?.name,
      counter_name: counterName,
      lines: formattedLines
    } as StockCount;
  },

  /**
   * Saves count values, computing variances.
   */
  async saveCountLines(
    countId: string,
    lines: Array<{ stock_item_id: string; counted_qty: number; recount_flag?: boolean }>
  ): Promise<void> {
    try {
      // Fetch details to find unit costs for variance values
      const countDetails = await this.getStockCountDetail(countId);

      for (const line of lines) {
        const countLine = countDetails.lines?.find(l => l.stock_item_id === line.stock_item_id);
        if (!countLine) continue;

        const systemQty = Number(countLine.system_qty);
        const countedQty = Number(line.counted_qty);
        const variance = countedQty - systemQty;
        const avgCost = countLine.avg_unit_cost || 0;
        const varianceValue = variance * avgCost;

        await supabase
          .from('stock_count_lines')
          .update({
            counted_qty: countedQty,
            variance: variance,
            variance_value: varianceValue,
            recount_flag: line.recount_flag || false
          })
          .eq('stock_count_id', countId)
          .eq('stock_item_id', line.stock_item_id);
      }
    } catch (err) {
      console.error('Error saving count lines:', err);
      throw err;
    }
  },

  /**
   * Posts stock count variances into the ledger, ending the freeze.
   */
  async postStockCount(id: string, reason: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required to post count.');

      const count = await this.getStockCountDetail(id);
      if (count.status !== 'IN_PROGRESS' && count.status !== 'PENDING_REVIEW') {
        throw new Error('Stock count is already posted or cancelled.');
      }

      // Check if any lines require recounts
      const hasRecounts = count.lines?.some(l => l.recount_flag);
      if (hasRecounts) {
        throw new Error('Cannot post stock count while recount flags are active. Resolve recounts first.');
      }

      // Loop through lines and record adjustments for variances
      for (const line of count.lines || []) {
        const variance = Number(line.variance);
        if (variance === 0) continue;

        const avgCost = Number(line.avg_unit_cost || 0);

        if (variance > 0) {
          // Surplus: ADJUSTMENT_IN
          await stockTransactionService.recordTransaction({
            type: 'ADJUSTMENT_IN',
            stock_item_id: line.stock_item_id,
            location_id: count.location_id,
            qty: variance,
            unit_cost: avgCost,
            total_value: variance * avgCost,
            source_type: 'COUNT',
            source_id: count.id,
            reason: reason || `Inventory Count Adjustment (JI-CNT-${count.count_number})`
          });
        } else {
          // Deficit: ADJUSTMENT_OUT
          await stockTransactionService.recordTransaction({
            type: 'ADJUSTMENT_OUT',
            stock_item_id: line.stock_item_id,
            location_id: count.location_id,
            qty: variance, // negative
            unit_cost: avgCost,
            total_value: Math.abs(variance) * avgCost,
            source_type: 'COUNT',
            source_id: count.id,
            reason: reason || `Inventory Count Adjustment (JI-CNT-${count.count_number})`
          });
        }
      }

      // Set status to POSTED
      const { error: updateErr } = await supabase
        .from('stock_counts')
        .update({
          status: 'POSTED',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateErr) throw updateErr;

    } catch (err) {
      console.error('Error posting stock count:', err);
      throw err;
    }
  }
};

export default stockCountService;
