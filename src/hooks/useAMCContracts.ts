// ============================================================
// Aura ERP — AMC Contract React Hooks (React Query)
// ============================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { amcService } from '@/services/amcService';
import type { AMCContract, AMCEquipment } from '@/types/amc.types';

export interface AMCFilters {
  status?: string;
  clientId?: string;
  search?: string;
}

const amcKeys = {
  lists: ['amc-contracts', 'list'] as const,
  list: (f: AMCFilters) => ['amc-contracts', 'list', f] as const,
  detail: (id: string) => ['amc-contracts', 'detail', id] as const,
};

export function useAMCContracts(filters: AMCFilters = {}) {
  const q = useQuery({ queryKey: amcKeys.list(filters), queryFn: () => amcService.fetchAMCContracts(filters) });
  return {
    contracts: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
  };
}

export function useAMCContract(id?: string) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: amcKeys.detail(id ?? ''), queryFn: () => amcService.fetchAMCContractById(id!), enabled: !!id });

  const inv = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: amcKeys.detail(id ?? '') }),
      qc.invalidateQueries({ queryKey: amcKeys.lists }),
    ]);
  };

  const createContract = async (data: Partial<AMCContract>): Promise<AMCContract> => {
    const res = await amcService.createAMCContract(data);
    await qc.invalidateQueries({ queryKey: amcKeys.lists });
    return res;
  };
  const updateContract = async (updates: Partial<AMCContract>): Promise<AMCContract> => {
    if (!id) throw new Error('Contract ID is required for updates');
    const res = await amcService.updateAMCContract(id, updates); await inv(); return res;
  };
  const activateContract = async (): Promise<AMCContract> => {
    if (!id) throw new Error('Contract ID is required for activation');
    const res = await amcService.activateAMCContract(id); await inv(); return res;
  };
  const addEquipment = async (items: Array<Omit<Partial<AMCEquipment>, 'id' | 'contract_id' | 'created_at'>>): Promise<AMCEquipment[]> => {
    if (!id) throw new Error('Contract ID is required to add equipment');
    const res = await amcService.addEquipmentToContract(id, items); await inv(); return res;
  };
  const convertQuote = async (quotationId: string, customStartDate: string): Promise<AMCContract> => {
    const res = await amcService.convertQuotationToAMC(quotationId, customStartDate);
    await qc.invalidateQueries({ queryKey: amcKeys.lists });
    return res;
  };
  const convertProj = async (projectId: string, customStartDate: string): Promise<AMCContract> => {
    const res = await amcService.convertProjectToAMC(projectId, customStartDate);
    await qc.invalidateQueries({ queryKey: amcKeys.lists });
    return res;
  };

  return {
    contract: q.data ?? null,
    loading: q.isLoading,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    createContract,
    updateContract,
    activateContract,
    addEquipment,
    convertQuote,
    convertProj,
  };
}
