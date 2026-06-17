import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from 'react';
import { fixedAssetService } from '@/services/fixedAssetService';
import { disposalService } from '@/services/disposalService';
import type { FixedAsset, DepreciationPeriodRow, AssetDisposal } from '@/types/asset.types';

export function useFixedAssets() {
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fixedAssetService.getFixedAssets();
      setAssets(data);
    } catch (err: any) {
      logger.error('Failed to load fixed assets:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const createAsset = async (assetData: any) => {
    const res = await fixedAssetService.createFixedAsset(assetData);
    await fetchAssets();
    return res;
  };

  return {
    assets,
    loading,
    error,
    refetch: fetchAssets,
    createAsset
  };
}

export function useAsset(assetId?: string) {
  const [asset, setAsset] = useState<FixedAsset | null>(null);
  const [schedule, setSchedule] = useState<DepreciationPeriodRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!assetId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fixedAssetService.getFixedAssetById(assetId);
      if (res) {
        setAsset(res.asset);
        setSchedule(res.schedule);
      }
    } catch (err: any) {
      logger.error(`Failed to load details for fixed asset ${assetId}:`, err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const disposeAsset = async (disposalData: any) => {
    if (!assetId) return;
    const res = await disposalService.disposeAsset({
      ...disposalData,
      asset_id: assetId
    });
    await fetchDetails();
    return res;
  };

  return {
    asset,
    schedule,
    loading,
    error,
    refetch: fetchDetails,
    disposeAsset
  };
}

export function useDepreciationRun() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const runMonthly = async (periodMonth: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fixedAssetService.runMonthlyDepreciation(periodMonth);
      return res;
    } catch (err: any) {
      logger.error(`Depreciation run failed for period ${periodMonth}:`, err);
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const exportJournalExcel = async (periodMonth: string, filename?: string) => {
    try {
      setLoading(true);
      setError(null);
      await fixedAssetService.exportJournalToExcel(periodMonth, filename);
    } catch (err: any) {
      logger.error(`Journal export failed for period ${periodMonth}:`, err);
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    runMonthly,
    exportJournalExcel,
    loading,
    error
  };
}
