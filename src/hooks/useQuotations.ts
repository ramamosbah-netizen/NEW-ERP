// ============================================================
// Aura ERP — Quotation Module React Hooks (React Query)
// ============================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { quotationService, type QuotationFilters } from '@/lib/quotation-service';

const qKeys = {
  lists: ['quotations', 'list'] as const,
  list: (f: QuotationFilters) => ['quotations', 'list', f] as const,
  detail: (id: string) => ['quotations', 'detail', id] as const,
  templates: ['quotations', 'templates'] as const,
};

// 1. List
export function useQuotations(filters: QuotationFilters = {}) {
  const q = useQuery({ queryKey: qKeys.list(filters), queryFn: () => quotationService.fetchQuotations(filters) });
  return {
    quotations: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
  };
}

// 2. Detail + actions
export function useQuotation(id: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: qKeys.detail(id),
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return quotationService.fetchQuotationById(id, data?.user?.id);
    },
  });

  const inv = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: qKeys.detail(id) }),
      qc.invalidateQueries({ queryKey: qKeys.lists }),
    ]);
  };

  const submitForReview = async () => { const r = await quotationService.submitForReview(id); await inv(); return r; };
  const commercialApprove = async (comment: string) => { const r = await quotationService.commercialApprove(id, comment); await inv(); return r; };
  const commercialReject = async (reason: string) => { const r = await quotationService.commercialReject(id, reason); await inv(); return r; };
  const gmApprove = async (comment: string, signatureRef: string) => { const r = await quotationService.gmApprove(id, comment, signatureRef); await inv(); return r; };
  const gmReject = async (reason: string) => { const r = await quotationService.gmReject(id, reason); await inv(); return r; };
  const sendToClient = async () => { const r = await quotationService.sendToClient(id); await inv(); return r; };
  const markAccepted = async (poNumber: string) => { const r = await quotationService.markAccepted(id, poNumber); await inv(); return r; };
  const markRejected = async (reason: string) => { const r = await quotationService.markRejected(id, reason); await inv(); return r; };
  const createRevision = async () => { const newId = await quotationService.createRevision(id); await qc.invalidateQueries({ queryKey: qKeys.lists }); return newId; };
  const getLinkedProject = async () => quotationService.getLinkedProject(id);
  const linkToProject = async (projectId: string) => { const r = await quotationService.linkToProject(id, projectId); await inv(); return r; };

  return {
    quotation: q.data ?? null,
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    actions: {
      submitForReview, commercialApprove, commercialReject, gmApprove, gmReject,
      sendToClient, markAccepted, markRejected, createRevision, getLinkedProject, linkToProject,
    },
  };
}

// 3. Clause-library templates
export function useQuotationTemplates() {
  const q = useQuery({
    queryKey: qKeys.templates,
    queryFn: async () => {
      const { data, error } = await supabase.from('quotation_templates').select('*').order('template_name');
      if (error) throw error;
      return data || [];
    },
  });
  return {
    templates: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
  };
}
