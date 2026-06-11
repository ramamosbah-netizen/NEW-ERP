// ============================================================
// JEET ERP — Document Management System Service
// Core database operations, metadata corrections, review flows, and audit logs
// ============================================================

import { supabase } from './supabase';
import { documentEditSchema } from './document-validation';
import type { 
  Document, 
  DocumentFilters, 
  DocumentStatus, 
  DocumentAction, 
  DocumentActivityRecord,
  DocumentExpiryAlert
} from '../types/document.types';

// Helper to get profile full name
async function getUserFullName(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single();
  if (error || !data) return 'System User';
  return data.full_name;
}

export const documentService = {
  
  // 1. Fetch documents matching filters
  async fetchDocuments(filters: DocumentFilters): Promise<Document[]> {
    let query = supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    // Filter by active
    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    } else {
      query = query.eq('is_active', true);
    }

    // Entity mapping
    if (filters.entity_type) {
      query = query.eq('entity_type', filters.entity_type);
    }
    if (filters.entity_id) {
      query = query.eq('entity_id', filters.entity_id);
    }

    // Classification
    if (filters.category) {
      query = query.eq('category', filters.category);
    }
    if (filters.subcategory) {
      query = query.eq('subcategory', filters.subcategory);
    }

    // Status
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    // Uploaded by
    if (filters.uploaded_by) {
      query = query.eq('uploaded_by', filters.uploaded_by);
    }

    // Expiry date range
    if (filters.expiry_from) {
      query = query.gte('expiry_date', filters.expiry_from);
    }
    if (filters.expiry_to) {
      query = query.lte('expiry_date', filters.expiry_to);
    }

    // Upload date range
    if (filters.date_from) {
      query = query.gte('created_at', filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte('created_at', filters.date_to);
    }

    // Confidentiality
    if (filters.is_confidential !== undefined) {
      query = query.eq('is_confidential', filters.is_confidential);
    }

    // Search query fallback (if full-text search service is not used directly)
    if (filters.search) {
      const s = `%${filters.search}%`;
      query = query.or(`title.ilike.${s},original_filename.ilike.${s},ai_summary.ilike.${s}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []) as Document[];
  },

  // 2. Fetch single document details (with revisions and activity logs)
  async fetchDocumentById(id: string): Promise<Document | null> {
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (docError) {
      if (docError.code === 'PGRST116') return null; // not found
      throw docError;
    }

    // Fetch activity
    const { data: activity, error: actError } = await supabase
      .from('document_activity')
      .select('*')
      .eq('document_id', id)
      .order('created_at', { ascending: false });

    if (actError) throw actError;

    // Resolve user names for activity logs
    const activityWithNames = await Promise.all(
      (activity || []).map(async (act) => {
        const name = await getUserFullName(act.user_id);
        return {
          ...act,
          user_name: name
        } as DocumentActivityRecord;
      })
    );

    // Fetch revision history: documents in same chain (matching original name/hashes or supersedes relationships)
    // We trace by supersedes_id recursion or query where supersedes_id = id or id = doc.supersedes_id
    // But a cleaner way is fetching all documents with the same title or original_filename, or specifically tracking the chain
    // For this build, let's fetch all revisions where id = doc.supersedes_id or supersedes_id = id or supersedes_id = doc.supersedes_id
    let revisionQuery = supabase
      .from('documents')
      .select('id, title, original_filename, file_ext, file_size_bytes, revision_number, revision_label, status, created_at, uploaded_by')
      .eq('is_active', true)
      .order('revision_number', { ascending: false });

    if (doc.supersedes_id) {
      revisionQuery = revisionQuery.or(`id.eq.${doc.supersedes_id},supersedes_id.eq.${doc.supersedes_id},supersedes_id.eq.${doc.id}`);
    } else {
      revisionQuery = revisionQuery.eq('supersedes_id', doc.id);
    }

    const { data: revisions } = await revisionQuery;

    // Resolve names for uploaders & reviewers
    const uploaderName = await getUserFullName(doc.uploaded_by);
    let reviewerName = undefined;
    if (doc.reviewed_by) {
      reviewerName = await getUserFullName(doc.reviewed_by);
    }

    // Resolve project name if entity is PROJECT
    let projectName = undefined;
    if (doc.entity_type === 'PROJECT' && doc.entity_id) {
      const { data: proj } = await supabase
        .from('projects')
        .select('name')
        .eq('id', doc.entity_id)
        .single();
      projectName = proj?.name;
    }

    return {
      ...doc,
      uploader_name: uploaderName,
      reviewer_name: reviewerName,
      project_name: projectName,
      activity: activityWithNames,
      revisions: revisions || []
    } as Document;
  },

  // 3. Create document record
  async createDocumentRecord(docData: Omit<Document, 'id' | 'created_at' | 'updated_at'>): Promise<Document> {
    const { data, error } = await supabase
      .from('documents')
      .insert(docData)
      .select()
      .single();

    if (error) throw error;
    return data as Document;
  },

  // 4. Get short-lived (60 min) signed URL for document preview/download
  async getSignedUrl(storagePath: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    if (error) throw error;
    return data.signedUrl;
  },

  // 5. Update metadata (human corrections or tag updates)
  async updateMetadata(id: string, updates: any): Promise<boolean> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required');

    // Parse updates via Zod
    const cleanUpdates = documentEditSchema.parse(updates);

    // Fetch old record for audit logging
    const { data: oldDoc } = await supabase
      .from('documents')
      .select('title, category, subcategory, expiry_date, tags, amount_aed, revision_label')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('documents')
      .update({
        ...cleanUpdates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    // Log activity
    await this.logActivity(id, 'METADATA_UPDATED', user.id, {
      old: oldDoc,
      new: cleanUpdates
    });

    // If expiry date changed, recreate/update alerts
    if (cleanUpdates.expiry_date !== oldDoc?.expiry_date) {
      await this.refreshExpiryAlerts(id, cleanUpdates.expiry_date);
    }

    return true;
  },

  // 6. Review document (verify or reject AI classification)
  async reviewDocument(id: string, action: 'VERIFIED' | 'REJECTED', corrections?: any): Promise<boolean> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required');

    const updateFields: any = {
      status: action,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // If human makes corrections during review:
    if (corrections) {
      const cleanCorrections = documentEditSchema.parse(corrections);
      Object.assign(updateFields, cleanCorrections);
    }

    const { error } = await supabase
      .from('documents')
      .update(updateFields)
      .eq('id', id);

    if (error) throw error;

    // Log activity
    await this.logActivity(id, 'REVIEWED', user.id, {
      action,
      corrections: corrections || null
    });

    // Re-verify/re-create expiry alerts if date is present
    const finalExpiryDate = corrections?.expiry_date || (await supabase.from('documents').select('expiry_date').eq('id', id).single()).data?.expiry_date;
    if (finalExpiryDate) {
      await this.refreshExpiryAlerts(id, finalExpiryDate);
    }

    return true;
  },

  // 7. Soft delete document
  async deleteDocument(id: string): Promise<boolean> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required');

    const { error } = await supabase
      .from('documents')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    // Log activity
    await this.logActivity(id, 'DELETED', user.id);

    // Delete pending alerts
    await supabase
      .from('document_expiry_alerts')
      .delete()
      .eq('document_id', id);

    return true;
  },

  // 8. Find duplicate file in database
  async checkDuplicate(fileHash: string): Promise<Document | null> {
    const { data, error } = await supabase
      .from('documents')
      .select('id, title, original_filename, status, created_at')
      .eq('file_hash', fileHash)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) return null;
    if (data && data.length > 0) return data[0] as Document;
    return null;
  },

  // Helper: Log Activity
  async logActivity(documentId: string, action: DocumentAction, userId: string, detail?: any): Promise<void> {
    await supabase.from('document_activity').insert({
      document_id: documentId,
      action,
      user_id: userId,
      detail: detail || null
    });
  },

  // Helper: Refresh expiry alerts based on categories
  async refreshExpiryAlerts(documentId: string, expiryDate?: string | null): Promise<void> {
    // A. Delete existing pending alerts for this document
    await supabase
      .from('document_expiry_alerts')
      .delete()
      .eq('document_id', documentId)
      .eq('status', 'PENDING');

    if (!expiryDate) return;

    // B. Fetch default alert windows from categories based on document category
    const { data: doc } = await supabase
      .from('documents')
      .select('category, subcategory')
      .eq('id', documentId)
      .single();

    if (!doc) return;

    const { data: cat } = await supabase
      .from('document_categories')
      .select('default_expiry_alert_days')
      .eq('category', doc.category)
      .eq('subcategory', doc.subcategory)
      .single();

    const alertWindows = cat?.default_expiry_alert_days || [60, 30, 7];

    // C. Create new alerts
    const alertsToInsert = alertWindows.map((days: number) => ({
      document_id: documentId,
      expiry_date: expiryDate,
      alert_days_before: days,
      status: 'PENDING'
    }));

    if (alertsToInsert.length > 0) {
      await supabase.from('document_expiry_alerts').insert(alertsToInsert);
    }
  }
};
