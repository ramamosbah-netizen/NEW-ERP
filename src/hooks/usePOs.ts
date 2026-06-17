// ============================================================
// Aura ERP — Purchase Order (LPO) React Hooks (React Query)
// ============================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { poService } from '@/services/poService';
import { poApprovalService } from '@/services/poApprovalService';
import type { PurchaseOrder, POStatus } from '@/types/po.types';

export interface POFilters {
  status?: POStatus;
  project_id?: string;
  supplier_id?: string;
  search?: string;
}

const poKeys = {
  lists: ['pos', 'list'] as const,
  list: (f: POFilters) => ['pos', 'list', f] as const,
  detail: (id: string) => ['pos', 'detail', id] as const,
};

/** List + filter Purchase Orders. */
export function usePOs(filters: POFilters = {}) {
  const q = useQuery({ queryKey: poKeys.list(filters), queryFn: () => poService.getPOs(filters) });
  return {
    pos: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
  };
}

/** Single PO detail + workflow actions. */
export function usePO(id: string) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: poKeys.detail(id), queryFn: () => poService.getPODetail(id), enabled: !!id });

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: poKeys.detail(id) }),
      qc.invalidateQueries({ queryKey: poKeys.lists }),
    ]);
  };

  const submitForApproval = async (actorUserId?: string) => {
    await poApprovalService.submitForApproval(id, actorUserId);
    await invalidate();
  };

  const processApproval = async (
    stage: 'COMMERCIAL' | 'GM',
    action: 'APPROVED' | 'REJECTED',
    comment: string | null,
    actorUserId: string,
  ) => {
    await poApprovalService.processApproval(id, stage, action, comment, actorUserId);
    await invalidate();
  };

  const cancelPO = async (reason: string) => { await poService.cancelPO(id, reason); await invalidate(); };
  const closeShortPO = async (reason: string) => { await poService.closeShortPO(id, reason); await invalidate(); };
  const revisePO = async (): Promise<string> => {
    const newPoId = await poService.revisePO(id);
    await qc.invalidateQueries({ queryKey: poKeys.lists });
    return newPoId;
  };
  const sendPO = async () => { await poService.sendPO(id); await invalidate(); };
  const acknowledgePO = async (ackReference: string, ackDate?: string) => {
    await poService.acknowledgePO(id, ackReference, ackDate);
    await invalidate();
  };

  return {
    po: q.data ?? null,
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    submitForApproval,
    processApproval,
    cancelPO,
    closeShortPO,
    revisePO,
    sendPO,
    acknowledgePO,
  };
}
