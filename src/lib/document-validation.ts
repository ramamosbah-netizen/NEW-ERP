// ============================================================
// JEET ERP — Document Management System Validation Schemas
// Zod schemas for documents, metadata, upload limits
// ============================================================

import { z } from 'zod';
import { ALLOWED_FILE_EXTENSIONS, MAX_FILE_SIZE_BYTES } from '../constants/document.constants';

// 1. Schema matching the Gemini AI model response
export const geminiClassificationResponseSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().min(1, 'Subcategory is required'),
  confidence: z.number().min(0).max(1),
  title_suggestion: z.string().min(1, 'Title suggestion is required'),
  references: z.array(z.string()).default([]),
  issue_date: z.string().nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  parties: z.array(z.string()).default([]),
  amount_aed: z.number().nullable().optional(),
  revision: z.string().nullable().optional(),
  summary: z.string().default('')
});

// 2. Document upload schema validation (for metadata side)
export const documentUploadMetadataSchema = z.object({
  entity_type: z.enum(['PROJECT', 'CLIENT', 'SUPPLIER', 'COMPANY', 'AMC']),
  entity_id: z.string().uuid().optional().nullable(),
  is_confidential: z.boolean().default(false),
  tags: z.array(z.string()).default([])
});

// 3. Document edit/correction validation schema
export const documentEditSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().min(1, 'Subcategory is required'),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').nullable().optional().or(z.literal('')),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').nullable().optional().or(z.literal('')),
  amount_aed: z.number().nonnegative('Amount must be non-negative').nullable().optional(),
  revision_label: z.string().nullable().optional().or(z.literal('')),
  tags: z.array(z.string()).default([]),
  is_confidential: z.boolean().default(false)
});

// Helper for UI file validation
export const validateUploadedFile = (file: File): { valid: boolean; error?: string } => {
  const fileExt = file.name.split('.').pop()?.toLowerCase();
  
  if (!fileExt || !ALLOWED_FILE_EXTENSIONS.includes(fileExt as any)) {
    return {
      valid: false,
      error: `Unsupported file extension .${fileExt}. Allowed formats: ${ALLOWED_FILE_EXTENSIONS.join(', ')}`
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeInMB = (MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `File size exceeds the maximum limit of ${sizeInMB}MB.`
    };
  }

  return { valid: true };
};

export type GeminiClassificationInput = z.infer<typeof geminiClassificationResponseSchema>;
export type DocumentUploadMetadataInput = z.infer<typeof documentUploadMetadataSchema>;
export type DocumentEditInput = z.infer<typeof documentEditSchema>;
