// ============================================================
// JEET ERP — PPM Visit Execution Service
// Handles visit scheduling, starts, checklist logging,
// completion, and defect auto-ticket generation.
// ============================================================

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { eventService } from './eventService';
import { calculateSLADeadlines } from './slaService';
import { fetchCompanyHolidays } from './businessTime';
import type { PPMVisit, PPMVisitChecklistResult, ChecklistTemplate } from '@/types/ppm.types';

export const visitService = {
  /**
   * Fetches scheduled and unscheduled PPM visits.
   */
  async fetchPPMVisits(filters: {
    status?: string;
    technicianId?: string;
    date?: string;
  } = {}): Promise<PPMVisit[]> {
    let query = supabase
      .from('ppm_visits')
      .select('*, amc_contracts(contract_number, client_name, site_name, site_address, emirate), profiles!ppm_visits_technician_id_fkey(full_name)')
      .order('target_month', { ascending: true });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.technicianId) {
      query = query.or(`technician_id.eq.${filters.technicianId},second_technician_id.eq.${filters.technicianId}`);
    }
    if (filters.date) {
      query = query.eq('scheduled_date', filters.date);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Map joined fields into flat object structure matching PPMVisit type
    return (data || []).map((v: any) => {
      const contract = v.amc_contracts;
      return {
        ...v,
        contract_number: contract?.contract_number,
        client_name: contract?.client_name,
        site_name: contract?.site_name,
        site_address: contract?.site_address,
        emirate: contract?.emirate,
        technician_name: v.profiles?.full_name
      };
    }) as PPMVisit[];
  },

  /**
   * Fetches a single PPM visit with full details.
   */
  async fetchPPMVisitById(id: string): Promise<PPMVisit | null> {
    const { data, error } = await supabase
      .from('ppm_visits')
      .select('*, amc_contracts(*), profiles!ppm_visits_technician_id_fkey(full_name)')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    const contract = data.amc_contracts;
    return {
      ...data,
      contract_number: contract?.contract_number,
      client_name: contract?.client_name,
      site_name: contract?.site_name,
      site_address: contract?.site_address,
      emirate: contract?.emirate,
      technician_name: data.profiles?.full_name
    } as PPMVisit;
  },

  /**
   * Schedules an unscheduled visit with date, slot, and technician assignment.
   */
  async schedulePPMVisit(
    visitId: string,
    scheduledDate: string,
    scheduledSlot: 'AM' | 'PM',
    technicianId: string,
    secondTechnicianId?: string
  ): Promise<PPMVisit> {
    const { data: updated, error } = await supabase
      .from('ppm_visits')
      .update({
        scheduled_date: scheduledDate,
        scheduled_slot: scheduledSlot,
        technician_id: technicianId,
        second_technician_id: secondTechnicianId || null,
        status: 'SCHEDULED'
      })
      .eq('id', visitId)
      .select('*, amc_contracts(contract_number, client_name, site_name)')
      .single();

    if (error) throw error;

    const { data: techProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', technicianId)
      .single();

    // Emit event
    const contract = updated.amc_contracts as any;
    await eventService.emitEvent(
      'ppm.visit_scheduled',
      'PPM_VISIT',
      visitId,
      undefined,
      {
        visit_number: updated.visit_number,
        scheduled_date: scheduledDate,
        tech_name: techProfile?.full_name || 'Technician',
        site_name: contract?.site_name
      }
    );

    return updated as PPMVisit;
  },

  /**
   * Starts a scheduled visit (e.g. technician clicks "Start Visit" on-site).
   */
  async startPPMVisit(visitId: string): Promise<PPMVisit> {
    const { data, error } = await supabase
      .from('ppm_visits')
      .update({
        status: 'IN_PROGRESS',
        started_at: new Date().toISOString()
      })
      .eq('id', visitId)
      .select()
      .single();

    if (error) throw error;
    return data as PPMVisit;
  },

  /**
   * Fetches checklist templates and seeds defaults (CCTV, ACS, Gate) if empty.
   */
  async fetchChecklistTemplates(): Promise<ChecklistTemplate[]> {
    const { data: templates, error: tempErr } = await supabase
      .from('checklist_templates')
      .select('*, checklist_template_items(*)');

    if (tempErr) throw tempErr;

    if (templates && templates.length > 0) {
      return templates as ChecklistTemplate[];
    }

    // Default Seed templates
    logger.debug('Seeding default checklist templates...');
    const defaultTemplates = [
      { name: 'Standard CCTV Maintenance', system: 'CCTV', description: 'CCTV & IP Surveillance check list' },
      { name: 'Standard Access Control Maintenance', system: 'ACCESS_CONTROL', description: 'Access control and biometric checklist' },
      { name: 'Standard Gate Barrier Maintenance', system: 'GATE_BARRIER', description: 'Automated barrier and loops checklist' }
    ];

    const seededTemplates: ChecklistTemplate[] = [];

    for (const t of defaultTemplates) {
      const { data: template, error } = await supabase
        .from('checklist_templates')
        .insert(t)
        .select()
        .single();
      if (error) continue;

      let items: any[] = [];
      if (t.system === 'CCTV') {
        items = [
          { item_text: 'Inspect camera lenses for dust, grease, and focus', item_type: 'PASS_FAIL', sort_order: 1 },
          { item_text: 'Verify NVR/DVR recording status and storage capacity', item_type: 'PASS_FAIL', sort_order: 2 },
          { item_text: 'Check backup power/UPS status and voltage level', item_type: 'VALUE', sort_order: 3 },
          { item_text: 'Take photo of main rack setup', item_type: 'PHOTO_REQUIRED', sort_order: 4 }
        ];
      } else if (t.system === 'ACCESS_CONTROL') {
        items = [
          { item_text: 'Verify electromagnetic locks release on fire alarm signal', item_type: 'PASS_FAIL', sort_order: 1 },
          { item_text: 'Inspect card readers and keypads for physical wear', item_type: 'PASS_FAIL', sort_order: 2 },
          { item_text: 'Test backup battery charger voltage', item_type: 'VALUE', sort_order: 3 }
        ];
      } else {
        items = [
          { item_text: 'Check barrier arm alignment and safety loop sensor', item_type: 'PASS_FAIL', sort_order: 1 },
          { item_text: 'Inspect mechanical gearbox oil level and lubrication', item_type: 'PASS_FAIL', sort_order: 2 }
        ];
      }

      const itemsToInsert = items.map((it) => ({
        ...it,
        template_id: template.id
      }));

      const { data: insertedItems } = await supabase
        .from('checklist_template_items')
        .insert(itemsToInsert)
        .select();

      seededTemplates.push({
        ...template,
        items: insertedItems || []
      });
    }

    return seededTemplates;
  },

  /**
   * Fetches template details including checklist items.
   */
  async fetchChecklistTemplateBySystem(system: string): Promise<ChecklistTemplate | null> {
    const templates = await this.fetchChecklistTemplates();
    const match = templates.find((t) => t.system.toUpperCase() === system.toUpperCase());
    return match || templates[0] || null; // fallback to first template
  },

  /**
   * Logs a checklist item result. Supports batch/individual saves.
   */
  async saveChecklistResult(
    resultData: Omit<PPMVisitChecklistResult, 'id' | 'created_at'>
  ): Promise<PPMVisitChecklistResult> {
    const { data, error } = await supabase
      .from('ppm_visit_checklist_results')
      .insert(resultData)
      .select()
      .single();

    if (error) throw error;
    return data as PPMVisitChecklistResult;
  },

  /**
   * Completes a PPM visit execution.
   * Compiles signature sign-offs, checks for checklist failures, and
   * creates an automatic defect service ticket if failures are found.
   */
  async completePPMVisit(
    visitId: string,
    completeData: {
      signaturePath: string;
      clientSignName: string;
      clientSignDesignation: string;
      summary: string;
      recommendations: string;
    }
  ): Promise<PPMVisit> {
    const visit = await this.fetchPPMVisitById(visitId);
    if (!visit) throw new Error('Visit not found');

    const { data: updated, error } = await supabase
      .from('ppm_visits')
      .update({
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        client_signature_storage_path: completeData.signaturePath,
        client_sign_name: completeData.clientSignName,
        client_sign_designation: completeData.clientSignDesignation,
        summary: completeData.summary,
        recommendations: completeData.recommendations
      })
      .eq('id', visitId)
      .select('*, amc_contracts(*)')
      .single();

    if (error) throw error;

    const contract = updated.amc_contracts as any;

    // Check for checklist failures
    const { data: checklistResults, error: checkErr } = await supabase
      .from('ppm_visit_checklist_results')
      .select('*, checklist_template_items(item_text)')
      .eq('visit_id', visitId);

    if (checkErr) throw checkErr;

    const failedItems = (checklistResults || []).filter((r) => r.result === 'FAIL');

    if (failedItems.length > 0) {
      // 1. Generate auto-defect Service Ticket
      const failedListText = failedItems
        .map((fi, idx) => `${idx + 1}. ${fi.checklist_template_items?.item_text || 'Item'} - Note: ${fi.notes || 'None'}`)
        .join('\n');

      const { data: { user } } = await supabase.auth.getUser();
      const creatorId = user?.id || contract.created_by;

      const holidays = await fetchCompanyHolidays();
      const { responseDue, resolutionDue } = calculateSLADeadlines(
        {
          priority: 'MEDIUM',
          sla_tier: contract.sla_tier
        },
        new Date(),
        holidays
      );

      const ticketPayload = {
        intake_channel: 'MANUAL' as const,
        client_id: contract.client_id,
        contract_id: contract.id,
        site_address: contract.site_address,
        system: contract.systems?.[0] || 'CCTV',
        title: `PPM Defect Callout: ${updated.visit_number}`,
        description: `Auto-generated from PPM Visit ${updated.visit_number} on contract ${contract.contract_number}.\n\nFailed Checklist Items:\n${failedListText}\n\nSummary of visit: ${completeData.summary}`,
        reported_by_name: completeData.clientSignName || 'Site Contact',
        reported_by_phone: '+971500000000',
        priority: 'MEDIUM' as const,
        coverage: 'COVERED' as const,
        sla_response_due: responseDue.toISOString(),
        sla_resolution_due: resolutionDue.toISOString(),
        status: 'NEW' as const,
        created_by: creatorId
      };

      const { data: ticket, error: ticketErr } = await supabase
        .from('service_tickets')
        .insert(ticketPayload)
        .select()
        .single();

      if (ticketErr) {
        logger.error('Failed to auto-create service ticket from PPM defect:', ticketErr);
      } else {
        logger.debug(`Auto-created service ticket ${ticket.ticket_number} for PPM defects.`);
        
        // Log ticket event
        await supabase.from('ticket_events').insert({
          ticket_id: ticket.id,
          type: 'STATUS_CHANGE',
          body: `Ticket auto-created from PPM Visit ${updated.visit_number} checklist failure.`,
          user_id: creatorId
        });
      }

      // 2. Emit ppm.defects_found event
      await eventService.emitEvent(
        'ppm.defects_found',
        'PPM_VISIT',
        visitId,
        contract.origin_project_id || undefined,
        {
          visit_number: updated.visit_number,
          site_name: contract.site_name,
          failed_count: failedItems.length
        }
      );
    } else {
      // Emit standard ppm.completed event
      await eventService.emitEvent(
        'ppm.completed',
        'PPM_VISIT',
        visitId,
        contract.origin_project_id || undefined,
        {
          visit_number: updated.visit_number,
          site_name: contract.site_name,
          contract_id: contract.id
        }
      );
    }

    // Try executing report PDF compiling & DMS filing service (which we will define next)
    try {
      // Dynamic import to avoid circular dependency if any
      const { visitReportPDFService } = await import('./visitReportPDFService');
      await visitReportPDFService.generateAndFileVisitReport(visitId);
    } catch (pdfErr) {
      logger.error('Failed to generate and file visit report PDF:', pdfErr);
    }

    return updated as PPMVisit;
  }
};
export default visitService;
