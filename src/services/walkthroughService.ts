// ============================================================
// JEET ERP — Walkthrough & Rapid Snag Logging Service
// ============================================================

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { snagService } from './snagService';
import { Snag, SnagSeverity, SnagSource } from '@/types/snag.types';

export const walkthroughService = {
  /**
   * Log walkthrough details, including client signature and bulk rapid-logged snags.
   */
  async logWalkthrough(params: {
    project_id: string;
    inspector_name: string;
    client_representative: string;
    walkthrough_date: string;
    comments?: string;
    signature_base64?: string; // canvas signature
    snags: {
      system: string;
      location: string;
      description: string;
      severity: SnagSeverity;
      photo_paths?: string[];
    }[];
  }): Promise<{
    snagsCreated: Snag[];
    signaturePath?: string;
  }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required to log walkthrough');

    // 1. Upload signature if base64 provided
    let signaturePath = '';
    if (params.signature_base64) {
      const base64Data = params.signature_base64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `walkthrough_sigs/${params.project_id}_${Date.now()}.png`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('private_documents')
        .upload(filename, buffer, {
          contentType: 'image/png',
          upsert: true
        });

      if (uploadErr) {
        logger.error('Failed to upload walkthrough signature:', uploadErr);
      } else if (uploadData) {
        signaturePath = uploadData.path;
      }
    }

    // 2. Create the snags list
    const snagsCreated: Snag[] = [];
    for (const s of params.snags) {
      try {
        const snag = await snagService.createSnag({
          project_id: params.project_id,
          source: 'CLIENT_WALKTHROUGH',
          system: s.system,
          location: s.location,
          description: `[Walkthrough by ${params.client_representative}] ${s.description}`,
          severity: s.severity,
          photo_paths: s.photo_paths || []
        });
        snagsCreated.push(snag);
      } catch (err) {
        logger.error('Failed to create snag during walkthrough:', err);
      }
    }

    // 3. Log a general comment/meeting event in the system or documents if needed.
    // For this build, we can upload the details and record it in a meeting/activity log.
    // We will register a document if signature exists.
    if (signaturePath) {
      // Find or create closeout documents folder in DMS
      // This is integrated with documentService. In this system, we can insert into public.documents directly.
      const documentTitle = `Walkthrough Sign-off - ${params.client_representative} - ${params.walkthrough_date}`;
      const { data: doc, error: docErr } = await supabase
        .from('documents')
        .insert({
          title: documentTitle,
          file_path: signaturePath,
          category: 'MEETING_MINUTES',
          file_type: 'image/png',
          project_id: params.project_id,
          uploaded_by: user.id
        })
        .select()
        .single();
      
      if (docErr) {
        logger.error('Failed to register walkthrough document in DMS:', docErr);
      }
    }

    return {
      snagsCreated,
      signaturePath: signaturePath || undefined
    };
  }
};

export default walkthroughService;
