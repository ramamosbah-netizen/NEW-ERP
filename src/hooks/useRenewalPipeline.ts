// ============================================================
// Aura ERP — AMC Renewal Pipeline Kanban Hook (React Query)
// ============================================================

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { amcService } from '@/services/amcService';
import type { AMCContract } from '@/types/amc.types';

const pipelineKey = ['amc', 'renewal-pipeline'] as const;

export function useRenewalPipeline() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: pipelineKey, queryFn: () => amcService.fetchAMCContracts() });
  const contracts = q.data ?? [];

  const pipeline = useMemo(() => {
    const today = new Date();
    const ninetyDaysFromNow = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const stages = {
      ACTIVE: [] as AMCContract[],
      EXPIRING_90: [] as AMCContract[],
      EXPIRING_30: [] as AMCContract[],
      EXPIRED: [] as AMCContract[],
      RENEWED: [] as AMCContract[],
    };

    for (const c of contracts) {
      if (c.status === 'RENEWED') { stages.RENEWED.push(c); continue; }
      if (c.status === 'EXPIRED' || c.status === 'TERMINATED') { stages.EXPIRED.push(c); continue; }
      const endDate = new Date(c.end_date);
      if (endDate < today) stages.EXPIRED.push(c);
      else if (endDate <= thirtyDaysFromNow) stages.EXPIRING_30.push(c);
      else if (endDate <= ninetyDaysFromNow) stages.EXPIRING_90.push(c);
      else stages.ACTIVE.push(c);
    }
    return stages;
  }, [contracts]);

  const renewContract = async (contractId: string, customStartDate: string, newAnnualValue?: number): Promise<AMCContract> => {
    const res = await amcService.renewContract(contractId, customStartDate, newAnnualValue);
    await qc.invalidateQueries({ queryKey: pipelineKey });
    return res;
  };

  return {
    pipeline,
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    renewContract,
  };
}

export default useRenewalPipeline;
