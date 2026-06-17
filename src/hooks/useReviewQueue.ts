// ============================================================
// JEET ERP — Document Review Queue React Hook
// Fetches documents in NEEDS_REVIEW status
// ============================================================

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Document } from '@/types/document.types';

export function useReviewQueue() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: fetchErr } = await supabase
        .from('documents')
        .select('*')
        .eq('status', 'NEEDS_REVIEW')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setDocuments(data || []);
      setError(null);
    } catch (err: any) {
      logger.error('Error fetching review queue documents:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  return { documents, loading, error, refetch: fetchQueue };
}
