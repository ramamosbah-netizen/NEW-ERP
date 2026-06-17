// ============================================================
// Aura ERP — Document Management System React Hooks (React Query)
// ============================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { documentService } from '@/lib/document-service';
import type { DocumentFilters } from '@/types/document.types';

const docKeys = {
  lists: ['documents', 'list'] as const,
  list: (f: DocumentFilters) => ['documents', 'list', f] as const,
  detail: (id: string) => ['documents', 'detail', id] as const,
};

// 1. Document list
export function useDocuments(filters: DocumentFilters = {}) {
  const q = useQuery({ queryKey: docKeys.list(filters), queryFn: () => documentService.fetchDocuments(filters) });
  return {
    documents: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
  };
}

// 2. Document detail (+ signed preview URL) and actions
export function useDocument(id: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: docKeys.detail(id),
    enabled: !!id,
    queryFn: async () => {
      const document = await documentService.fetchDocumentById(id);
      let signedUrl: string | null = null;
      if (document?.storage_path) signedUrl = await documentService.getSignedUrl(document.storage_path);
      return { document, signedUrl };
    },
  });

  const inv = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: docKeys.detail(id) }),
      qc.invalidateQueries({ queryKey: docKeys.lists }),
    ]);
  };

  const updateMetadata = async (updates: any) => { const s = await documentService.updateMetadata(id, updates); if (s) await inv(); return s; };
  const reviewDocument = async (action: 'VERIFIED' | 'REJECTED', corrections?: any) => { const s = await documentService.reviewDocument(id, action, corrections); if (s) await inv(); return s; };
  const deleteDocument = async () => { const s = await documentService.deleteDocument(id); if (s) await inv(); return s; };

  return {
    document: q.data?.document ?? null,
    signedUrl: q.data?.signedUrl ?? null,
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    actions: { updateMetadata, reviewDocument, deleteDocument },
  };
}
