// ============================================================
// Aura ERP — Cost Commitments React Hook (React Query)
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { commitmentService } from '@/services/commitmentService';

export function useProjectCommitments(projectId: string) {
  const q = useQuery({
    queryKey: ['project-commitments', projectId],
    enabled: !!projectId,
    queryFn: () => commitmentService.getProjectCostCommitments(projectId),
  });
  return {
    commitments: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
  };
}

export default useProjectCommitments;
