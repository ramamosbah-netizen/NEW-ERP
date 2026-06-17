// ============================================================
// Aura ERP — Cash Flow Forecast React Hook (React Query)
// ============================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cashFlowService } from '@/services/cashFlowService';

export function useCashFlow(initialBalance: number = 500000) {
  const [startingBalance, setStartingBalance] = useState<number>(initialBalance);

  const q = useQuery({
    queryKey: ['cashflow', '13week', startingBalance],
    queryFn: () => cashFlowService.get13WeekForecast(startingBalance),
  });

  return {
    forecast: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    startingBalance,
    setStartingBalance,
  };
}

export default useCashFlow;
