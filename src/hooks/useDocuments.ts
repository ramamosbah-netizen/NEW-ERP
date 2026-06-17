// ============================================================
// JEET ERP — Document Management System React Hooks
// Custom hooks for document listings, details, metadata updates, and reviews
// ============================================================

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from 'react';
import { documentService } from '@/lib/document-service';
import type { Document, DocumentFilters, DocumentStatus } from '@/types/document.types';

// 1. Fetch document list
export function useDocuments(filters: DocumentFilters = {}) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const data = await documentService.fetchDocuments(filters);
      setDocuments(data);
      setError(null);
    } catch (err: any) {
      logger.error('Error fetching documents list:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return { documents, loading, error, refetch: fetchList };
}

// 2. Fetch single document details & execute actions
export function useDocument(id: string) {
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await documentService.fetchDocumentById(id);
      setDocument(data);
      setError(null);

      // Generate preview signed URL
      if (data?.storage_path) {
        const url = await documentService.getSignedUrl(data.storage_path);
        setSignedUrl(url);
      }
    } catch (err: any) {
      logger.error('Error fetching document detail:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const updateMetadata = async (updates: any) => {
    const success = await documentService.updateMetadata(id, updates);
    if (success) await fetchDetail();
    return success;
  };

  const reviewDocument = async (action: 'VERIFIED' | 'REJECTED', corrections?: any) => {
    const success = await documentService.reviewDocument(id, action, corrections);
    if (success) await fetchDetail();
    return success;
  };

  const deleteDocument = async () => {
    const success = await documentService.deleteDocument(id);
    if (success) {
      setDocument(null);
      setSignedUrl(null);
    }
    return success;
  };

  return {
    document,
    signedUrl,
    loading,
    error,
    refetch: fetchDetail,
    actions: {
      updateMetadata,
      reviewDocument,
      deleteDocument
    }
  };
}
