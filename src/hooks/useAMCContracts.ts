// ============================================================
// JEET ERP — AMC Contract React Hooks
// ============================================================

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from 'react';
import { amcService } from '@/services/amcService';
import type { AMCContract, AMCEquipment } from '@/types/amc.types';

export interface AMCFilters {
  status?: string;
  clientId?: string;
  search?: string;
}

/**
 * Hook to retrieve and filter the list of AMC contracts.
 */
export function useAMCContracts(filters: AMCFilters = {}) {
  const [contracts, setContracts] = useState<AMCContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const data = await amcService.fetchAMCContracts(filters);
      setContracts(data);
      setError(null);
    } catch (err: any) {
      logger.error('Error in useAMCContracts hook:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return { contracts, loading, error, refetch: fetchList };
}

/**
 * Hook to retrieve and manage a single AMC contract.
 */
export function useAMCContract(id?: string) {
  const [contract, setContract] = useState<AMCContract | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState<Error | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await amcService.fetchAMCContractById(id);
      setContract(data);
      setError(null);
    } catch (err: any) {
      logger.error(`Error in useAMCContract hook for ID ${id}:`, err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const createContract = async (data: Partial<AMCContract>): Promise<AMCContract> => {
    try {
      setLoading(true);
      const res = await amcService.createAMCContract(data);
      setError(null);
      return res;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateContract = async (updates: Partial<AMCContract>): Promise<AMCContract> => {
    if (!id) throw new Error('Contract ID is required for updates');
    try {
      setLoading(true);
      const res = await amcService.updateAMCContract(id, updates);
      await fetchDetail();
      return res;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const activateContract = async (): Promise<AMCContract> => {
    if (!id) throw new Error('Contract ID is required for activation');
    try {
      setLoading(true);
      const res = await amcService.activateAMCContract(id);
      await fetchDetail();
      return res;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const addEquipment = async (
    items: Array<Omit<Partial<AMCEquipment>, 'id' | 'contract_id' | 'created_at'>>
  ): Promise<AMCEquipment[]> => {
    if (!id) throw new Error('Contract ID is required to add equipment');
    try {
      setLoading(true);
      const res = await amcService.addEquipmentToContract(id, items);
      await fetchDetail();
      return res;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const convertQuote = async (quotationId: string, customStartDate: string): Promise<AMCContract> => {
    try {
      setLoading(true);
      const res = await amcService.convertQuotationToAMC(quotationId, customStartDate);
      setError(null);
      return res;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const convertProj = async (projectId: string, customStartDate: string): Promise<AMCContract> => {
    try {
      setLoading(true);
      const res = await amcService.convertProjectToAMC(projectId, customStartDate);
      setError(null);
      return res;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    contract,
    loading,
    error,
    refetch: fetchDetail,
    createContract,
    updateContract,
    activateContract,
    addEquipment,
    convertQuote,
    convertProj
  };
}
