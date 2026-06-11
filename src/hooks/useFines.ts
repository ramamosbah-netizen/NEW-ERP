import { useState, useEffect, useCallback } from 'react';
import { fineService } from '@/services/fineService';
import { statementImportService } from '@/services/statementImportService';
import type { VehicleFine } from '@/types/fleet.types';

export function useFines() {
  const [fines, setFines] = useState<VehicleFine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchFines = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fineService.getFines();
      setFines(data);
    } catch (err: any) {
      console.error('Failed to load traffic fines:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFines();
  }, [fetchFines]);

  const createFine = async (fineData: any) => {
    const res = await fineService.createFine(fineData);
    await fetchFines();
    return res;
  };

  const updateFine = async (fineId: string, updates: Partial<VehicleFine>) => {
    const res = await fineService.updateFine(fineId, updates);
    await fetchFines();
    return res;
  };

  const markFineDriverLiable = async (fineId: string, periodMonth: string) => {
    const res = await fineService.markFineDriverLiable(fineId, periodMonth);
    await fetchFines();
    return res;
  };

  const parseFineStatement = async (file: File): Promise<any[]> => {
    try {
      setLoading(true);
      setError(null);
      const extracted = await statementImportService.extractFinesFromStatement(file);
      return extracted;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const commitBulkFines = async (bulkFines: any[]) => {
    const res = await fineService.bulkCreateFines(bulkFines);
    await fetchFines();
    return res;
  };

  return {
    fines,
    loading,
    error,
    refetch: fetchFines,
    createFine,
    updateFine,
    markFineDriverLiable,
    parseFineStatement,
    commitBulkFines
  };
}

export default useFines;
