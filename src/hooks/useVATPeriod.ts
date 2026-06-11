// ============================================================
// JEET ERP — VAT Periods and FTA Form 201 React Hook
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { vatService } from '@/services/vatService';
import type { VATPeriod, VATForm201 } from '@/types/vat.types';

export function useVATPeriod() {
  const [periods, setPeriods] = useState<VATPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [form201, setForm201] = useState<VATForm201 | null>(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPeriods = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await vatService.fetchVATPeriods();
      setPeriods(data);
      if (data.length > 0 && !selectedPeriodId) {
        setSelectedPeriodId(data[0].id); // default to most recent
      }
    } catch (err: any) {
      console.error('Error fetching VAT periods:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriodId]);

  const computeFiling = useCallback(async () => {
    if (!selectedPeriodId) {
      setForm201(null);
      return;
    }
    try {
      setComputing(true);
      setError(null);
      const data = await vatService.computeForm201(selectedPeriodId);
      setForm201(data);
    } catch (err: any) {
      console.error(`Error computing VAT Form 201 for period ${selectedPeriodId}:`, err);
      setError(err);
    } finally {
      setComputing(false);
    }
  }, [selectedPeriodId]);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  useEffect(() => {
    computeFiling();
  }, [computeFiling]);

  const createPeriod = async (name: string, startDate: string, endDate: string, deadline: string) => {
    try {
      const newPeriod = await vatService.createVATPeriod({
        name,
        start_date: startDate,
        end_date: endDate,
        filing_deadline: deadline
      });
      await fetchPeriods();
      setSelectedPeriodId(newPeriod.id);
      return newPeriod;
    } catch (err: any) {
      console.error('Error creating VAT period:', err);
      throw err;
    }
  };

  const lockPeriod = async (id: string) => {
    try {
      await vatService.lockVATPeriod(id);
      await fetchPeriods();
      await computeFiling();
      return true;
    } catch (err: any) {
      console.error('Error locking VAT period:', err);
      throw err;
    }
  };

  return {
    periods,
    selectedPeriodId,
    setSelectedPeriodId,
    form201,
    loading,
    computing,
    error,
    refetch: fetchPeriods,
    createPeriod,
    lockPeriod
  };
}
export default useVATPeriod;
