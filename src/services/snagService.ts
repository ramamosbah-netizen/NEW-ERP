// ============================================================
// JEET ERP — Snag / Punch List Service
// ============================================================

import { supabase } from '@/lib/supabase';
import { Snag, SnagSeverity, SnagStatus, SnagSource } from '@/types/snag.types';
import { eventService } from './eventService';

export const snagService = {
  /**
   * Retrieves all snags for a specific project.
   */
  async getSnagsByProject(projectId: string): Promise<Snag[]> {
    const { data, error } = await supabase
      .from('snags')
      .select(`
        *,
        project:projects(name, project_number),
        assignee:profiles!snags_assigned_to_fkey(full_name),
        closer:profiles!snags_closed_by_fkey(full_name),
        verifier:profiles!snags_verified_by_fkey(full_name),
        creator:profiles!snags_created_by_fkey(full_name)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      ...row,
      project_name: row.project?.name,
      project_number: row.project?.project_number,
      assigned_to_name: row.assignee?.full_name,
      closed_by_name: row.closer?.full_name,
      verified_by_name: row.verifier?.full_name,
      created_by_name: row.creator?.full_name
    })) as Snag[];
  },

  /**
   * Retrieves a single snag by ID.
   */
  async getSnagById(snagId: string): Promise<Snag> {
    const { data, error } = await supabase
      .from('snags')
      .select(`
        *,
        project:projects(name, project_number),
        assignee:profiles!snags_assigned_to_fkey(full_name),
        closer:profiles!snags_closed_by_fkey(full_name),
        verifier:profiles!snags_verified_by_fkey(full_name),
        creator:profiles!snags_created_by_fkey(full_name)
      `)
      .eq('id', snagId)
      .single();

    if (error) throw error;

    return {
      ...data,
      project_name: data.project?.name,
      project_number: data.project?.project_number,
      assigned_to_name: data.assignee?.full_name,
      closed_by_name: data.closer?.full_name,
      verified_by_name: data.verifier?.full_name,
      created_by_name: data.creator?.full_name
    } as Snag;
  },

  /**
   * Creates a new snag.
   */
  async createSnag(params: {
    project_id: string;
    source: SnagSource;
    system: string;
    location: string;
    description: string;
    severity: SnagSeverity;
    photo_paths?: string[];
    assigned_to?: string;
    subcontractor_name?: string;
    target_date?: string;
    tc_test_result_id?: string;
  }): Promise<Snag> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required to create a snag');

    // Insert snag. Trigger generates snag_number
    const { data: snag, error: insertErr } = await supabase
      .from('snags')
      .insert({
        project_id: params.project_id,
        source: params.source,
        system: params.system,
        location: params.location,
        description: params.description,
        severity: params.severity,
        photo_paths: params.photo_paths || [],
        assigned_to: params.assigned_to || null,
        subcontractor_name: params.subcontractor_name || null,
        target_date: params.target_date || null,
        tc_test_result_id: params.tc_test_result_id || null,
        created_by: user.id,
        status: 'OPEN'
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Emit event: snag.created if assigned_to is set
    if (params.assigned_to) {
      await eventService.emitEvent(
        'snag.created',
        'SNAG',
        snag.id,
        snag.project_id,
        {
          snag_number: snag.snag_number,
          location: snag.location,
          description: snag.description,
          assigned_to: snag.assigned_to
        }
      );
    }

    return this.getSnagById(snag.id);
  },

  /**
   * Updates snag details.
   */
  async updateSnag(snagId: string, updates: Partial<Snag>): Promise<Snag> {
    const { data, error } = await supabase
      .from('snags')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', snagId)
      .select()
      .single();

    if (error) throw error;
    return this.getSnagById(data.id);
  },

  /**
   * Enforces transition constraints and closer/verifier segregation.
   */
  async transitionSnagStatus(
    snagId: string,
    newStatus: SnagStatus,
    params: {
      photo_paths?: string[]; // closed evidence photos
      comments?: string;
      client_accepted?: boolean;
      deferral_justification?: string;
    } = {}
  ): Promise<Snag> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required to transition snag status');

    const snag = await this.getSnagById(snagId);
    const updates: any = { status: newStatus };

    if (newStatus === 'READY_FOR_INSPECTION') {
      updates.closed_by = user.id;
      updates.closed_evidence_photos = params.photo_paths || [];
    } else if (newStatus === 'CLOSED') {
      updates.verified_by = user.id;
      updates.client_accepted = params.client_accepted ?? true;

      // Enforce the closer !== verifier guard in application logic
      const closerId = snag.closed_by || user.id; // if closed directly, current user is closer
      const verifierId = user.id;

      if (closerId === verifierId) {
        throw new Error(
          'Audit Integrity Exception: The user who resolves a snag cannot be the same user who verifies and closes it.'
        );
      }
    } else if (newStatus === 'DEFERRED_TO_DLP') {
      if (!params.deferral_justification) {
        throw new Error('Deferral justification is mandatory to defer a snag to DLP.');
      }
      updates.deferral_justification = params.deferral_justification;
    }

    const { data, error } = await supabase
      .from('snags')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', snagId)
      .select()
      .single();

    if (error) {
      if (error.message?.includes('Closer cannot be the same user')) {
        throw new Error(
          'Audit Integrity Exception: Closer and verifier cannot be the same person on snag inspections.'
        );
      }
      throw error;
    }

    // Check if ALL snags for this project are now closed, deferring to DLP or resolved.
    // If so, emit snag.all_closed to alert the project manager.
    await this.checkAndEmitAllClosedEvent(snag.project_id);

    return this.getSnagById(data.id);
  },

  /**
   * Helper to check if all snags for a project are closed or deferred, and emit an event.
   */
  async checkAndEmitAllClosedEvent(projectId: string): Promise<boolean> {
    const { data: openSnags, error } = await supabase
      .from('snags')
      .select('id')
      .eq('project_id', projectId)
      .in('status', ['OPEN', 'IN_PROGRESS', 'READY_FOR_INSPECTION']);

    if (error) {
      console.error('Failed to query open snags:', error);
      return false;
    }

    if (openSnags && openSnags.length === 0) {
      const { data: project } = await supabase
        .from('projects')
        .select('name, project_number')
        .eq('id', projectId)
        .single();

      if (project) {
        await eventService.emitEvent(
          'snag.all_closed',
          'PROJECT',
          projectId,
          projectId,
          {
            project_name: project.name,
            project_number: project.project_number
          }
        );
        return true;
      }
    }

    return false;
  }
};

export default snagService;
