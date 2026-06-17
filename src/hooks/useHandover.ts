// ============================================================
// JEET ERP — Project Handover & Closeout Hook
// ============================================================

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from 'react';
import { handoverService } from '@/services/handoverService';
import { handoverCertPDFService } from '@/services/handoverCertPDFService';
import { HandoverPackage, HandoverGateStatus, HandoverChecklistItem } from '@/types/handover.types';

export function useHandover(projectId?: string) {
  const [handoverPkg, setHandoverPkg] = useState<HandoverPackage | null>(null);
  const [gateStatus, setGateStatus] = useState<HandoverGateStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchHandoverDetails = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError(null);

      // Fetch package (may be null if not initialized)
      const pkg = await handoverService.getHandoverPackage(projectId);
      setHandoverPkg(pkg);

      // Fetch gate compliance status
      const gates = await handoverService.checkGateStatus(projectId);
      setGateStatus(gates);
    } catch (err: any) {
      logger.error('Error fetching handover details:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      fetchHandoverDetails();
    }
  }, [projectId, fetchHandoverDetails]);

  const initializeHandover = async () => {
    if (!projectId) throw new Error('Project ID is required');
    try {
      setLoading(true);
      const pkg = await handoverService.initializeHandoverPackage(projectId);
      await fetchHandoverDetails();
      return pkg;
    } catch (err: any) {
      logger.error('Failed to initialize handover package:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateChecklistItem = async (
    itemId: string,
    status: 'PENDING' | 'DONE' | 'WAIVED',
    params?: {
      evidence_document_id?: string;
      waived_reason?: string;
    }
  ) => {
    try {
      const updated = await handoverService.updateChecklistItemStatus(itemId, status, params);
      await fetchHandoverDetails();
      return updated;
    } catch (err: any) {
      logger.error('Failed to update checklist item status:', err);
      throw err;
    }
  };

  const submitHandover = async (params: {
    client_signatory_name: string;
    client_signatory_designation: string;
    signature_base64: string;
  }) => {
    if (!projectId) throw new Error('Project ID is required');
    try {
      const res = await handoverService.submitHandoverSignOff(projectId, params);
      await fetchHandoverDetails();
      return res;
    } catch (err: any) {
      logger.error('Failed to submit handover sign-off:', err);
      throw err;
    }
  };

  const generateCertificate = async () => {
    if (!projectId) throw new Error('Project ID is required');
    try {
      return await handoverCertPDFService.generateAndFileHandoverCertificate(projectId);
    } catch (err: any) {
      logger.error('Failed to compile handover certificate PDF:', err);
      throw err;
    }
  };

  return {
    handoverPkg,
    gateStatus,
    loading,
    error,
    refetch: fetchHandoverDetails,
    initializeHandover,
    updateChecklistItem,
    submitHandover,
    generateCertificate
  };
}

export default useHandover;
