// ============================================================
// Aura ERP — Supplier Performance React Hook (React Query)
// ============================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { supplierPerformanceService } from '@/services/supplierPerformanceService';

export function useSupplierPerformance(supplierId?: string) {
  const qc = useQueryClient();
  const key = ['supplier-performance', supplierId ?? ''] as const;

  const q = useQuery({
    queryKey: key,
    enabled: !!supplierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_performance_history')
        .select('*')
        .eq('supplier_id', supplierId!)
        .maybeSingle();
      if (error) throw error;
      return data || null;
    },
  });

  const recalculate = async () => {
    if (!supplierId) return;
    await supplierPerformanceService.recalculateSupplierPerformance(supplierId);
    await qc.invalidateQueries({ queryKey: key });
  };

  return {
    performance: q.data ?? null,
    loading: q.isLoading,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    recalculate,
  };
}

export default useSupplierPerformance;
