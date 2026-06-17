// ============================================================
// JEET ERP — Document Upload Queue React Hook
// Multi-file queue with state tracking, hash checks, and pipeline execution
// ============================================================

import { logger } from '@/lib/logger';
import { useState, useCallback } from 'react';
import { runUploadPipeline } from '@/lib/document-upload-service';
import type { UploadQueueItem, DocumentEntityType } from '@/types/document.types';

export function useDocumentUpload(
  entityType: DocumentEntityType,
  entityId?: string
) {
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);

  // Add files to upload queue
  const addFiles = useCallback((files: File[], tags: string[] = [], isConfidential: boolean = false) => {
    const newItems = files.map((file) => {
      const item: UploadQueueItem = {
        id: Math.random().toString(36).substring(7),
        file,
        filename: file.name,
        fileSize: file.size,
        status: 'queued',
        progress: 0
      };
      return item;
    });

    setQueue((prev) => [...prev, ...newItems]);
    
    // Start uploading each added file asynchronously
    newItems.forEach((item) => {
      processUpload(item, tags, isConfidential);
    });
  }, [entityType, entityId]);

  // Process individual upload
  const processUpload = useCallback(async (
    item: UploadQueueItem,
    tags: string[],
    isConfidential: boolean,
    supersedesId?: string // for revision override
  ) => {
    // Helper to update individual item state
    const updateItem = (updates: Partial<UploadQueueItem>) => {
      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, ...updates } : q))
      );
    };

    try {
      updateItem({ status: 'uploading', progress: 20 });
      
      // Simulate/approximate progress increments
      const progressInterval = setInterval(() => {
        setQueue((prev) =>
          prev.map((q) => {
            if (q.id === item.id && q.status === 'uploading' && q.progress < 80) {
              return { ...q, progress: q.progress + 10 };
            }
            return q;
          })
        );
      }, 500);

      // Run main upload pipeline
      const doc = await runUploadPipeline(
        item.file,
        entityType,
        entityId,
        tags,
        isConfidential,
        supersedesId
      );

      clearInterval(progressInterval);
      updateItem({ progress: 90, status: 'classifying' });

      // Poll or wait for processing to update from processing to filed/review
      // The Edge Function runs async, but we can query it after a short delay
      let status: 'filed' | 'review' = 'filed';
      if (doc.status === 'NEEDS_REVIEW') {
        status = 'review';
      }

      updateItem({
        status: status,
        progress: 100,
        documentId: doc.id,
        category: doc.category,
        subcategory: doc.subcategory,
        aiConfidence: doc.ai_confidence
      });

    } catch (err: any) {
      logger.error(`Upload error for ${item.filename}:`, err);
      
      let errorMsg = err.message || 'Upload failed';
      if (errorMsg.startsWith('DUPLICATE_FOUND:')) {
        // Format: DUPLICATE_FOUND:id:title
        errorMsg = err.message; // Let UI parse it specifically
      }
      
      updateItem({
        status: 'error',
        progress: 0,
        error: errorMsg
      });
    }
  }, [entityType, entityId]);

  // Remove item from queue
  const removeQueueItem = useCallback((itemId: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  // Retry upload (optionally as revision or override)
  const retryUpload = useCallback((itemId: string, tags: string[] = [], isConfidential: boolean = false, supersedesId?: string) => {
    const item = queue.find((q) => q.id === itemId);
    if (!item) return;

    // Reset state to queued
    setQueue((prev) =>
      prev.map((q) =>
        q.id === itemId
          ? { ...q, status: 'queued', progress: 0, error: undefined }
          : q
      )
    );

    processUpload(item, tags, isConfidential, supersedesId);
  }, [queue, processUpload]);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  return {
    queue,
    addFiles,
    removeQueueItem,
    retryUpload,
    clearQueue
  };
}
