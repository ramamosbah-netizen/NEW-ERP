// ============================================================
// JEET ERP — Quotation Module React Hooks
// Custom hooks for fetching data and executing transitions
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  quotationService, 
  type QuotationFilters, 
  type QuotationStatus 
} from '@/lib/quotation-service';
import type { QuotationInput } from '@/lib/quotation-validation';

// 1. Fetch list of quotations
export function useQuotations(filters: QuotationFilters = {}) {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const data = await quotationService.fetchQuotations(filters);
      setQuotations(data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching quotations:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return { quotations, loading, error, refetch: fetchList };
}

// 2. Fetch single quotation details & action triggers
export function useQuotation(id: string) {
  const [quotation, setQuotation] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);

  // Get current user ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setCurrentUserId(data.user.id);
    });
  }, []);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await quotationService.fetchQuotationById(id, currentUserId);
      setQuotation(data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching quotation detail:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id, currentUserId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Actions wrapped in state refreshers
  const submitForReview = async () => {
    const res = await quotationService.submitForReview(id);
    await fetchDetail();
    return res;
  };

  const commercialApprove = async (comment: string) => {
    const res = await quotationService.commercialApprove(id, comment);
    await fetchDetail();
    return res;
  };

  const commercialReject = async (reason: string) => {
    const res = await quotationService.commercialReject(id, reason);
    await fetchDetail();
    return res;
  };

  const gmApprove = async (comment: string, signatureRef: string) => {
    const res = await quotationService.gmApprove(id, comment, signatureRef);
    await fetchDetail();
    return res;
  };

  const gmReject = async (reason: string) => {
    const res = await quotationService.gmReject(id, reason);
    await fetchDetail();
    return res;
  };

  const sendToClient = async () => {
    const res = await quotationService.sendToClient(id);
    await fetchDetail();
    return res;
  };

  const markAccepted = async (poNumber: string) => {
    const res = await quotationService.markAccepted(id, poNumber);
    await fetchDetail();
    return res;
  };

  const markRejected = async (reason: string) => {
    const res = await quotationService.markRejected(id, reason);
    await fetchDetail();
    return res;
  };

  const createRevision = async () => {
    const newId = await quotationService.createRevision(id);
    return newId;
  };

  const getLinkedProject = async () => {
    return quotationService.getLinkedProject(id);
  };

  const linkToProject = async (projectId: string) => {
    const res = await quotationService.linkToProject(id, projectId);
    await fetchDetail();
    return res;
  };

  return {
    quotation,
    loading,
    error,
    refetch: fetchDetail,
    actions: {
      submitForReview,
      commercialApprove,
      commercialReject,
      gmApprove,
      gmReject,
      sendToClient,
      markAccepted,
      markRejected,
      createRevision,
      getLinkedProject,
      linkToProject
    }
  };
}

// 3. Fetch reusable templates for clause library
export function useQuotationTemplates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quotation_templates')
        .select('*')
        .order('template_name');

      if (error) throw error;
      setTemplates(data || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching quotation templates:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return { templates, loading, error, refetch: fetchTemplates };
}
