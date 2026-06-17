// ============================================================
// Aura ERP — Fixed Assets React Hooks (React Query)
// ============================================================

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fixedAssetService } from '@/services/fixedAssetService';
import { disposalService } from '@/services/disposalService';

const assetKeys = {
  lists: ['fixed-assets', 'list'] as const,
  detail: (id: string) => ['fixed-assets', 'detail', id] as const,
};

export function useFixedAssets() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: assetKeys.lists, queryFn: () => fixedAssetService.getFixedAssets() });

  const createAsset = async (assetData: any) => {
    const res = await fixedAssetService.createFixedAsset(assetData);
    await qc.invalidateQueries({ queryKey: assetKeys.lists });
    return res;
  };

  return {
    assets: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    createAsset,
  };
}

export function useAsset(assetId?: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: assetKeys.detail(assetId ?? ''),
    enabled: !!assetId,
    queryFn: () => fixedAssetService.getFixedAssetById(assetId!),
  });

  const disposeAsset = async (disposalData: any) => {
    if (!assetId) return;
    const res = await disposalService.disposeAsset({ ...disposalData, asset_id: assetId });
    await Promise.all([
      qc.invalidateQueries({ queryKey: assetKeys.detail(assetId) }),
      qc.invalidateQueries({ queryKey: assetKeys.lists }),
    ]);
    return res;
  };

  return {
    asset: q.data?.asset ?? null,
    schedule: q.data?.schedule ?? [],
    loading: q.isLoading,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    disposeAsset,
  };
}

// Action-only hook (no fetching) — kept on local state.
export function useDepreciationRun() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const runMonthly = async (periodMonth: string) => {
    try {
      setLoading(true); setError(null);
      return await fixedAssetService.runMonthlyDepreciation(periodMonth);
    } catch (err: any) {
      setError(err); throw err;
    } finally { setLoading(false); }
  };

  const exportJournalExcel = async (periodMonth: string, filename?: string) => {
    try {
      setLoading(true); setError(null);
      await fixedAssetService.exportJournalToExcel(periodMonth, filename);
    } catch (err: any) {
      setError(err); throw err;
    } finally { setLoading(false); }
  };

  return { runMonthly, exportJournalExcel, loading, error };
}
