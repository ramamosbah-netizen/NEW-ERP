// ============================================================
// Aura ERP — Document Review Queue React Hook (React Query)
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Document } from '@/types/document.types';

export function useReviewQueue() {
  const q = useQuery({
    queryKey: ['documents', 'review-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('status', 'NEEDS_REVIEW')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Document[];
    },
  });

  return {
    documents: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
  };
}
