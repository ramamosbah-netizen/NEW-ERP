// ============================================================
// Aura ERP — Variation Order (VO) React Hooks (React Query)
// ============================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { voService } from '@/services/voService';
import type { VariationOrder, VOItem, VOFilters, VOWorkStatus } from '@/types/vo.types';

const voKeys = {
  lists: ['vos', 'list'] as const,
  list: (f: VOFilters) => ['vos', 'list', f] as const,
  detail: (id: string) => ['vos', 'detail', id] as const,
  projectSummary: (pid: string) => ['vos', 'project-summary', pid] as const,
  approvalQueue: ['vos', 'approval-queue'] as const,
};

// 1. List
export function useVOs(filters: VOFilters = {}) {
  const q = useQuery({ queryKey: voKeys.list(filters), queryFn: () => voService.fetchVOs(filters) });
  return {
    vos: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
  };
}

// 2. Detail + actions
export function useVO(id: string) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: voKeys.detail(id), queryFn: () => voService.fetchVOById(id), enabled: !!id });

  const inv = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: voKeys.detail(id) }),
      qc.invalidateQueries({ queryKey: voKeys.lists }),
    ]);
  };

  const submitInternalReview = async (comment?: string) => { const s = await voService.submitInternalReview(id, comment); if (s) await inv(); return s; };
  const approveInternal = async (comment?: string) => { const s = await voService.approveInternal(id, comment); if (s) await inv(); return s; };
  const submitToClient = async () => { const s = await voService.submitToClient(id); if (s) await inv(); return s; };
  const recordClientApproval = async (approvalRef: string, approvalDate: string, docId?: string | null) => { const s = await voService.recordClientApproval(id, approvalRef, approvalDate, docId); if (s) await inv(); return s; };
  const recordClientRejection = async (reason: string) => { const s = await voService.recordClientRejection(id, reason); if (s) await inv(); return s; };
  const cancelVO = async (reason: string) => { const s = await voService.cancelVO(id, reason); if (s) await inv(); return s; };
  const updateWorkStatus = async (workStatus: VOWorkStatus) => { const s = await voService.updateWorkStatus(id, workStatus); if (s) await inv(); return s; };

  return {
    vo: q.data ?? null,
    items: (q.data?.items ?? []) as VOItem[],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    actions: {
      submitInternalReview, approveInternal, submitToClient, recordClientApproval,
      recordClientRejection, cancelVO, updateWorkStatus,
    },
  };
}

// 3. Project VO summary widget
export function useProjectVOSummary(projectId: string) {
  const q = useQuery({
    queryKey: voKeys.projectSummary(projectId),
    queryFn: () => voService.getProjectVOSummary(projectId),
    enabled: !!projectId,
  });
  return {
    summary: q.data ?? null,
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
  };
}

// 4. Approval queue
export function useVOApprovalQueue() {
  const q = useQuery({ queryKey: voKeys.approvalQueue, queryFn: () => voService.fetchApprovalQueue() });
  return {
    pendingApprovals: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
  };
}
