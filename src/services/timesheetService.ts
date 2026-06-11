// ============================================================
// JEET ERP — Timesheet and Labour Allocations Service
// ============================================================

import { supabase } from '@/lib/supabase';
import type { Timesheet, TimesheetEntry, TimesheetStatus } from '@/types/timesheet.types';
import { eventService } from './eventService';

export const timesheetService = {
  /**
   * Retrieves a timesheet for a specific employee and week.
   */
  async getTimesheet(employeeId: string, weekStart: string): Promise<{ timesheet: Timesheet | null; entries: TimesheetEntry[] }> {
    const { data: ts, error: tsErr } = await supabase
      .from('timesheets')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('week_start', weekStart)
      .maybeSingle();

    if (tsErr) throw tsErr;
    if (!ts) return { timesheet: null, entries: [] };

    const { data: entries, error: entErr } = await supabase
      .from('timesheet_entries')
      .select(`
        *,
        project:projects(name, project_number),
        ticket:service_tickets(ticket_number, title),
        visit:ppm_visits(visit_number, summary)
      `)
      .eq('timesheet_id', ts.id)
      .order('work_date', { ascending: true });

    if (entErr) throw entErr;

    const formattedEntries = (entries || []).map(entry => ({
      ...entry,
      project_name: entry.project?.name,
      project_number: entry.project?.project_number,
      ticket_number: entry.ticket?.ticket_number,
      visit_number: entry.visit?.visit_number
    }));

    return { timesheet: ts as Timesheet, entries: formattedEntries as TimesheetEntry[] };
  },

  /**
   * Initializes or gets a timesheet for a week.
   */
  async getOrCreateTimesheet(employeeId: string, weekStart: string): Promise<Timesheet> {
    const { data: existing, error } = await supabase
      .from('timesheets')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('week_start', weekStart)
      .maybeSingle();

    if (error) throw error;
    if (existing) return existing as Timesheet;

    // Create a new timesheet
    const { data: created, error: createErr } = await supabase
      .from('timesheets')
      .insert({
        employee_id: employeeId,
        week_start: weekStart,
        status: 'DRAFT',
        total_regular_hours: 0.0,
        total_ot_hours: 0.0
      })
      .select()
      .single();

    if (createErr) throw createErr;
    return created as Timesheet;
  },

  /**
   * Bulk saves timesheet entries and updates the header totals.
   */
  async saveEntries(timesheetId: string, entries: Omit<TimesheetEntry, 'id' | 'timesheet_id' | 'created_at'>[]): Promise<TimesheetEntry[]> {
    // 1. Validate hours per day <= 24
    const dailyHoursMap: Record<string, number> = {};
    for (const entry of entries) {
      dailyHoursMap[entry.work_date] = (dailyHoursMap[entry.work_date] || 0) + Number(entry.hours);
      if (dailyHoursMap[entry.work_date] > 24) {
        throw new Error(`Validation Error: Total hours logged on ${entry.work_date} exceeds 24 hours.`);
      }
    }

    // 2. Delete existing entries first (clean replacement for week)
    const { error: deleteErr } = await supabase
      .from('timesheet_entries')
      .delete()
      .eq('timesheet_id', timesheetId);

    if (deleteErr) throw deleteErr;

    // 3. Insert new entries
    if (entries.length === 0) {
      await this.updateTimesheetTotals(timesheetId);
      return [];
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('timesheet_entries')
      .insert(
        entries.map(e => ({
          ...e,
          timesheet_id: timesheetId
        }))
      )
      .select();

    if (insertErr) throw insertErr;

    // 4. Update totals on header
    await this.updateTimesheetTotals(timesheetId);

    return inserted as TimesheetEntry[];
  },

  /**
   * Helper to recalculate total regular and overtime hours on the timesheet header.
   */
  async updateTimesheetTotals(timesheetId: string): Promise<void> {
    const { data: entries, error } = await supabase
      .from('timesheet_entries')
      .select('hours, is_overtime')
      .eq('timesheet_id', timesheetId);

    if (error) throw error;

    let regular = 0;
    let ot = 0;

    for (const entry of entries || []) {
      if (entry.is_overtime) {
        ot += Number(entry.hours);
      } else {
        regular += Number(entry.hours);
      }
    }

    const { error: updateErr } = await supabase
      .from('timesheets')
      .update({
        total_regular_hours: regular,
        total_ot_hours: ot,
        updated_at: new Date().toISOString()
      })
      .eq('id', timesheetId);

    if (updateErr) throw updateErr;
  },

  /**
   * Submits a timesheet for approval.
   */
  async submitTimesheet(timesheetId: string): Promise<Timesheet> {
    const { data: ts, error: getErr } = await supabase
      .from('timesheets')
      .select('*, employee:employees(*)')
      .eq('id', timesheetId)
      .single();

    if (getErr) throw getErr;
    if (ts.status === 'LOCKED') throw new Error('Cannot submit a locked timesheet.');

    const { data, error } = await supabase
      .from('timesheets')
      .update({
        status: 'SUBMITTED',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', timesheetId)
      .select()
      .single();

    if (error) throw error;

    // Emit event: timesheet.submitted
    await eventService.emitEvent(
      'timesheet.submitted',
      'TIMESHEET',
      timesheetId,
      undefined,
      {
        employee_name: (ts.employee as any)?.full_name_en,
        week_start: ts.week_start
      }
    );

    return data as Timesheet;
  },

  /**
   * Approves a timesheet.
   */
  async approveTimesheet(timesheetId: string): Promise<Timesheet> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required to approve a timesheet.');

    const { data: ts, error: getErr } = await supabase
      .from('timesheets')
      .select('*, employee:employees(*)')
      .eq('id', timesheetId)
      .single();

    if (getErr) throw getErr;

    const { data, error } = await supabase
      .from('timesheets')
      .update({
        status: 'APPROVED',
        approved_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', timesheetId)
      .select()
      .single();

    if (error) throw error;

    // Emit event: timesheet.approved
    if ((ts.employee as any)?.user_id) {
      await eventService.emitEvent(
        'timesheet.approved',
        'TIMESHEET',
        timesheetId,
        undefined,
        {
          week_start: ts.week_start,
          user_id: (ts.employee as any).user_id
        }
      );
    }

    return data as Timesheet;
  },

  /**
   * Rejects a timesheet.
   */
  async rejectTimesheet(timesheetId: string, reason: string): Promise<Timesheet> {
    if (!reason) throw new Error('Rejection reason is mandatory.');

    const { data: ts, error: getErr } = await supabase
      .from('timesheets')
      .select('*, employee:employees(*)')
      .eq('id', timesheetId)
      .single();

    if (getErr) throw getErr;

    const { data, error } = await supabase
      .from('timesheets')
      .update({
        status: 'REJECTED',
        rejection_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', timesheetId)
      .select()
      .single();

    if (error) throw error;

    // Emit event: timesheet.rejected
    if ((ts.employee as any)?.user_id) {
      await eventService.emitEvent(
        'timesheet.rejected',
        'TIMESHEET',
        timesheetId,
        undefined,
        {
          week_start: ts.week_start,
          rejection_reason: reason,
          user_id: (ts.employee as any).user_id
        }
      );
    }

    return data as Timesheet;
  },

  /**
   * Retrieves all timesheets in the approval queue.
   */
  async getApprovalsQueue(): Promise<Timesheet[]> {
    const { data, error } = await supabase
      .from('timesheets')
      .select(`
        *,
        employee:employees(full_name_en, employee_number, department)
      `)
      .eq('status', 'SUBMITTED')
      .order('submitted_at', { ascending: true });

    if (error) throw error;
    return data as any[];
  },

  /**
   * Generates timesheet auto-suggestions from technician visit and ticket logs.
   */
  async getPrefillSuggestions(employeeId: string, weekStart: string): Promise<any[]> {
    const { data: employee } = await supabase
      .from('employees')
      .select('user_id')
      .eq('id', employeeId)
      .single();

    if (!employee || !employee.user_id) return [];

    const userId = employee.user_id;
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6); // 7 days (Sunday to Saturday)

    const startDateStr = weekStart;
    const endDateStr = end.toISOString().split('T')[0];

    // 1. Fetch completed PPM visits scheduled in this week
    const { data: visits } = await supabase
      .from('ppm_visits')
      .select(`
        id,
        visit_number,
        scheduled_date,
        contract:amc_contracts(id, project_id, system)
      `)
      .or(`technician_id.eq.${userId},second_technician_id.eq.${userId}`)
      .gte('scheduled_date', startDateStr)
      .lte('scheduled_date', endDateStr)
      .in('status', ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED']);

    // 2. Fetch service tickets assigned/resolved in this week
    const { data: tickets } = await supabase
      .from('service_tickets')
      .select(`
        id,
        ticket_number,
        title,
        created_at,
        project_id,
        system
      `)
      .eq('technician_id', userId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    const suggestions: any[] = [];

    if (visits) {
      for (const v of visits) {
        suggestions.push({
          work_date: v.scheduled_date,
          allocation_type: 'PPM_VISIT',
          visit_id: v.id,
          project_id: (v.contract as any)?.project_id || null,
          description: `PPM Visit ${v.visit_number}`,
          system: (v.contract as any)?.system || null,
          hours: 8
        });
      }
    }

    if (tickets) {
      for (const t of tickets) {
        const ticketDate = t.created_at.split('T')[0];
        suggestions.push({
          work_date: ticketDate,
          allocation_type: 'SERVICE_TICKET',
          ticket_id: t.id,
          project_id: t.project_id || null,
          description: `Service Ticket ${t.ticket_number}: ${t.title}`,
          system: t.system || null,
          hours: 4
        });
      }
    }

    return suggestions;
  }
};

export default timesheetService;
