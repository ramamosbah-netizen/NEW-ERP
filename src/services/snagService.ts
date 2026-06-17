// ============================================================
// JEET ERP — Snag / Punch List Service
// ============================================================

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { Snag, SnagSeverity, SnagStatus, SnagSource } from '@/types/snag.types';
import { eventService } from './eventService';

// PostgREST embeds are unreliable in this setup (snags has no FK to profiles →
// PGRST200). Enrich rows with project + assignee/closer/verifier/creator names
// via batched separate keyed lookups instead.
async function enrichSnags(rows: any[]): Promise<Snag[]> {
  if (!rows.length) return [];
  const projectIds = [...new Set(rows.map(r => r.project_id).filter(Boolean))];
  const profileIds = [...new Set(rows.flatMap(r => [r.assigned_to, r.closed_by, r.verified_by, r.created_by]).filter(Boolean))];
  const [projRes, profRes] = await Promise.all([
    projectIds.length ? supabase.from('projects').select('id, name, project_number').in('id', projectIds) : Promise.resolve({ data: [] as any[] }),
    profileIds.length ? supabase.from('profiles').select('id, full_name').in('id', profileIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const projMap = new Map((projRes.data || []).map((p: any) => [p.id, p]));
  const profMap = new Map((profRes.data || []).map((p: any) => [p.id, p.full_name]));
  return rows.map(r => ({
    ...r,
    project_name: projMap.get(r.project_id)?.name,
    project_number: projMap.get(r.project_id)?.project_number,
    assigned_to_name: r.assigned_to ? profMap.get(r.assigned_to) : undefined,
    closed_by_name: r.closed_by ? profMap.get(r.closed_by) : undefined,
    verified_by_name: r.verified_by ? profMap.get(r.verified_by) : undefined,
    created_by_name: r.created_by ? profMap.get(r.created_by) : undefined,
  })) as Snag[];
}

export const snagService = {
  /**
   * Retrieves all snags for a specific project.
   */
  async getSnagsByProject(projectId: string): Promise<Snag[]> {
    const { data, error } = await supabase
      .from('snags')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return enrichSnags(data || []);
  },

  /**
   * Retrieves a single snag by ID.
   */
  async getSnagById(snagId: string): Promise<Snag> {
    const { data, error } = await supabase
      .from('snags')
      .select('*')
      .eq('id', snagId)
      .single();

    if (error) throw error;

    return (await enrichSnags([data]))[0];
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
      logger.error('Failed to query open snags:', error);
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
