// ============================================================
// JEET ERP — Supplier Performance Writeback Service
// ============================================================

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export const supplierPerformanceService = {
  /**
   * Recalculates and updates performance indicators for a supplier based on LPO and GRN records.
   */
  async recalculateSupplierPerformance(supplierId: string): Promise<void> {
    try {
      // 1. Fetch current performance record (to preserve win_rate or fallback)
      const { data: currentHistory } = await supabase
        .from('supplier_performance_history')
        .select('*')
        .eq('supplier_id', supplierId)
        .maybeSingle();

      // Get supplier profile details for name fallback
      const { data: supplierProfile } = await supabase
        .from('pricing_suppliers')
        .select('name')
        .eq('id', supplierId)
        .single();

      const supplierName = supplierProfile?.name || currentHistory?.supplier_name || 'Unknown Supplier';

      // 2. Fetch all active POs for this supplier
      // Statuses: APPROVED, SENT, ACKNOWLEDGED, PARTIALLY_DELIVERED, DELIVERED, CLOSED
      const { data: pos, error: poErr } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('supplier_id', supplierId)
        .in('status', ['APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CLOSED']);

      if (poErr) throw poErr;

      const totalOrders = pos?.length || 0;
      const totalValue = (pos || []).reduce((sum, po) => sum + (Number(po.total) || 0), 0);

      // If no orders yet, default/reset metrics
      if (totalOrders === 0) {
        await this.savePerformanceRecord({
          supplier_id: supplierId,
          supplier_name: supplierName,
          total_orders: 0,
          total_value: 0,
          on_time_delivery_pct: 100.00,
          quality_rating: 5.00,
          defect_rate_pct: 0.00,
          win_rate_pct: currentHistory?.win_rate_pct || 0.00,
          composite_history_score: 80.00
        });
        return;
      }

      // 3. Fetch all PO items to compute defect rates
      const poIds = pos.map(po => po.id);
      const { data: poItems, error: itemsErr } = await supabase
        .from('po_items')
        .select('qty_received, qty_rejected')
        .in('po_id', poIds);

      if (itemsErr) throw itemsErr;

      let totalReceived = 0;
      let totalRejected = 0;
      (poItems || []).forEach(it => {
        totalReceived += Number(it.qty_received) || 0;
        totalRejected += Number(it.qty_rejected) || 0;
      });

      const totalReceipts = totalReceived + totalRejected;
      const defectRatePct = totalReceipts > 0 
        ? Number(((totalRejected / totalReceipts) * 100).toFixed(2)) 
        : 0.00;

      // Quality rating: scale from 5.00 based on defect rate (0% defects = 5.00, 100% defects = 0.00)
      const qualityRating = Number((5.00 * (1 - defectRatePct / 100)).toFixed(2));

      // 4. Calculate Timeliness / On-time Delivery Percentage
      // For each delivered/closed PO, find the first GRN to calculate delivery speed
      let deliveredPOCount = 0;
      let onTimePOCount = 0;
      let lastOrderDate: string | null = null;

      for (const po of pos) {
        if (po.created_at) {
          const poDate = new Date(po.created_at).toISOString().split('T')[0];
          if (!lastOrderDate || poDate > lastOrderDate) {
            lastOrderDate = poDate;
          }
        }

        // Only look at POs with receipt activity
        if (!['PARTIALLY_DELIVERED', 'DELIVERED', 'CLOSED'].includes(po.status)) {
          continue;
        }

        deliveredPOCount++;

        // Fetch first GRN for this PO
        const { data: grns } = await supabase
          .from('grns')
          .select('received_at')
          .eq('po_id', po.id)
          .order('received_at', { ascending: true })
          .limit(1);

        const firstGRN = grns?.[0];
        if (firstGRN) {
          const sentTime = po.sent_at ? new Date(po.sent_at) : new Date(po.created_at);
          const grnTime = new Date(firstGRN.received_at);
          
          // Speed in calendar days
          const diffTime = Math.abs(grnTime.getTime() - sentTime.getTime());
          const deliverySpeedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          // Check if it's on-time
          let isOnTime = false;
          if (po.required_delivery_date) {
            const reqDate = new Date(po.required_delivery_date);
            // On-time if first receipt was on or before required delivery date
            isOnTime = grnTime.getTime() <= (reqDate.getTime() + 24 * 60 * 60 * 1000); // 1 day grace
          } else if (po.promised_delivery_days) {
            isOnTime = deliverySpeedDays <= po.promised_delivery_days;
          } else {
            isOnTime = true; // no date specified, assume on time
          }

          if (isOnTime) {
            onTimePOCount++;
          }
        } else {
          // If marked delivered but no GRNs, count as on time or skip? We skip/assume on-time
          onTimePOCount++;
        }
      }

      const onTimeDeliveryPct = deliveredPOCount > 0 
        ? Number(((onTimePOCount / deliveredPOCount) * 100).toFixed(2)) 
        : 100.00;

      // 5. Composite Score Calculation
      // Weightings: 40% timeliness, 40% quality (rejection rate), 20% win-rate YTD
      const winRate = Number(currentHistory?.win_rate_pct) || 0.00;
      const qualityScore = qualityRating * 20; // convert 0-5 to 0-100
      
      const compositeHistoryScore = Number(
        (
          (onTimeDeliveryPct * 0.40) + 
          (qualityScore * 0.40) + 
          (winRate * 0.20)
        ).toFixed(2)
      );

      // 6. Save update
      await this.savePerformanceRecord({
        supplier_id: supplierId,
        supplier_name: supplierName,
        total_orders: totalOrders,
        total_value: totalValue,
        on_time_delivery_pct: onTimeDeliveryPct,
        quality_rating: qualityRating,
        defect_rate_pct: defectRatePct,
        win_rate_pct: winRate,
        composite_history_score: Math.min(100.00, Math.max(0.00, compositeHistoryScore)),
        last_order_date: lastOrderDate
      });

    } catch (err) {
      logger.error(`Failed to recalculate supplier performance for ${supplierId}:`, err);
    }
  },

  /**
   * Helper to write back to supplier_performance_history.
   */
  async savePerformanceRecord(data: any): Promise<void> {
    const { error } = await supabase
      .from('supplier_performance_history')
      .upsert(
        {
          ...data,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'supplier_id' }
      );

    if (error) {
      logger.error('Failed to upsert supplier performance record:', error);
      throw error;
    }
  }
};

export default supplierPerformanceService;
