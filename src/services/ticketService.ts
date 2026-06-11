// ============================================================
// JEET ERP — Reactive Service Tickets Service
// Handles ticket lifecycle, SLAs, status changes, parts usage,
// and auto-generation of chargeable invoices upon closure.
// ============================================================

import { supabase } from '@/lib/supabase';
import { eventService } from './eventService';
import { calculateSLADeadlines, pauseSLATimer, resumeSLATimer, evaluateSLABreach } from './slaService';
import { fetchCompanyHolidays } from './businessTime';
import { invoiceService } from './invoiceService';
import type { ServiceTicket, TicketPartItem, TicketEvent } from '@/types/ticket.types';

export const ticketService = {
  /**
   * Fetches service tickets based on filters.
   */
  async fetchTickets(filters: {
    status?: string;
    technicianId?: string;
    priority?: string;
    search?: string;
  } = {}): Promise<ServiceTicket[]> {
    let query = supabase
      .from('service_tickets')
      .select('*, clients(name), profiles!service_tickets_technician_id_fkey(full_name)')
      .order('created_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.technicianId) {
      query = query.eq('technician_id', filters.technicianId);
    }
    if (filters.priority) {
      query = query.eq('priority', filters.priority);
    }
    if (filters.search) {
      query = query.or(`ticket_number.ilike.%${filters.search}%,title.ilike.%${filters.search}%,site_address.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((t: any) => ({
      ...t,
      client_name: t.clients?.name,
      technician_name: t.profiles?.full_name
    })) as ServiceTicket[];
  },

  /**
   * Fetches detailed ticket by ID including events thread.
   */
  async fetchTicketById(id: string): Promise<ServiceTicket | null> {
    const { data: ticket, error: ticketErr } = await supabase
      .from('service_tickets')
      .select('*, clients(name), amc_contracts(contract_number, sla_tier), profiles!service_tickets_technician_id_fkey(full_name)')
      .eq('id', id)
      .single();

    if (ticketErr) {
      if (ticketErr.code === 'PGRST116') return null;
      throw ticketErr;
    }

    // Fetch events
    const { data: events, error: evErr } = await supabase
      .from('ticket_events')
      .select('*, profiles(full_name, role)')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true });

    if (evErr) throw evErr;

    const formattedEvents = (events || []).map((ev: any) => ({
      ...ev,
      user_full_name: ev.profiles?.full_name,
      user_role: ev.profiles?.role
    }));

    return {
      ...(ticket as ServiceTicket),
      client_name: ticket.clients?.name,
      contract_number: ticket.amc_contracts?.contract_number,
      technician_name: ticket.profiles?.full_name,
      events: formattedEvents as TicketEvent[]
    };
  },

  /**
   * Logs a new ticket. Calculates SLA due times based on priority and holidays.
   */
  async createTicket(ticketData: Omit<Partial<ServiceTicket>, 'id' | 'ticket_number' | 'created_at'>): Promise<ServiceTicket> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    // 1. Fetch contract SLA tier details if contract is specified
    let slaTier: 'STANDARD' | 'PRIORITY' | 'CRITICAL' = 'STANDARD';
    let contractResponseHours: number | undefined;
    let contractResolutionHours: number | undefined;

    if (ticketData.contract_id) {
      const { data: contract } = await supabase
        .from('amc_contracts')
        .select('sla_tier, response_hours, resolution_hours')
        .eq('id', ticketData.contract_id)
        .single();
      if (contract) {
        slaTier = (contract.sla_tier as any) || 'STANDARD';
        contractResponseHours = contract.response_hours;
        contractResolutionHours = contract.resolution_hours;
      }
    }

    // 2. Fetch holidays to compute SLA deadlines
    const holidays = await fetchCompanyHolidays();
    const { responseDue, resolutionDue } = calculateSLADeadlines(
      {
        priority: ticketData.priority || 'MEDIUM',
        sla_tier: slaTier,
        contract_response_hours: contractResponseHours,
        contract_resolution_hours: contractResolutionHours
      },
      new Date(),
      holidays
    );

    // 3. Save ticket
    const { data: ticket, error } = await supabase
      .from('service_tickets')
      .insert({
        ...ticketData,
        status: 'NEW',
        sla_response_due: responseDue.toISOString(),
        sla_resolution_due: resolutionDue.toISOString(),
        sla_pause_total_minutes: 0,
        created_by: user.id
      })
      .select('*, clients(name)')
      .single();

    if (error) throw error;

    // Log creation event
    await supabase.from('ticket_events').insert({
      ticket_id: ticket.id,
      type: 'STATUS_CHANGE',
      body: `Ticket logged via ${ticket.intake_channel} channel. SLA Response Due: ${responseDue.toLocaleDateString('en-GB')}, Resolution Due: ${resolutionDue.toLocaleDateString('en-GB')}`,
      user_id: user.id
    });

    // Emit event
    await eventService.emitEvent(
      'ticket.created',
      'SERVICE_TICKET',
      ticket.id,
      ticket.project_id || undefined,
      {
        ticket_number: ticket.ticket_number,
        title: ticket.title,
        sla_tier: slaTier,
        client_name: ticket.clients?.name || 'Client'
      }
    );

    return ticket as ServiceTicket;
  },

  /**
   * Assigns a ticket to a technician.
   */
  async assignTicket(ticketId: string, technicianId: string): Promise<ServiceTicket> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const { data: tech } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', technicianId)
      .single();

    const { data: updated, error } = await supabase
      .from('service_tickets')
      .update({
        technician_id: technicianId,
        status: 'ASSIGNED',
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) throw error;

    // Log assignment event
    await supabase.from('ticket_events').insert({
      ticket_id: ticketId,
      type: 'ASSIGNMENT',
      body: `Ticket assigned to technician ${tech?.full_name || 'Technician'}`,
      user_id: user.id
    });

    // Emit event
    await eventService.emitEvent(
      'ticket.assigned',
      'SERVICE_TICKET',
      ticketId,
      updated.project_id || undefined,
      {
        ticket_number: updated.ticket_number,
        tech_name: tech?.full_name || 'Technician'
      },
      technicianId // Target user recipient
    );

    return updated as ServiceTicket;
  },

  /**
   * Dispatches a technician to the site. Marks start of SLA response response_met.
   */
  async dispatchTechnician(ticketId: string): Promise<ServiceTicket> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const ticket = await this.fetchTicketById(ticketId);
    if (!ticket) throw new Error('Ticket not found');

    const now = new Date();
    // Audit SLA Response met
    const responseDue = new Date(ticket.sla_response_due);
    const responseMet = now.getTime() <= responseDue.getTime();

    const { data: updated, error } = await supabase
      .from('service_tickets')
      .update({
        status: 'IN_PROGRESS',
        response_met: ticket.response_met !== undefined ? ticket.response_met : responseMet,
        updated_at: now.toISOString()
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) throw error;

    // Log dispatch event
    await supabase.from('ticket_events').insert({
      ticket_id: ticketId,
      type: 'STATUS_CHANGE',
      body: `Technician dispatched. SLA Response Met: ${responseMet ? 'YES' : 'NO (Breached)'}`,
      user_id: user.id
    });

    // Emit event
    await eventService.emitEvent(
      'ticket.technician_dispatched',
      'SERVICE_TICKET',
      ticketId,
      updated.project_id || undefined,
      {
        ticket_number: updated.ticket_number,
        site_address: updated.site_address
      }
    );

    return updated as ServiceTicket;
  },

  /**
   * Pauses the SLA clock (status: ON_HOLD_PARTS).
   */
  async pauseTicketForParts(ticketId: string, reason: string): Promise<ServiceTicket> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const ticket = await this.fetchTicketById(ticketId);
    if (!ticket) throw new Error('Ticket not found');

    const pauseTime = new Date();
    const pausedFields = pauseSLATimer(ticket, pauseTime);

    const { data: updated, error } = await supabase
      .from('service_tickets')
      .update({
        ...pausedFields,
        updated_at: pauseTime.toISOString()
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) throw error;

    // Log pause event
    await supabase.from('ticket_events').insert({
      ticket_id: ticketId,
      type: 'STATUS_CHANGE',
      body: `SLA timer paused (On Hold). Reason: ${reason}`,
      user_id: user.id
    });

    return updated as ServiceTicket;
  },

  /**
   * Resumes the SLA clock from hold. Extends due dates by elapsed pause duration.
   */
  async resumeTicketFromHold(ticketId: string): Promise<ServiceTicket> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const ticket = await this.fetchTicketById(ticketId);
    if (!ticket) throw new Error('Ticket not found');

    const resumeTime = new Date();
    const { updatedFields, addedMinutes } = resumeSLATimer(ticket, resumeTime);

    const { data: updated, error } = await supabase
      .from('service_tickets')
      .update({
        ...updatedFields,
        status: 'IN_PROGRESS',
        updated_at: resumeTime.toISOString()
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) throw error;

    // Log resume event
    await supabase.from('ticket_events').insert({
      ticket_id: ticketId,
      type: 'STATUS_CHANGE',
      body: `SLA timer resumed. Paused duration: ${addedMinutes} mins added to deadline.`,
      user_id: user.id
    });

    return updated as ServiceTicket;
  },

  /**
   * Resolves the ticket. Audits SLA resolution met.
   */
  async resolveTicket(
    ticketId: string,
    resolutionSummary: string,
    partsUsed: TicketPartItem[],
    clientSignName?: string
  ): Promise<ServiceTicket> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const ticket = await this.fetchTicketById(ticketId);
    if (!ticket) throw new Error('Ticket not found');

    const now = new Date();
    // Audit SLA Resolution met
    const resolutionDue = new Date(ticket.sla_resolution_due);
    const resolutionMet = now.getTime() <= resolutionDue.getTime();

    // If response wasn't set yet (e.g. resolved directly from assigned), set it now
    let responseMetVal = ticket.response_met;
    if (responseMetVal === undefined || responseMetVal === null) {
      const responseDue = new Date(ticket.sla_response_due);
      responseMetVal = now.getTime() <= responseDue.getTime();
    }

    const { data: updated, error } = await supabase
      .from('service_tickets')
      .update({
        status: 'RESOLVED',
        resolution_summary: resolutionSummary,
        parts_used: partsUsed,
        sign_name: clientSignName || null,
        response_met: responseMetVal,
        resolution_met: resolutionMet,
        updated_at: now.toISOString()
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) throw error;

    // Log resolve event
    await supabase.from('ticket_events').insert({
      ticket_id: ticketId,
      type: 'STATUS_CHANGE',
      body: `Ticket resolved. SLA Resolution Met: ${resolutionMet ? 'YES' : 'NO (Breached)'}`,
      user_id: user.id
    });

    // Emit event
    await eventService.emitEvent(
      'ticket.resolved',
      'SERVICE_TICKET',
      ticketId,
      updated.project_id || undefined,
      {
        ticket_number: updated.ticket_number,
        resolution_summary: resolutionSummary
      }
    );

    return updated as ServiceTicket;
  },

  /**
   * Closes the ticket. Generates draft standalone invoices for chargeable tickets.
   */
  async closeTicket(ticketId: string): Promise<ServiceTicket> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const ticket = await this.fetchTicketById(ticketId);
    if (!ticket) throw new Error('Ticket not found');
    if (ticket.status !== 'RESOLVED') throw new Error('Ticket must be resolved before closing');

    const now = new Date().toISOString();
    let invoiceId: string | null = null;
    let invoiceNo: string | null = null;

    // 1. If Chargeable, generate standalone draft invoice
    if (ticket.coverage === 'CHARGEABLE') {
      const todayStr = new Date().toISOString().split('T')[0];

      // Sum up parts cost
      const chargeableItems = (ticket.parts_used || [])
        .filter((part) => part.chargeable)
        .map((part) => ({
          description: `${part.description} (Code: ${part.item_code})`,
          quantity: part.quantity,
          unit: 'Nos',
          unit_price: Number(part.unit_price),
          vat_rate: 5.00
        }));

      // Add a base service fee (250 AED) if parts are empty or as callout fee
      chargeableItems.unshift({
        description: `Chargeable Callout Service Fee - Ticket ${ticket.ticket_number}`,
        quantity: 1,
        unit: 'Nos',
        unit_price: 250.00,
        vat_rate: 5.00
      });

      const invoiceData = {
        client_id: ticket.client_id || undefined,
        client_name: ticket.client_name,
        invoice_type: 'STANDALONE' as const,
        invoice_date: todayStr,
        supply_date: todayStr,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: `Chargeable parts and labour invoice auto-generated from resolved Service Ticket ${ticket.ticket_number}.`
      };

      const createdInvoice = await invoiceService.createInvoiceDraft(invoiceData, chargeableItems);
      invoiceId = createdInvoice.id;
      invoiceNo = createdInvoice.invoice_number;
    }

    // 2. Update status to CLOSED
    const { data: updated, error } = await supabase
      .from('service_tickets')
      .update({
        status: 'CLOSED',
        invoice_id: invoiceId,
        updated_at: now
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) throw error;

    // Log close event
    await supabase.from('ticket_events').insert({
      ticket_id: ticketId,
      type: 'STATUS_CHANGE',
      body: `Ticket officially closed.${invoiceNo ? ` Chargeable invoice generated: ${invoiceNo}` : ''}`,
      user_id: user.id
    });

    // Emit event
    await eventService.emitEvent(
      'ticket.closed',
      'SERVICE_TICKET',
      ticketId,
      updated.project_id || undefined,
      {
        ticket_number: updated.ticket_number,
        invoice_number: invoiceNo
      }
    );

    return updated as ServiceTicket;
  },

  /**
   * Adds an communication comment log to the ticket timeline.
   */
  async addTicketComment(ticketId: string, commentText: string): Promise<TicketEvent> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const { data, error } = await supabase
      .from('ticket_events')
      .insert({
        ticket_id: ticketId,
        type: 'COMMENT',
        body: commentText,
        user_id: user.id
      })
      .select('*, profiles(full_name, role)')
      .single();

    if (error) throw error;

    return {
      ...data,
      user_full_name: data.profiles?.full_name,
      user_role: data.profiles?.role
    } as TicketEvent;
  }
};
export default ticketService;
