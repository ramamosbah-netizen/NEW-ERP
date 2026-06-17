// ============================================================
// Aura ERP — VAT Periods & FTA Form 201 React Hook (React Query)
// ============================================================

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { vatService } from '@/services/vatService';

const vatKeys = {
  periods: ['vat', 'periods'] as const,
  form: (id: string) => ['vat', 'form201', id] as const,
};

export function useVATPeriod() {
  const qc = useQueryClient();
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');

  const periodsQ = useQuery({ queryKey: vatKeys.periods, queryFn: () => vatService.fetchVATPeriods() });

  // default selection to most recent period
  useEffect(() => {
    if (periodsQ.data && periodsQ.data.length > 0 && !selectedPeriodId) {
      setSelectedPeriodId(periodsQ.data[0].id);
    }
  }, [periodsQ.data, selectedPeriodId]);

  const formQ = useQuery({
    queryKey: vatKeys.form(selectedPeriodId),
    queryFn: () => vatService.computeForm201(selectedPeriodId),
    enabled: !!selectedPeriodId,
  });

  const createPeriod = async (name: string, startDate: string, endDate: string, deadline: string) => {
    const newPeriod = await vatService.createVATPeriod({
      name, start_date: startDate, end_date: endDate, filing_deadline: deadline,
    });
    await qc.invalidateQueries({ queryKey: vatKeys.periods });
    setSelectedPeriodId(newPeriod.id);
    return newPeriod;
  };

  const lockPeriod = async (id: string) => {
    await vatService.lockVATPeriod(id);
    await Promise.all([
      qc.invalidateQueries({ queryKey: vatKeys.periods }),
      qc.invalidateQueries({ queryKey: vatKeys.form(selectedPeriodId) }),
    ]);
    return true;
  };

  return {
    periods: periodsQ.data ?? [],
    selectedPeriodId,
    setSelectedPeriodId,
    form201: formQ.data ?? null,
    loading: periodsQ.isPending,
    computing: formQ.isFetching,
    error: ((periodsQ.error || formQ.error) as Error | null) ?? null,
    refetch: periodsQ.refetch,
    createPeriod,
    lockPeriod,
  };
}

export default useVATPeriod;
