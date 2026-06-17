// ============================================================
// JEET ERP — Walkthrough Hook
// ============================================================

import { logger } from '@/lib/logger';
import { useState } from 'react';
import { walkthroughService } from '@/services/walkthroughService';
import { SnagSeverity } from '@/types/snag.types';

export function useWalkthrough() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const logWalkthrough = async (params: {
    project_id: string;
    inspector_name: string;
    client_representative: string;
    walkthrough_date: string;
    comments?: string;
    signature_base64?: string;
    snags: {
      system: string;
      location: string;
      description: string;
      severity: SnagSeverity;
      photo_paths?: string[];
    }[];
  }) => {
    try {
      setSubmitting(true);
      setError(null);
      const res = await walkthroughService.logWalkthrough(params);
      return res;
    } catch (err: any) {
      logger.error('Failed to log walkthrough:', err);
      setError(err);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  return {
    logWalkthrough,
    submitting,
    error
  };
}

export default useWalkthrough;
