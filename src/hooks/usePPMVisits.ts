// ============================================================
// JEET ERP — PPM Visits React Hooks
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { visitService } from '@/services/visitService';
import type { PPMVisit, PPMVisitChecklistResult, ChecklistTemplate } from '@/types/ppm.types';

export interface PPMVisitFilters {
  status?: string;
  technicianId?: string;
  date?: string;
}

/**
 * Hook to retrieve the list of PPM maintenance visits.
 */
export function usePPMVisits(filters: PPMVisitFilters = {}) {
  const [visits, setVisits] = useState<PPMVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const data = await visitService.fetchPPMVisits(filters);
      setVisits(data);
      setError(null);
    } catch (err: any) {
      console.error('Error in usePPMVisits hook:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return { visits, loading, error, refetch: fetchList };
}

/**
 * Hook to retrieve a single PPM visit and manage checklist submissions & completion workflows.
 */
export function usePPMVisit(id?: string) {
  const [visit, setVisit] = useState<PPMVisit | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState<Error | null>(null);
  const [checklistTemplate, setChecklistTemplate] = useState<ChecklistTemplate | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await visitService.fetchPPMVisitById(id);
      setVisit(data);
      
      if (data && data.amc_contracts?.systems?.length) {
        // Fetch checklist template matched with first system
        const template = await visitService.fetchChecklistTemplateBySystem(data.amc_contracts.systems[0]);
        setChecklistTemplate(template);
      }
      setError(null);
    } catch (err: any) {
      console.error(`Error in usePPMVisit hook for ${id}:`, err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const scheduleVisit = async (
    scheduledDate: string,
    scheduledSlot: 'AM' | 'PM',
    technicianId: string,
    secondTechnicianId?: string
  ): Promise<PPMVisit> => {
    if (!id) throw new Error('Visit ID is required');
    try {
      setLoading(true);
      const res = await visitService.schedulePPMVisit(
        id,
        scheduledDate,
        scheduledSlot,
        technicianId,
        secondTechnicianId
      );
      await fetchDetail();
      return res;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const startVisit = async (): Promise<PPMVisit> => {
    if (!id) throw new Error('Visit ID is required');
    try {
      setLoading(true);
      const res = await visitService.startPPMVisit(id);
      await fetchDetail();
      return res;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logChecklistResult = async (
    resultData: Omit<PPMVisitChecklistResult, 'id' | 'visit_id' | 'created_at'>
  ): Promise<PPMVisitChecklistResult> => {
    if (!id) throw new Error('Visit ID is required');
    try {
      const res = await visitService.saveChecklistResult({
        ...resultData,
        visit_id: id
      });
      return res;
    } catch (err: any) {
      setError(err);
      throw err;
    }
  };

  const completeVisit = async (completeData: {
    signaturePath: string;
    clientSignName: string;
    clientSignDesignation: string;
    summary: string;
    recommendations: string;
  }): Promise<PPMVisit> => {
    if (!id) throw new Error('Visit ID is required');
    try {
      setLoading(true);
      const res = await visitService.completePPMVisit(id, completeData);
      await fetchDetail();
      return res;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    visit,
    checklistTemplate,
    loading,
    error,
    refetch: fetchDetail,
    scheduleVisit,
    startVisit,
    logChecklistResult,
    completeVisit
  };
}
