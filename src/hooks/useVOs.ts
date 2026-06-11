// ============================================================
// JEET ERP — Variation Order (VO) React Hooks
// Location: src/hooks/useVOs.ts
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { voService } from '@/services/voService';
import type { VariationOrder, VOItem, VOStatus, VOFilters, VOWorkStatus } from '@/types/vo.types';

// 1. Hook to list VOs
export function useVOs(filters: VOFilters = {}) {
  const [vos, setVOs] = useState<VariationOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await voService.fetchVOs(filters);
      setVOs(data);
    } catch (err: any) {
      console.error('Error fetching VOs:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return { vos, loading, error, refetch: fetchList };
}

// 2. Hook for detailed VO view and status actions
export function useVO(id: string) {
  const [vo, setVO] = useState<VariationOrder | null>(null);
  const [items, setItems] = useState<VOItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await voService.fetchVOById(id);
      if (data) {
        setVO(data);
        setItems(data.items || []);
      } else {
        setVO(null);
        setItems([]);
      }
    } catch (err: any) {
      console.error(`Error fetching VO ${id}:`, err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const submitInternalReview = async (comment?: string) => {
    const success = await voService.submitInternalReview(id, comment);
    if (success) await fetchDetail();
    return success;
  };

  const approveInternal = async (comment?: string) => {
    const success = await voService.approveInternal(id, comment);
    if (success) await fetchDetail();
    return success;
  };

  const submitToClient = async () => {
    const success = await voService.submitToClient(id);
    if (success) await fetchDetail();
    return success;
  };

  const recordClientApproval = async (approvalRef: string, approvalDate: string, docId?: string | null) => {
    const success = await voService.recordClientApproval(id, approvalRef, approvalDate, docId);
    if (success) await fetchDetail();
    return success;
  };

  const recordClientRejection = async (reason: string) => {
    const success = await voService.recordClientRejection(id, reason);
    if (success) await fetchDetail();
    return success;
  };

  const cancelVO = async (reason: string) => {
    const success = await voService.cancelVO(id, reason);
    if (success) await fetchDetail();
    return success;
  };

  const updateWorkStatus = async (workStatus: VOWorkStatus) => {
    const success = await voService.updateWorkStatus(id, workStatus);
    if (success) await fetchDetail();
    return success;
  };

  return {
    vo,
    items,
    loading,
    error,
    refetch: fetchDetail,
    actions: {
      submitInternalReview,
      approveInternal,
      submitToClient,
      recordClientApproval,
      recordClientRejection,
      cancelVO,
      updateWorkStatus
    }
  };
}

// 3. Hook for project VO widget summary
export function useProjectVOSummary(projectId: string) {
  const [summary, setSummary] = useState<{
    originalContract: number;
    approvedVOs: number;
    pendingVOs: number;
    atRiskExposure: number;
    revisedContract: number;
    voCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await voService.getProjectVOSummary(projectId);
      setSummary(data);
    } catch (err: any) {
      console.error(`Error loading VO summary for project ${projectId}:`, err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { summary, loading, error, refetch: fetchSummary };
}

// 4. Hook for approval queue (my day page / approver portal)
export function useVOApprovalQueue() {
  const [pendingApprovals, setPendingApprovals] = useState<VariationOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await voService.fetchApprovalQueue();
      setPendingApprovals(data);
    } catch (err: any) {
      console.error('Error fetching VO approval queue:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  return { pendingApprovals, loading, error, refetch: fetchQueue };
}
