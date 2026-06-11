// ============================================================
// JEET ERP — Cash Flow Forecast React Hook
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { cashFlowService } from '@/services/cashFlowService';

export function useCashFlow(initialBalance: number = 500000) {
  const [startingBalance, setStartingBalance] = useState<number>(initialBalance);
  const [forecast, setForecast] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchForecast = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await cashFlowService.get13WeekForecast(startingBalance);
      setForecast(data);
    } catch (err: any) {
      console.error('Error in useCashFlow hook:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [startingBalance]);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  return {
    forecast,
    loading,
    error,
    refetch: fetchForecast,
    startingBalance,
    setStartingBalance
  };
}
export default useCashFlow;
