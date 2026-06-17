// ============================================================
// Aura ERP — Goods Receipt Note (GRN) React Hooks (React Query)
// ============================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { grnService } from '@/services/grnService';
import type { GRNReturnStatus } from '@/types/grn.types';

export interface GRNFilters {
  project_id?: string;
  po_id?: string;
  search?: string;
}

const grnKeys = {
  list: (f: GRNFilters) => ['grns', 'list', f] as const,
  detail: (id: string) => ['grns', 'detail', id] as const,
  returns: (f: unknown) => ['grns', 'returns', f] as const,
  returnsAll: ['grns', 'returns'] as const,
};

/** List Goods Receipt Notes. */
export function useGRNs(filters: GRNFilters = {}) {
  const q = useQuery({ queryKey: grnKeys.list(filters), queryFn: () => grnService.getGRNs(filters) });
  return {
    grns: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
  };
}

/** Single GRN detail. */
export function useGRN(id: string) {
  const q = useQuery({ queryKey: grnKeys.detail(id), queryFn: () => grnService.getGRNDetail(id), enabled: !!id });
  return {
    grn: q.data ?? null,
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
  };
}

/** Supplier returns + status updates. */
export function useGRNReturns(filters?: { status?: GRNReturnStatus; project_id?: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: grnKeys.returns(filters ?? {}), queryFn: () => grnService.getReturns(filters) });

  const updateReturnStatus = async (returnId: string, status: GRNReturnStatus, resolutionNotes?: string) => {
    await grnService.updateReturnStatus(returnId, status, resolutionNotes);
    await qc.invalidateQueries({ queryKey: grnKeys.returnsAll });
  };

  return {
    returns: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    updateReturnStatus,
  };
}
