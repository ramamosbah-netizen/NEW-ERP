// ============================================================
// Aura ERP — Traffic Fines React Hook (React Query)
// ============================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fineService } from '@/services/fineService';
import { statementImportService } from '@/services/statementImportService';
import type { VehicleFine } from '@/types/fleet.types';

const fineKeys = { all: ['fines'] as const };

export function useFines() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: fineKeys.all, queryFn: () => fineService.getFines() });
  const invalidate = () => qc.invalidateQueries({ queryKey: fineKeys.all });

  const createFine = async (fineData: any) => { const res = await fineService.createFine(fineData); await invalidate(); return res; };
  const updateFine = async (fineId: string, updates: Partial<VehicleFine>) => { const res = await fineService.updateFine(fineId, updates); await invalidate(); return res; };
  const markFineDriverLiable = async (fineId: string, periodMonth: string) => { const res = await fineService.markFineDriverLiable(fineId, periodMonth); await invalidate(); return res; };
  const parseFineStatement = async (file: File): Promise<any[]> => statementImportService.extractFinesFromStatement(file);
  const commitBulkFines = async (bulkFines: any[]) => { const res = await fineService.bulkCreateFines(bulkFines); await invalidate(); return res; };

  return {
    fines: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    createFine,
    updateFine,
    markFineDriverLiable,
    parseFineStatement,
    commitBulkFines,
  };
}

export default useFines;
