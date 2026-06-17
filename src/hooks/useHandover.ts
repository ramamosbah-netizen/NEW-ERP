// ============================================================
// Aura ERP — Project Handover & Closeout Hook (React Query)
// ============================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { handoverService } from '@/services/handoverService';
import { handoverCertPDFService } from '@/services/handoverCertPDFService';

const handoverKey = (pid: string) => ['handover', pid] as const;

export function useHandover(projectId?: string) {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: handoverKey(projectId ?? ''),
    enabled: !!projectId,
    queryFn: async () => {
      const [handoverPkg, gateStatus] = await Promise.all([
        handoverService.getHandoverPackage(projectId!),
        handoverService.checkGateStatus(projectId!),
      ]);
      return { handoverPkg, gateStatus };
    },
  });

  const inv = () => qc.invalidateQueries({ queryKey: handoverKey(projectId ?? '') });

  const initializeHandover = async () => {
    if (!projectId) throw new Error('Project ID is required');
    const pkg = await handoverService.initializeHandoverPackage(projectId);
    await inv();
    return pkg;
  };

  const updateChecklistItem = async (
    itemId: string,
    status: 'PENDING' | 'DONE' | 'WAIVED',
    params?: { evidence_document_id?: string; waived_reason?: string },
  ) => {
    const updated = await handoverService.updateChecklistItemStatus(itemId, status, params);
    await inv();
    return updated;
  };

  const submitHandover = async (params: {
    client_signatory_name: string;
    client_signatory_designation: string;
    signature_base64: string;
  }) => {
    if (!projectId) throw new Error('Project ID is required');
    const res = await handoverService.submitHandoverSignOff(projectId, params);
    await inv();
    return res;
  };

  const generateCertificate = async () => {
    if (!projectId) throw new Error('Project ID is required');
    return handoverCertPDFService.generateAndFileHandoverCertificate(projectId);
  };

  return {
    handoverPkg: q.data?.handoverPkg ?? null,
    gateStatus: q.data?.gateStatus ?? null,
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    initializeHandover,
    updateChecklistItem,
    submitHandover,
    generateCertificate,
  };
}

export default useHandover;
