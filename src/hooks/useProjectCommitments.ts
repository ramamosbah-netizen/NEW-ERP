// ============================================================
// JEET ERP — Cost Commitments React Hook
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { commitmentService, type SystemCostSummary } from '@/services/commitmentService';

export function useProjectCommitments(projectId: string) {
  const [commitments, setCommitments] = useState<SystemCostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCommitments = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const data = await commitmentService.getProjectCostCommitments(projectId);
      setCommitments(data);
      setError(null);
    } catch (err: any) {
      console.error(`Error loading commitments for project ${projectId}:`, err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchCommitments();
  }, [fetchCommitments]);

  return { commitments, loading, error, refetch: fetchCommitments };
}

export default useProjectCommitments;
