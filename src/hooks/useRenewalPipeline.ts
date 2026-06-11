// ============================================================
// JEET ERP — AMC Renewal Pipeline Kanban Hook
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { amcService } from '@/services/amcService';
import type { AMCContract } from '@/types/amc.types';

export function useRenewalPipeline() {
  const [contracts, setContracts] = useState<AMCContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPipeline = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch all contracts that are active, expiring, or expired
      const data = await amcService.fetchAMCContracts();
      setContracts(data);
      setError(null);
    } catch (err: any) {
      console.error('Error in useRenewalPipeline hook:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  // Group contracts in pipeline stages
  const pipeline = useMemo(() => {
    const today = new Date();
    const ninetyDaysFromNow = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const stages = {
      ACTIVE: [] as AMCContract[],       // Active & expiring > 90 days
      EXPIRING_90: [] as AMCContract[],  // Expiring between 90 & 30 days
      EXPIRING_30: [] as AMCContract[],  // Critical expiring under 30 days
      EXPIRED: [] as AMCContract[],      // Expired pending renewal
      RENEWED: [] as AMCContract[]       // Successfully renewed
    };

    for (const c of contracts) {
      if (c.status === 'RENEWED') {
        stages.RENEWED.push(c);
        continue;
      }
      if (c.status === 'EXPIRED' || c.status === 'TERMINATED') {
        stages.EXPIRED.push(c);
        continue;
      }

      const endDate = new Date(c.end_date);
      if (endDate < today) {
        stages.EXPIRED.push(c);
      } else if (endDate <= thirtyDaysFromNow) {
        stages.EXPIRING_30.push(c);
      } else if (endDate <= ninetyDaysFromNow) {
        stages.EXPIRING_90.push(c);
      } else {
        stages.ACTIVE.push(c);
      }
    }

    return stages;
  }, [contracts]);

  const renewContract = async (
    contractId: string,
    customStartDate: string,
    newAnnualValue?: number
  ): Promise<AMCContract> => {
    try {
      setLoading(true);
      const res = await amcService.renewContract(contractId, customStartDate, newAnnualValue);
      await fetchPipeline();
      return res;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    pipeline,
    loading,
    error,
    refetch: fetchPipeline,
    renewContract
  };
}
export default useRenewalPipeline;
