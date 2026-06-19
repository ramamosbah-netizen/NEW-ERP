// ============================================================
// JEET ERP — Project Master Module Supabase Service
// Data access, CRUD, state machine enforcement, milestones & contacts
// ============================================================

import { logger } from '@/lib/logger';
import { supabase } from './supabase';
import { generateProjectNumber } from './project-number-service';
import { validateTransition } from './project-status-service';
import { eventService } from '@/services/eventService';
import type { 
  Project, 
  ProjectStatus, 
  ProjectContact, 
  ProjectMilestone, 
  ProjectFilters 
} from '../types/project.types';

// Helper to fetch profile details
async function getProfileById(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}

export const projectService = {
  
  // 1. Fetch all projects matching filters
  async fetchProjects(filters: ProjectFilters): Promise<Project[]> {
    let query = supabase
      .from('projects')
      .select('*');

    // default to active only unless specified
    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    } else {
      query = query.eq('is_active', true);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    } else if (!filters.include_pre_award) {
      query = query.neq('status', 'SUBMITTED').neq('status', 'LOST');
    }
    if (filters.emirate) {
      query = query.eq('emirate', filters.emirate);
    }
    if (filters.project_manager_id) {
      query = query.eq('project_manager_id', filters.project_manager_id);
    }
    if (filters.client_id) {
      query = query.eq('client_id', filters.client_id);
    }
    // Multi-company scope (Phase 0c): show the active company's projects, plus any
    // not-yet-tagged (null) rows so nothing vanishes before backfill is universal.
    if (filters.company_id) {
      query = query.or(`company_id.eq.${filters.company_id},company_id.is.null`);
    }

    if (filters.system) {
      // Postgres array contains check
      query = query.contains('systems', [filters.system]);
    }

    if (filters.year) {
      // Filter by start_date or created_at year
      const startYear = `${filters.year}-01-01`;
      const endYear = `${filters.year}-12-31`;
      query = query.gte('start_date', startYear).lte('start_date', endYear);
    }

    if (filters.search) {
      const s = `%${filters.search}%`;
      query = query.or(`project_number.ilike.${s},name.ilike.${s},client_name.ilike.${s}`);
    }

    // Sort order: active on top, then newest
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    // Optional: resolve profiles for project managers in batch
    return (data || []) as Project[];
  },

  // 2. Fetch single project detail with milestones, contacts, and status history
  async fetchProjectById(id: string): Promise<Project | null> {
    const { data: project, error: projError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (projError) {
      if (projError.code === 'PGRST116') return null; // not found
      throw projError;
    }

    // Fetch milestones
    const { data: milestones, error: milError } = await supabase
      .from('project_milestones')
      .select('*')
      .eq('project_id', id)
      .order('sort_order', { ascending: true });

    if (milError) throw milError;

    // Fetch contacts
    const { data: contacts, error: conError } = await supabase
      .from('project_contacts')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: true });

    if (conError) throw conError;

    // Fetch status history
    const { data: history, error: histError } = await supabase
      .from('project_status_history')
      .select('*')
      .eq('project_id', id)
      .order('changed_at', { ascending: false });

    if (histError) throw histError;

    // Fetch user profiles for PM and site engineer
    let pmProfile = undefined;
    let siteEngProfile = undefined;

    if (project.project_manager_id) {
      pmProfile = await getProfileById(project.project_manager_id) || undefined;
    }
    if (project.site_engineer_id) {
      siteEngProfile = await getProfileById(project.site_engineer_id) || undefined;
    }

    // Resolve user names in history
    const historyWithNames = await Promise.all(
      (history || []).map(async (h) => {
        const prof = await getProfileById(h.changed_by);
        return {
          ...h,
          changed_by_name: prof?.full_name || 'System User'
        };
      })
    );

    return {
      ...project,
      milestones: milestones || [],
      contacts: contacts || [],
      status_history: historyWithNames,
      project_manager: pmProfile ? { full_name: pmProfile.full_name, email: pmProfile.email } : undefined,
      site_engineer: siteEngProfile ? { full_name: siteEngProfile.full_name, email: siteEngProfile.email } : undefined
    } as Project;
  },

  // 3. Create project manually
  async createProject(projectData: Partial<Project>): Promise<Project> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required');

    // Generate project number sequence
    const projectNumber = await generateProjectNumber();

    const insertData = {
      ...projectData,
      project_number: projectNumber,
      status: projectData.status || 'MOBILIZATION',
      created_by: user.id,
      is_active: true
    };

    // Remove relations if sent
    delete insertData.milestones;
    delete insertData.contacts;
    delete insertData.status_history;

    const { data: newProject, error } = await supabase
      .from('projects')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    // Insert audit log for project creation
    await supabase.from('project_status_history').insert({
      project_id: newProject.id,
      from_status: 'NONE',
      to_status: newProject.status,
      comment: 'Project created manually',
      changed_by: user.id
    });

    // Emit event on system event bus
    await eventService.emitEvent(
      'project.created',
      'PROJECT',
      newProject.id,
      newProject.id,
      {
        project_number: newProject.project_number,
        name: newProject.name,
        client_name: newProject.client_name,
        contract_value: newProject.contract_value
      },
      user.id
    );

    return newProject as Project;
  },

  // 4. Create project from an accepted quotation
  async createFromQuotation(quotationId: string): Promise<Project> {
    // A. Fetch quotation
    const { data: quote, error: quoteError } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', quotationId)
      .single();

    if (quoteError || !quote) {
      throw new Error(`Quotation not found: ${quoteError?.message || 'Unknown error'}`);
    }

    if (quote.status !== 'ACCEPTED') {
      throw new Error('Project can only be created from an ACCEPTED quotation');
    }

    // B. Check if project already exists for this quotation
    const { data: existingProj } = await supabase
      .from('projects')
      .select('id, project_number')
      .eq('quotation_id', quotationId)
      .single();

    if (existingProj) {
      throw new Error(`Project already exists for this quotation: ${existingProj.project_number}`);
    }

    // C. Fetch quotation lines to extract unique systems
    const { data: lines } = await supabase
      .from('quotation_lines')
      .select('system')
      .eq('quotation_id', quotationId);

    const systemsSet = new Set<string>();
    if (lines) {
      lines.forEach(l => {
        if (l.system) systemsSet.add(l.system);
      });
    }
    const systemsArray = Array.from(systemsSet);

    // D. Fetch Client record to copy TRN and other info if available
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', quote.client_id)
      .single();

    let clientEmirate: any = 'DUBAI';
    if (client?.city) {
      const cityUpper = client.city.toUpperCase().replace(/\s+/g, '_');
      const validEmirates = ['DUBAI', 'ABU_DHABI', 'SHARJAH', 'AJMAN', 'UMM_AL_QUWAIN', 'RAS_AL_KHAIMAH', 'FUJAIRAH'];
      if (validEmirates.includes(cityUpper)) {
        clientEmirate = cityUpper;
      }
    }

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required');

    // D2. Pull the target/budget cost from the linked BOQ (cost before profit
    //     = direct + indirect). This becomes the project's budget_cost so
    //     commitments and margin tracking start from the estimate.
    let budgetCost = 0;
    if (quote.boq_id) {
      const { data: boq } = await supabase
        .from('boqs')
        .select('financials')
        .eq('id', quote.boq_id)
        .maybeSingle();
      const fin = (boq?.financials || {}) as any;
      budgetCost = Number(fin.direct_total || 0) + Number(fin.indirect_total || 0);
      // Fallback: derive from selling price minus profit if direct/indirect absent
      if (budgetCost <= 0 && fin.total_selling_price) {
        budgetCost = Number(fin.total_selling_price || 0) - Number(fin.profit_value || 0);
      }
    }

    // E. Generate project number
    const projectNumber = await generateProjectNumber();

    // F. Create Project Row
    const { data: newProject, error: createError } = await supabase
      .from('projects')
      .insert({
        company_id: quote.company_id || null, // inherit the company from the source quotation
        project_number: projectNumber,
        name: quote.subject || `Project for ${quote.client_name}`,
        client_id: quote.client_id,
        client_name: quote.client_name,
        site_address: quote.client_address_line1 || '',
        emirate: clientEmirate,
        project_type: 'SUPPLY_INSTALL', // Default type
        systems: systemsArray,
        tender_id: quote.project_id, // quotation.project_id references tender
        boq_id: quote.boq_id,
        quotation_id: quotationId,
        contract_value: quote.subtotal_after_discount || 0,
        original_contract_value: quote.subtotal_after_discount || 0,
        budget_cost: Math.round(budgetCost * 100) / 100, // Target cost imported from BOQ
        client_lpo_number: quote.client_po_number || '',
        payment_terms: quote.payment_terms || '',
        retention_pct: 5.00,
        advance_pct: 0,
        dlp_months: 12,
        start_date: new Date().toISOString().split('T')[0],
        status: 'MOBILIZATION',
        sira_applicable: systemsArray.includes('CCTV') || systemsArray.includes('ACCESS_CONTROL'),
        created_by: user.id,
        is_active: true
      })
      .select()
      .single();

    if (createError) throw createError;

    // F2. Link the quotation to this project (a project owns many quotations;
    //     each quotation belongs to one project). Best-effort — column added
    //     by migration 20260613240000.
    await supabase
      .from('quotations')
      .update({ linked_project_id: newProject.id })
      .eq('id', quotationId)
      .then(({ error }) => { if (error) logger.warn('Could not set quotation.linked_project_id:', error.message); });

    // G. Create status history log
    await supabase.from('project_status_history').insert({
      project_id: newProject.id,
      from_status: 'NONE',
      to_status: 'MOBILIZATION',
      comment: `Project auto-created from Quotation ${quote.quotation_number}`,
      changed_by: user.id
    });

    // H. Add default milestones based on contract structure
    // If advance payment is set or default milestones:
    const defaultMilestones = [
      { title: 'Mobilization & Material Submittal', sort_order: 1, payment_linked: false },
      { title: 'First Fix Installation & Conduit Piping', sort_order: 2, payment_linked: true, payment_pct: 30 },
      { title: 'Second Fix Cable Pulling & Device Fitting', sort_order: 3, payment_linked: true, payment_pct: 40 },
      { title: 'Testing, Commissioning & SIRA Inspection', sort_order: 4, payment_linked: true, payment_pct: 20 },
      { title: 'Handover & Training', sort_order: 5, payment_linked: true, payment_pct: 10 }
    ];

    const milestonesToInsert = defaultMilestones.map(m => ({
      project_id: newProject.id,
      title: m.title,
      sort_order: m.sort_order,
      status: 'PENDING',
      payment_linked: m.payment_linked,
      payment_pct: m.payment_pct || null
    }));

    await supabase.from('project_milestones').insert(milestonesToInsert);

    // I. Link primary contact from Client info
    if (quote.client_contact_person) {
      await supabase.from('project_contacts').insert({
        project_id: newProject.id,
        name: quote.client_contact_person,
        role: 'CLIENT_REP',
        email: quote.client_contact_email || '',
        phone: quote.client_contact_phone || '',
        is_primary: true
      });
    }

    // Emit event on system event bus
    await eventService.emitEvent(
      'project.created',
      'PROJECT',
      newProject.id,
      newProject.id,
      {
        project_number: newProject.project_number,
        name: newProject.name,
        client_name: newProject.client_name,
        contract_value: newProject.contract_value
      },
      user.id
    );

    return newProject as Project;
  },

  // 5. Update Project
  async updateProject(id: string, updates: Partial<Project>): Promise<boolean> {
    const cleanUpdates = { ...updates };
    
    // Remove relation arrays
    delete cleanUpdates.milestones;
    delete cleanUpdates.contacts;
    delete cleanUpdates.status_history;
    delete cleanUpdates.project_manager;
    delete cleanUpdates.site_engineer;
    
    cleanUpdates.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('projects')
      .update(cleanUpdates)
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  // 6. Transition Project Status
  async transitionStatus(id: string, toStatus: ProjectStatus, comment?: string): Promise<boolean> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required');

    // A. Fetch current project state
    const project = await this.fetchProjectById(id);
    if (!project) throw new Error('Project not found');

    const fromStatus = project.status;

    // B. Validate transition rules
    const validation = validateTransition(fromStatus, toStatus, {
      ...project,
      // Pass the comment and reasons for validating
      on_hold_reason: comment,
      cancel_reason: comment
    });

    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid transition');
    }

    // C. Perform updates
    const updates: Partial<Project> = {
      status: toStatus,
      updated_at: new Date().toISOString()
    };

    if (toStatus === 'ON_HOLD') {
      updates.previous_status = fromStatus;
      updates.on_hold_reason = comment;
    } else if (toStatus === 'CANCELLED') {
      updates.cancel_reason = comment;
      updates.is_active = false; // soft-delete on cancel
    } else if (toStatus === 'HANDOVER') {
      updates.actual_end_date = new Date().toISOString().split('T')[0];
      // Automatically calculate DLP start/end based on dlp_months
      updates.dlp_start_date = updates.actual_end_date;
      const months = project.dlp_months || 12;
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + months);
      updates.dlp_end_date = endDate.toISOString().split('T')[0];
    } else if (toStatus === 'CLOSED') {
      // CLOSED status gate validation
      // 1. All client invoices must be PAID, CANCELLED, or WRITTEN_OFF
      const { data: clientInvs, error: clientInvsErr } = await supabase
        .from('client_invoices')
        .select('invoice_number, status')
        .eq('project_id', id)
        .eq('is_active', true);
      
      if (clientInvsErr) throw clientInvsErr;
      const openInvs = (clientInvs || []).filter(inv => !['PAID', 'CANCELLED', 'WRITTEN_OFF'].includes(inv.status));
      if (openInvs.length > 0) {
        throw new Error(`Cannot close project: Invoice(s) ${openInvs.map(i => i.invoice_number).join(', ')} are not paid, cancelled, or written-off.`);
      }

      // 2. Retention ledger must be zeroed (sum of direction HELD = direction RELEASED)
      const { data: retentionEntries, error: retErr } = await supabase
        .from('project_retention_ledger')
        .select('direction, amount')
        .eq('project_id', id);

      if (retErr) throw retErr;
      let netRetention = 0;
      for (const entry of retentionEntries || []) {
        if (entry.direction === 'HELD') {
          netRetention += Number(entry.amount);
        } else {
          netRetention -= Number(entry.amount);
        }
      }
      if (Math.abs(netRetention) > 0.01) {
        throw new Error(`Cannot close project: Retention balance of ${netRetention.toFixed(2)} AED remains outstanding (must be 0.00).`);
      }

      // 3. All POs must be CLOSED
      const { data: posList, error: posErr } = await supabase
        .from('purchase_orders')
        .select('po_number, status')
        .eq('project_id', id)
        .eq('is_active', true)
        .eq('is_latest', true);

      if (posErr) throw posErr;
      const openPOs = (posList || []).filter(po => po.status !== 'CLOSED' && po.status !== 'CANCELLED');
      if (openPOs.length > 0) {
        throw new Error(`Cannot close project: Purchase Order(s) ${openPOs.map(p => p.po_number).join(', ')} are not closed.`);
      }

      updates.is_active = false; // Soft-delete or archive on CLOSED
    }

    const { error: updateError } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id);

    if (updateError) throw updateError;

    // D. Log to status history
    const { error: histError } = await supabase
      .from('project_status_history')
      .insert({
        project_id: id,
        from_status: fromStatus,
        to_status: toStatus,
        comment: comment || `Status changed from ${fromStatus} to ${toStatus}`,
        changed_by: user.id
      });

    if (histError) throw histError;

    // E. Emit event on system event bus
    await eventService.emitEvent(
      'project.status_changed',
      'PROJECT',
      id,
      id,
      {
        project_number: project.project_number,
        name: project.name,
        from_status: fromStatus,
        to_status: toStatus,
        comment: comment || ''
      },
      user.id
    );

    return true;
  },

  // ============================================================
  // SUB-CRUD FOR CONTACTS
  // ============================================================
  async addContact(contact: Omit<ProjectContact, 'id' | 'created_at'>): Promise<ProjectContact> {
    const { data, error } = await supabase
      .from('project_contacts')
      .insert(contact)
      .select()
      .single();

    if (error) throw error;
    return data as ProjectContact;
  },

  async updateContact(id: string, updates: Partial<ProjectContact>): Promise<boolean> {
    const { error } = await supabase
      .from('project_contacts')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  async deleteContact(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('project_contacts')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  // ============================================================
  // SUB-CRUD FOR MILESTONES
  // ============================================================
  async addMilestone(milestone: Omit<ProjectMilestone, 'id' | 'created_at'>): Promise<ProjectMilestone> {
    const { data, error } = await supabase
      .from('project_milestones')
      .insert(milestone)
      .select()
      .single();

    if (error) throw error;
    return data as ProjectMilestone;
  },

  async updateMilestone(id: string, updates: Partial<ProjectMilestone>): Promise<boolean> {
    // Fetch current state to see if status changed to DONE
    const { data: current, error: fetchErr } = await supabase
      .from('project_milestones')
      .select('status, payment_linked, payment_pct, title, project_id')
      .eq('id', id)
      .single();

    if (fetchErr) throw fetchErr;

    const { error } = await supabase
      .from('project_milestones')
      .update(updates)
      .eq('id', id);

    if (error) throw error;

    // Check progress invoice suggestion rules
    if (updates.status === 'DONE' && current.status !== 'DONE' && current.payment_linked) {
      // Suggest progress billing invoice via event and task rule
      const { data: project } = await supabase
        .from('projects')
        .select('project_manager_id, created_by, project_number, name')
        .eq('id', current.project_id)
        .single();
      
      if (project) {
        const assigneeId = project.project_manager_id || project.created_by;
        const taskTitle = `Milestone Suggestion: Progress Invoice for ${current.title}`;
        
        // Create suggestion task
        await supabase
          .from('tasks')
          .insert({
            title: taskTitle,
            description: `Milestone '${current.title}' for project ${project.project_number} (${project.name}) was marked DONE. Please create a progress billing invoice for ${current.payment_pct}% of the contract value.`,
            origin: 'AUTO_RULE',
            project_id: current.project_id,
            assignee_id: assigneeId,
            created_by: assigneeId,
            priority: 'HIGH',
            status: 'TODO',
            due_date: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            tags: ['BILLING_SUGGESTION', 'FINANCE']
          });

        // Emit system event
        await supabase
          .from('system_events')
          .insert({
            event_type: 'task.assigned',
            entity_type: 'PROJECT',
            entity_id: current.project_id,
            project_id: current.project_id,
            actor_user_id: assigneeId,
            payload: {
              project_number: project.project_number,
              project_name: project.name,
              milestone_title: current.title,
              payment_pct: current.payment_pct,
              task_title: taskTitle
            }
          });
      }
    }

    return true;
  },

  async deleteMilestone(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('project_milestones')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  async reorderMilestones(milestones: { id: string; sort_order: number }[]): Promise<boolean> {
    // Perform updates sequentially or in batch
    for (const m of milestones) {
      const { error } = await supabase
        .from('project_milestones')
        .update({ sort_order: m.sort_order })
        .eq('id', m.id);
      if (error) throw error;
    }
    return true;
  }
};
