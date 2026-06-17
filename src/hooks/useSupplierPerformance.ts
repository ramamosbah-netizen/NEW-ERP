// ============================================================
// JEET ERP — Supplier Performance React Hook
// ============================================================

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { supplierPerformanceService } from '@/services/supplierPerformanceService';

export function useSupplierPerformance(supplierId?: string) {
  const [performance, setPerformance] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPerformance = useCallback(async () => {
    if (!supplierId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error: supErr } = await supabase
        .from('supplier_performance_history')
        .select('*')
        .eq('supplier_id', supplierId)
        .maybeSingle();

      if (supErr) throw supErr;
      setPerformance(data || null);
      setError(null);
    } catch (err: any) {
      logger.error(`Error loading performance for supplier ${supplierId}:`, err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  const recalculatePerformance = async () => {
    if (!supplierId) return;
    try {
      setLoading(true);
      await supplierPerformanceService.recalculateSupplierPerformance(supplierId);
      await fetchPerformance();
    } catch (err: any) {
      logger.error('Failed to recalculate performance:', err);
      setError(err);
      setLoading(false);
    }
  };

  return {
    performance,
    loading,
    error,
    refetch: fetchPerformance,
    recalculate: recalculatePerformance
  };
}

export default useSupplierPerformance;
