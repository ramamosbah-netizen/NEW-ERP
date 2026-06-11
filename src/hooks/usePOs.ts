// ============================================================
// JEET ERP — Purchase Order (LPO) React Hooks
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { poService } from '@/services/poService';
import { poApprovalService } from '@/services/poApprovalService';
import type { PurchaseOrder, POStatus } from '@/types/po.types';

export interface POFilters {
  status?: POStatus;
  project_id?: string;
  supplier_id?: string;
  search?: string;
}

/**
 * Hook to retrieve and filter the list of Purchase Orders.
 */
export function usePOs(filters: POFilters = {}) {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const data = await poService.getPOs(filters);
      setPos(data);
      setError(null);
    } catch (err: any) {
      console.error('Error in usePOs hook:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return { pos, loading, error, refetch: fetchList };
}

/**
 * Hook to retrieve a single PO's detailed view and perform workflow actions.
 */
export function usePO(id: string) {
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await poService.getPODetail(id);
      setPo(data);
      setError(null);
    } catch (err: any) {
      console.error(`Error in usePO hook for ${id}:`, err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Workflow Actions
  const submitForApproval = async (actorUserId?: string) => {
    await poApprovalService.submitForApproval(id, actorUserId);
    await fetchDetail();
  };

  const processApproval = async (
    stage: 'COMMERCIAL' | 'GM',
    action: 'APPROVED' | 'REJECTED',
    comment: string | null,
    actorUserId: string
  ) => {
    await poApprovalService.processApproval(id, stage, action, comment, actorUserId);
    await fetchDetail();
  };

  const cancelPO = async (reason: string) => {
    await poService.cancelPO(id, reason);
    await fetchDetail();
  };

  const closeShortPO = async (reason: string) => {
    await poService.closeShortPO(id, reason);
    await fetchDetail();
  };

  const revisePO = async (): Promise<string> => {
    const newPoId = await poService.revisePO(id);
    return newPoId; // returns new draft ID for redirection
  };

  const sendPO = async () => {
    await poService.sendPO(id);
    await fetchDetail();
  };

  const acknowledgePO = async (ackReference: string, ackDate?: string) => {
    await poService.acknowledgePO(id, ackReference, ackDate);
    await fetchDetail();
  };

  return {
    po,
    loading,
    error,
    refetch: fetchDetail,
    submitForApproval,
    processApproval,
    cancelPO,
    closeShortPO,
    revisePO,
    sendPO,
    acknowledgePO
  };
}
