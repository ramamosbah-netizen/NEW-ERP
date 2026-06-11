// ============================================================
// JEET ERP — Snag List Management Hook
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { snagService } from '@/services/snagService';
import { snagExportService } from '@/services/snagExportService';
import { Snag, SnagSeverity, SnagStatus, SnagSource } from '@/types/snag.types';

export function useSnags(projectId?: string) {
  const [snags, setSnags] = useState<Snag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSnags = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const data = await snagService.getSnagsByProject(projectId);
      setSnags(data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching snags:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      fetchSnags();
    }
  }, [projectId, fetchSnags]);

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
    try {
      const item = await snagService.createSnag({
        project_id: projectId,
        ...params
      });
      await fetchSnags();
      return item;
    } catch (err: any) {
      console.error('Failed to create snag:', err);
      throw err;
    }
  };

  const transitionStatus = async (
    snagId: string,
    newStatus: SnagStatus,
    params?: {
      photo_paths?: string[];
      comments?: string;
      client_accepted?: boolean;
      deferral_justification?: string;
    }
  ) => {
    try {
      const updated = await snagService.transitionSnagStatus(snagId, newStatus, params);
      await fetchSnags();
      return updated;
    } catch (err: any) {
      console.error('Failed to transition snag status:', err);
      throw err;
    }
  };

  const exportPDF = async () => {
    if (!projectId) throw new Error('Project ID is required to export snags');
    try {
      return await snagExportService.exportSnagsToPDF(projectId);
    } catch (err: any) {
      console.error('Failed to export snag list PDF:', err);
      throw err;
    }
  };

  return {
    snags,
    loading,
    error,
    refetch: fetchSnags,
    createSnag,
    transitionStatus,
    exportPDF
  };
}

export default useSnags;
