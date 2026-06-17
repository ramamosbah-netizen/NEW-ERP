// ============================================================
// Aura ERP — Snag List Management Hook (React Query)
// ============================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { snagService } from '@/services/snagService';
import { snagExportService } from '@/services/snagExportService';
import type { SnagSeverity, SnagStatus, SnagSource } from '@/types/snag.types';

export function useSnags(projectId?: string) {
  const qc = useQueryClient();
  const key = ['snags', projectId ?? ''] as const;
  const q = useQuery({
    queryKey: key,
    queryFn: () => snagService.getSnagsByProject(projectId!),
    enabled: !!projectId,
  });

  const createSnag = async (params: {
    source: SnagSource;
    system: string;
    location: string;
    description: string;
    severity: SnagSeverity;
    photo_paths?: string[];
    assigned_to?: string;
    subcontractor_name?: string;
    target_date?: string;
    tc_test_result_id?: string;
  }) => {
    if (!projectId) throw new Error('Project ID is required to log a snag');
    const item = await snagService.createSnag({ project_id: projectId, ...params });
    await qc.invalidateQueries({ queryKey: key });
    return item;
  };

  const transitionStatus = async (
    snagId: string,
    newStatus: SnagStatus,
    params?: { photo_paths?: string[]; comments?: string; client_accepted?: boolean; deferral_justification?: string },
  ) => {
    const updated = await snagService.transitionSnagStatus(snagId, newStatus, params);
    await qc.invalidateQueries({ queryKey: key });
    return updated;
  };

  const exportPDF = async () => {
    if (!projectId) throw new Error('Project ID is required to export snags');
    return snagExportService.exportSnagsToPDF(projectId);
  };

  return {
    snags: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    createSnag,
    transitionStatus,
    exportPDF,
  };
}

export default useSnags;
