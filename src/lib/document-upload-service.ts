// ============================================================
// JEET ERP — Document Upload Service
// Client-side file hashing, storage uploads, edge function trigger & status polling
// ============================================================

import { supabase } from './supabase';
import { documentService } from './document-service';
import { eventService } from '@/services/eventService';
import type { Document, DocumentEntityType } from '../types/document.types';

/**
 * Computes SHA-256 hash of a file client-side using Web Crypto API.
 */
export async function computeFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Uploads a file to Supabase Storage private 'documents' bucket.
 */
export async function uploadToStorage(file: File, path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('documents')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    console.error('Storage upload failed:', error);
    throw error;
  }

  return data.path;
}

/**
 * Triggers the Supabase Edge Function to analyze the document via Gemini.
 */
export async function triggerProcessing(documentId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('process-document', {
    body: { document_id: documentId }
  });

  if (error) {
    // Non-fatal: AI processing is optional (no Gemini key / edge function not deployed)
    console.warn('AI document processing unavailable; document kept for manual review.');
    throw error;
  }
}

/**
 * Uploads a file, checks for duplicates, creates the database record,
 * and triggers AI classification in one end-to-end pipeline.
 */
export async function runUploadPipeline(
  file: File,
  entityType: DocumentEntityType,
  entityId?: string,
  tags: string[] = [],
  isConfidential: boolean = false,
  supersedesId?: string // for revision uploads
): Promise<Document> {
  // A. Get current user
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Authentication required');

  // B. Compute file hash
  const fileHash = await computeFileHash(file);

  // C. Unless uploading a revision, check for duplicates
  if (!supersedesId) {
    const duplicate = await documentService.checkDuplicate(fileHash);
    if (duplicate) {
      throw new Error(`DUPLICATE_FOUND:${duplicate.id}:${duplicate.title}`);
    }
  }

  // D. Create unique storage path: entity_type/entity_id/filename_timestamp.ext
  const timestamp = Date.now();
  const fileExt = file.name.split('.').pop() || '';
  const folder = entityId ? `${entityType}/${entityId}` : `${entityType}/COMPANY`;
  const storagePath = `${folder}/${timestamp}_${file.name}`;

  // E. Upload to storage
  await uploadToStorage(file, storagePath);

  // F. Resolve revision number
  let revisionNumber = 1;
  let revisionLabel = 'Rev 1';
  if (supersedesId) {
    const { data: superDoc } = await supabase
      .from('documents')
      .select('revision_number')
      .eq('id', supersedesId)
      .single();
    if (superDoc) {
      revisionNumber = (superDoc.revision_number || 0) + 1;
      revisionLabel = `Rev ${revisionNumber}`;
    }
  }

  // G. Create document record in PROCESSING status
  const documentRecord = await documentService.createDocumentRecord({
    entity_type: entityType,
    entity_id: entityId || null,
    title: file.name.replace(/\.[^/.]+$/, ""), // remove ext for title
    original_filename: file.name,
    file_ext: fileExt.toLowerCase(),
    mime_type: file.type || 'application/octet-stream',
    file_size_bytes: file.size,
    file_hash: fileHash,
    storage_path: storagePath,
    category: 'OTHER',         // default until AI classifies
    subcategory: 'UNCLASSIFIED', // default until AI classifies
    references: [],
    revision_number: revisionNumber,
    revision_label: revisionLabel,
    supersedes_id: supersedesId || null,
    is_latest_revision: true,
    status: 'PROCESSING',
    tags,
    is_confidential: isConfidential,
    is_active: true,
    uploaded_by: user.id
  });

  // H. If supersedesId is provided, mark the old revision as not latest
  if (supersedesId) {
    await supabase
      .from('documents')
      .update({ is_latest_revision: false })
      .eq('id', supersedesId);

    // Log revision action on superseding doc
    await documentService.logActivity(supersedesId, 'REVISED', user.id, {
      new_revision_id: documentRecord.id
    });
  }

  // I. Log UPLOADED action
  await documentService.logActivity(documentRecord.id, 'UPLOADED', user.id);

  // Emit event on system event bus
  await eventService.emitEvent(
    'document.uploaded',
    'DOCUMENT',
    documentRecord.id,
    documentRecord.entity_type === 'PROJECT' ? documentRecord.entity_id || undefined : undefined,
    {
      title: documentRecord.title,
      original_filename: documentRecord.original_filename,
      file_size_bytes: documentRecord.file_size_bytes
    },
    user.id
  ).catch(err => console.error('Failed to emit document.uploaded event:', err));

  // J. Trigger Edge Function asynchronously
  try {
    await triggerProcessing(documentRecord.id);
  } catch (err) {
    console.warn('AI document processing unavailable; marking document for manual review.');
    // Mark as NEEDS_REVIEW so it doesn't get stuck in PROCESSING forever
    await supabase
      .from('documents')
      .update({ status: 'NEEDS_REVIEW' })
      .eq('id', documentRecord.id);
  }

  return documentRecord;
}
