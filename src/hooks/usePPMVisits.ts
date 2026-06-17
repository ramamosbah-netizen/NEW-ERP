// ============================================================
// Aura ERP — PPM Visits React Hooks (React Query)
// ============================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { visitService } from '@/services/visitService';
import type { PPMVisit, PPMVisitChecklistResult } from '@/types/ppm.types';

export interface PPMVisitFilters {
  status?: string;
  technicianId?: string;
  date?: string;
}

const ppmKeys = {
  lists: ['ppm-visits', 'list'] as const,
  list: (f: PPMVisitFilters) => ['ppm-visits', 'list', f] as const,
  detail: (id: string) => ['ppm-visits', 'detail', id] as const,
};

export function usePPMVisits(filters: PPMVisitFilters = {}) {
  const q = useQuery({ queryKey: ppmKeys.list(filters), queryFn: () => visitService.fetchPPMVisits(filters) });
  return {
    visits: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
  };
}

export function usePPMVisit(id?: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ppmKeys.detail(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const visit = await visitService.fetchPPMVisitById(id!);
      let checklistTemplate = null;
      if (visit && visit.amc_contracts?.systems?.length) {
        checklistTemplate = await visitService.fetchChecklistTemplateBySystem(visit.amc_contracts.systems[0]);
      }
      return { visit, checklistTemplate };
    },
  });

  const inv = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ppmKeys.detail(id ?? '') }),
      qc.invalidateQueries({ queryKey: ppmKeys.lists }),
    ]);
  };

  const scheduleVisit = async (scheduledDate: string, scheduledSlot: 'AM' | 'PM', technicianId: string, secondTechnicianId?: string): Promise<PPMVisit> => {
    if (!id) throw new Error('Visit ID is required');
    const res = await visitService.schedulePPMVisit(id, scheduledDate, scheduledSlot, technicianId, secondTechnicianId); await inv(); return res;
  };
  const startVisit = async (): Promise<PPMVisit> => {
    if (!id) throw new Error('Visit ID is required');
    const res = await visitService.startPPMVisit(id); await inv(); return res;
  };
  const logChecklistResult = async (resultData: Omit<PPMVisitChecklistResult, 'id' | 'visit_id' | 'created_at'>): Promise<PPMVisitChecklistResult> => {
    if (!id) throw new Error('Visit ID is required');
    return visitService.saveChecklistResult({ ...resultData, visit_id: id });
  };
  const completeVisit = async (completeData: {
    signaturePath: string; clientSignName: string; clientSignDesignation: string; summary: string; recommendations: string;
  }): Promise<PPMVisit> => {
    if (!id) throw new Error('Visit ID is required');
    const res = await visitService.completePPMVisit(id, completeData); await inv(); return res;
  };

  return {
    visit: q.data?.visit ?? null,
    checklistTemplate: q.data?.checklistTemplate ?? null,
    loading: q.isLoading,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    scheduleVisit,
    startVisit,
    logChecklistResult,
    completeVisit,
  };
}
