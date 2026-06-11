// ============================================================
// JEET ERP — Project Financials React Hook
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { projectFinancialsService } from '@/services/projectFinancialsService';

export function useProjectFinancials(projectId?: string) {
  const [financials, setFinancials] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchFinancials = useCallback(async () => {
    if (!projectId) {
      setFinancials(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await projectFinancialsService.computeProjectFinancials(projectId);
      setFinancials(data);
    } catch (err: any) {
      console.error(`Error in useProjectFinancials for ${projectId}:`, err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchFinancials();
  }, [fetchFinancials]);

  return {
    financials,
    loading,
    error,
    refetch: fetchFinancials
  };
}
export default useProjectFinancials;
