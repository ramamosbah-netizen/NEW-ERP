// ============================================================
// JEET ERP — Goods Receipt Note (GRN) React Hooks
// ============================================================

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from 'react';
import { grnService } from '@/services/grnService';
import type { GoodsReceiptNote, GRNReturn, GRNReturnStatus } from '@/types/grn.types';

export interface GRNFilters {
  project_id?: string;
  po_id?: string;
  search?: string;
}

/**
 * Hook to retrieve the list of Goods Receipt Notes.
 */
export function useGRNs(filters: GRNFilters = {}) {
  const [grns, setGrns] = useState<GoodsReceiptNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const data = await grnService.getGRNs(filters);
      setGrns(data);
      setError(null);
    } catch (err: any) {
      logger.error('Error fetching GRN list:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return { grns, loading, error, refetch: fetchList };
}

/**
 * Hook to retrieve details of a single GRN.
 */
export function useGRN(id: string) {
  const [grn, setGrn] = useState<GoodsReceiptNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await grnService.getGRNDetail(id);
      setGrn(data);
      setError(null);
    } catch (err: any) {
      logger.error(`Error loading GRN ${id} details:`, err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return { grn, loading, error, refetch: fetchDetail };
}

/**
 * Hook to fetch and track supplier returns.
 */
export function useGRNReturns(filters?: { status?: GRNReturnStatus; project_id?: string }) {
  const [returns, setReturns] = useState<GRNReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchReturns = useCallback(async () => {
    try {
      setLoading(true);
      const data = await grnService.getReturns(filters);
      setReturns(data);
      setError(null);
    } catch (err: any) {
      logger.error('Error loading returns:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const updateReturnStatus = async (
    returnId: string,
    status: GRNReturnStatus,
    resolutionNotes?: string
  ) => {
    await grnService.updateReturnStatus(returnId, status, resolutionNotes);
    await fetchReturns();
  };

  return {
    returns,
    loading,
    error,
    refetch: fetchReturns,
    updateReturnStatus
  };
}
