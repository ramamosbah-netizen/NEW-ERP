// ============================================================
// Aura ERP — Project Financials React Hook (React Query)
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { projectFinancialsService } from '@/services/projectFinancialsService';

export function useProjectFinancials(projectId?: string) {
  const q = useQuery({
    queryKey: ['project-financials', projectId ?? ''],
    enabled: !!projectId,
    queryFn: () => projectFinancialsService.computeProjectFinancials(projectId!),
  });

  return {
    financials: q.data ?? null,
    loading: q.isLoading,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
  };
}

export default useProjectFinancials;
