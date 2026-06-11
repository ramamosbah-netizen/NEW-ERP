// ============================================================
// JEET ERP — Leave & Attendance Management Service
// ============================================================

import { supabase } from '@/lib/supabase';
import type { LeaveRequest, LeaveBalance, LeaveType } from '@/types/hr.types';
import { eventService } from './eventService';

export const leaveService = {
  /**
   * Retrieves leave requests for an employee.
   */
  async getLeaveRequests(employeeId: string): Promise<LeaveRequest[]> {
    const { data, error } = await supabase
      .from('leave_requests')
      .select(`
        *,
        employee:employees(full_name_en, employee_number)
      `)
      .eq('employee_id', employeeId)
      .order('from_date', { ascending: false });

    if (error) throw error;
    return data as any[];
  },

  /**
   * Retrieves all leave requests in the manager approval queue.
   */
  async getApprovalsQueue(): Promise<LeaveRequest[]> {
    const { data, error } = await supabase
      .from('leave_requests')
      .select(`
        *,
        employee:employees(full_name_en, employee_number, department)
      `)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data as any[];
  },

  /**
   * Calculates working days between two dates, excluding weekends (Fri/Sat) and company holidays.
   */
  async calculateWorkingDays(fromDate: string, toDate: string): Promise<number> {
    const start = new Date(fromDate);
    const end = new Date(toDate);
    
    if (end < start) return 0;
    
    // Fetch company holidays in this range
    const { data: holidays } = await supabase
      .from('company_holidays')
      .select('holiday_date')
      .eq('is_active', true)
      .gte('holiday_date', fromDate)
      .lte('holiday_date', toDate);

    const holidaySet = new Set((holidays || []).map(h => h.holiday_date));
    
    let workingDays = 0;
    const current = new Date(start);
    
    while (current <= end) {
      const dayOfWeek = current.getDay(); // Sunday is 0, Friday is 5, Saturday is 6
      const dateStr = current.toISOString().split('T')[0];
      
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
      const isHoliday = holidaySet.has(dateStr);
      
      if (!isWeekend && !isHoliday) {
        workingDays++;
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    return workingDays;
  },

  /**
   * Creates a new leave request. Validates overlaps and leave balance.
   */
  async createLeaveRequest(params: Omit<LeaveRequest, 'id' | 'status' | 'approver_id' | 'created_at' | 'updated_at'>): Promise<LeaveRequest> {
    // 1. Check for overlapping requests
    const { data: overlaps, error: overlapErr } = await supabase
      .from('leave_requests')
      .select('id')
      .eq('employee_id', params.employee_id)
      .in('status', ['PENDING', 'APPROVED'])
      .or(`from_date.range.(${params.from_date},${params.to_date}),to_date.range.(${params.from_date},${params.to_date})`);
      
    if (overlapErr) throw overlapErr;
    if (overlaps && overlaps.length > 0) {
      throw new Error('Overlap Error: You already have a pending or approved leave request for these dates.');
    }

    // 2. Validate leave balance for Annual Leave
    if (params.leave_type === 'ANNUAL') {
      const year = new Date(params.from_date).getFullYear();
      const { data: balance, error: balErr } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('employee_id', params.employee_id)
        .eq('year', year)
        .eq('leave_type', 'ANNUAL')
        .maybeSingle();

      if (balErr) throw balErr;
      if (balance) {
        const available = balance.entitled_days - balance.taken_days;
        if (params.days > available) {
          throw new Error(`Insufficient Balance: You are requesting ${params.days} days, but only have ${available} days available.`);
        }
      }
    }

    // 3. Insert leave request
    const { data, error } = await supabase
      .from('leave_requests')
      .insert({
        ...params,
        status: 'PENDING'
      })
      .select()
      .single();

    if (error) throw error;

    // Emit event: leave.submitted
    const { data: emp } = await supabase
      .from('employees')
      .select('full_name_en')
      .eq('id', params.employee_id)
      .single();

    await eventService.emitEvent(
      'leave.submitted',
      'LEAVE',
      data.id,
      undefined,
      {
        employee_name: emp?.full_name_en || 'Employee',
        days: params.days,
        leave_type: params.leave_type,
        from_date: params.from_date,
        to_date: params.to_date
      }
    );

    return data as LeaveRequest;
  },

  /**
   * Approves a leave request, updating leave balances where applicable.
   */
  async approveLeaveRequest(requestId: string): Promise<LeaveRequest> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required.');

    const { data: request, error: reqErr } = await supabase
      .from('leave_requests')
      .select('*, employee:employees(*)')
      .eq('id', requestId)
      .single();

    if (reqErr) throw reqErr;
    if (request.status !== 'PENDING') throw new Error('Leave request is already processed.');

    // Start database updates
    const { data, error } = await supabase
      .from('leave_requests')
      .update({
        status: 'APPROVED',
        approver_id: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw error;

    // Update leave balance if this is a tracked type (ANNUAL, SICK, MATERNITY, PARENTAL)
    const trackedTypes = ['ANNUAL', 'SICK', 'MATERNITY', 'PARENTAL'];
    if (trackedTypes.includes(request.leave_type)) {
      const year = new Date(request.from_date).getFullYear();
      
      // Upsert leave balance to ensure row exists
      const { data: balance } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('employee_id', request.employee_id)
        .eq('year', year)
        .eq('leave_type', request.leave_type)
        .maybeSingle();

      if (balance) {
        await supabase
          .from('leave_balances')
          .update({
            taken_days: Number(balance.taken_days) + Number(request.days)
          })
          .eq('id', balance.id);
      } else {
        // Create new balance record
        await supabase
          .from('leave_balances')
          .insert({
            employee_id: request.employee_id,
            year,
            leave_type: request.leave_type,
            entitled_days: request.leave_type === 'ANNUAL' ? 30.0 : 90.0, // defaults
            taken_days: Number(request.days)
          });
      }
    }

    // Emit event: leave.approved
    if ((request.employee as any)?.user_id) {
      await eventService.emitEvent(
        'leave.approved',
        'LEAVE',
        requestId,
        undefined,
        {
          leave_type: request.leave_type,
          from_date: request.from_date,
          to_date: request.to_date,
          user_id: (request.employee as any).user_id
        }
      );
    }

    return data as LeaveRequest;
  },

  /**
   * Rejects a leave request.
   */
  async rejectLeaveRequest(requestId: string): Promise<LeaveRequest> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required.');

    const { data: request, error: reqErr } = await supabase
      .from('leave_requests')
      .select('*, employee:employees(*)')
      .eq('id', requestId)
      .single();

    if (reqErr) throw reqErr;

    const { data, error } = await supabase
      .from('leave_requests')
      .update({
        status: 'REJECTED',
        approver_id: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw error;

    // Emit event: leave.rejected
    if ((request.employee as any)?.user_id) {
      await eventService.emitEvent(
        'leave.rejected',
        'LEAVE',
        requestId,
        undefined,
        {
          leave_type: request.leave_type,
          from_date: request.from_date,
          user_id: (request.employee as any).user_id
        }
      );
    }

    return data as LeaveRequest;
  },

  /**
   * Gets leave requests within a range for swimlane calendar mapping.
   */
  async getLeaveCalendar(startDate: string, endDate: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('leave_requests')
      .select(`
        id,
        leave_type,
        from_date,
        to_date,
        days,
        status,
        employee:employees(id, full_name_en, employee_number, department)
      `)
      .eq('status', 'APPROVED')
      .gte('to_date', startDate)
      .lte('from_date', endDate);

    if (error) throw error;
    return data || [];
  }
};

export default leaveService;
