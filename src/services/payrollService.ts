import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { UAE_LABOUR_LAW } from '@/constants/uaeLabourLaw.constants';
import { eventService } from './eventService';
import type { Employee, EmployeeCompensation } from '@/types/hr.types';
import type { PayrollRun, PayrollLine, PayrollAdjustment } from '@/types/payroll.types';

export const payrollService = {
  /**
   * Calculates a single employee's payroll line item for a given month.
   */
  calculateEmployeeSalary(params: {
    periodMonth: string; // YYYY-MM-DD
    employee: Employee;
    compensation: EmployeeCompensation; // Latest active compensation
    approvedOtHours: {
      weekday: number;
      restHoliday: number;
    };
    unpaidLeaveDays: number;
    sickHalfPayDays: number;
    sickUnpaidDays: number;
    adjustments: PayrollAdjustment[];
  }) {
    const {
      periodMonth,
      employee,
      compensation,
      approvedOtHours,
      unpaidLeaveDays,
      sickHalfPayDays,
      sickUnpaidDays,
      adjustments
    } = params;

    const [yearStr, monthStr] = periodMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-indexed

    const daysInMonth = new Date(year, month, 0).getDate();
    
    // 1. Calculate Proration ratio (if employee joined or exited mid-month)
    let serviceStartDay = 1;
    let serviceEndDay = daysInMonth;

    const joinDate = new Date(employee.join_date);
    if (joinDate.getFullYear() === year && (joinDate.getMonth() + 1) === month) {
      serviceStartDay = joinDate.getDate();
    }

    if (employee.exit_date) {
      const exitDate = new Date(employee.exit_date);
      if (exitDate.getFullYear() === year && (exitDate.getMonth() + 1) === month) {
        serviceEndDay = exitDate.getDate();
      }
    }

    const calendarDaysInService = Math.max(0, serviceEndDay - serviceStartDay + 1);
    
    // Prorate ratio: standard month has 30 days for billing
    const prorateRatio = calendarDaysInService >= daysInMonth ? 1.0 : calendarDaysInService / 30;

    // Prorated Base Salary components
    const basic = Math.round(compensation.basic_salary * prorateRatio * 100) / 100;
    const housing = Math.round(compensation.housing_allowance * prorateRatio * 100) / 100;
    const transport = Math.round(compensation.transport_allowance * prorateRatio * 100) / 100;
    const other = Math.round(compensation.other_allowance * prorateRatio * 100) / 100;
    
    const monthlyTotalSalary = compensation.basic_salary + compensation.housing_allowance + compensation.transport_allowance + compensation.other_allowance;
    const dailyTotalSalaryRate = monthlyTotalSalary / 30; // standard UAE daily rate
    const dailyBasicSalaryRate = compensation.basic_salary / 30;

    // 2. Overtime Math (Base = BASIC salary only!)
    const hourlyBasicRate = dailyBasicSalaryRate / 8; // standard 8 hour workday
    
    const weekdayOtAmount = approvedOtHours.weekday * hourlyBasicRate * UAE_LABOUR_LAW.OVERTIME.WEEKDAY_MULTIPLIER;
    const restHolidayOtAmount = approvedOtHours.restHoliday * hourlyBasicRate * UAE_LABOUR_LAW.OVERTIME.RESTDAY_HOLIDAY_MULTIPLIER;
    
    const otAmount = Math.round((weekdayOtAmount + restHolidayOtAmount) * 100) / 100;
    const otHours = approvedOtHours.weekday + approvedOtHours.restHoliday;

    // 3. Leave Deductions
    // Unpaid leave = days × total_salary / 30
    const unpaidDeduction = unpaidLeaveDays * dailyTotalSalaryRate;
    
    // Sick half-pay = days × 0.5 × total_salary / 30
    const sickHalfPayDeduction = sickHalfPayDays * 0.5 * dailyTotalSalaryRate;
    
    // Sick unpaid = days × 1.0 × total_salary / 30
    const sickUnpaidDeduction = sickUnpaidDays * dailyTotalSalaryRate;
    
    const leaveDeductions = Math.round((unpaidDeduction + sickHalfPayDeduction + sickUnpaidDeduction) * 100) / 100;

    // 4. Adjustments (Approved only)
    const adjs = adjustments
      .filter(a => a.status === 'APPROVED')
      .map(a => ({
        id: a.id,
        adjustment_type: a.adjustment_type,
        amount: Number(a.amount),
        reason: a.reason
      }));
      
    const adjustmentTotal = adjs.reduce((sum, a) => sum + a.amount, 0);

    // 5. Final Totals
    const grossPay = Math.round((basic + housing + transport + other + otAmount) * 100) / 100;
    const netPay = Math.round((grossPay - leaveDeductions + adjustmentTotal) * 100) / 100;

    // Days worked for WPS: normally 30, prorated for join/exit, minus unpaid days
    const daysWorked = Math.max(0, Math.min(30, Math.round(calendarDaysInService - unpaidLeaveDays)));

    return {
      basic_salary: basic,
      housing_allowance: housing,
      transport_allowance: transport,
      other_allowance: other,
      ot_hours: Math.round(otHours * 100) / 100,
      ot_amount: otAmount,
      leave_deductions: leaveDeductions,
      adjustments: adjs,
      gross_pay: Math.max(0, grossPay),
      net_pay: Math.max(0, netPay),
      days_worked: daysWorked
    };
  },

  /**
   * Fetches overtime hours from approved timesheets for a given month.
   */
  async fetchMonthlyOtHours(employeeId: string, startDateStr: string, endDateStr: string) {
    const { data: timesheets } = await supabase
      .from('timesheets')
      .select('id')
      .eq('employee_id', employeeId)
      .eq('status', 'APPROVED');

    const tsIds = (timesheets || []).map(ts => ts.id);
    if (tsIds.length === 0) return { weekday: 0, restHoliday: 0 };

    const { data: entries, error } = await supabase
      .from('timesheet_entries')
      .select('hours, ot_type')
      .eq('is_overtime', true)
      .gte('work_date', startDateStr)
      .lte('work_date', endDateStr)
      .in('timesheet_id', tsIds);

    if (error) {
      logger.error('Failed to query OT entries:', error);
      return { weekday: 0, restHoliday: 0 };
    }

    let weekday = 0;
    let restHoliday = 0;

    for (const entry of entries || []) {
      if (entry.ot_type === 'WEEKDAY_OT') {
        weekday += Number(entry.hours);
      } else {
        restHoliday += Number(entry.hours);
      }
    }

    return { weekday, restHoliday };
  },

  /**
   * Fetches leave details and processes sick leave tiers.
   */
  async fetchMonthlyLeaveDays(employeeId: string, startDateStr: string, endDateStr: string) {
    const year = new Date(startDateStr).getFullYear();
    const monthStart = new Date(startDateStr);
    const monthEnd = new Date(endDateStr);

    // 1. Fetch all approved leave requests in the current calendar year up to the end of this month
    const { data: requests, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('status', 'APPROVED')
      .gte('to_date', `${year}-01-01`)
      .lte('from_date', endDateStr)
      .order('from_date', { ascending: true });

    if (error) {
      logger.error('Failed to query leave requests:', error);
      return { unpaidLeaveDays: 0, sickHalfPayDays: 0, sickUnpaidDays: 0 };
    }

    let unpaidLeaveDays = 0;
    let totalSickDaysInYear = 0;
    let sickHalfPayDays = 0;
    let sickUnpaidDays = 0;

    for (const req of requests || []) {
      const from = new Date(req.from_date);
      const to = new Date(req.to_date);
      
      // Loop over every day of this request
      const current = new Date(from);
      while (current <= to) {
        const currentStr = current.toISOString().split('T')[0];
        const isCurrentMonth = current >= monthStart && current <= monthEnd;
        
        if (req.leave_type === 'UNPAID') {
          if (isCurrentMonth) {
            unpaidLeaveDays++;
          }
        } else if (req.leave_type === 'SICK') {
          totalSickDaysInYear++;
          
          if (isCurrentMonth) {
            if (totalSickDaysInYear > 15 && totalSickDaysInYear <= 45) {
              sickHalfPayDays++;
            } else if (totalSickDaysInYear > 45) {
              sickUnpaidDays++;
            }
          }
        }
        current.setDate(current.getDate() + 1);
      }
    }

    return { unpaidLeaveDays, sickHalfPayDays, sickUnpaidDays };
  },

  /**
   * Compiles the full payroll run for a month and writes to database.
   */
  async runPayrollForMonth(periodMonth: string): Promise<PayrollRun> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required.');

    // Start Date & End Date of the month
    const [y, m] = periodMonth.split('-');
    const daysInMonth = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
    const startDateStr = `${periodMonth}-01`;
    const endDateStr = `${periodMonth}-${daysInMonth}`;

    // 1. Fetch all ACTIVE employees
    const { data: employees, error: empErr } = await supabase
      .from('employees')
      .select('*')
      .eq('is_active', true)
      .eq('status', 'ACTIVE'); // only process active staff

    if (empErr) throw empErr;

    // 2. Fetch compensations
    const { data: compensations, error: compErr } = await supabase
      .from('employee_compensation')
      .select('*')
      .order('effective_from', { ascending: false });

    if (compErr) throw compErr;

    // Map compensations by employee_id (latest effective first)
    const latestCompMap = new Map<string, EmployeeCompensation>();
    for (const comp of compensations || []) {
      if (!latestCompMap.has(comp.employee_id)) {
        latestCompMap.set(comp.employee_id, comp);
      }
    }

    // 3. Fetch adjustments
    const { data: adjustments, error: adjErr } = await supabase
      .from('payroll_adjustments')
      .select('*')
      .eq('period_month', startDateStr)
      .eq('status', 'APPROVED');

    if (adjErr) throw adjErr;

    // 4. Create Run Header
    const { data: run, error: runErr } = await supabase
      .from('payroll_runs')
      .insert({
        period_month: startDateStr,
        status: 'DRAFT',
        gross_total: 0.00,
        net_total: 0.00,
        created_by: user.id
      })
      .select()
      .single();

    if (runErr) throw runErr;

    const lines: any[] = [];
    let runGrossTotal = 0;
    let runNetTotal = 0;

    // 5. Loop and compute
    for (const emp of employees || []) {
      const comp = latestCompMap.get(emp.id);
      if (!comp) {
        logger.warn(`Skipping payroll calculation for ${emp.full_name_en}: No compensation record found.`);
        continue;
      }

      // Fetch Ot Hours
      const otHours = await this.fetchMonthlyOtHours(emp.id, startDateStr, endDateStr);
      
      // Fetch Leaves
      const leaves = await this.fetchMonthlyLeaveDays(emp.id, startDateStr, endDateStr);
      
      // Filter adjustments
      const empAdjs = (adjustments || []).filter(a => a.employee_id === emp.id);

      const calculated = this.calculateEmployeeSalary({
        periodMonth,
        employee: emp,
        compensation: comp,
        approvedOtHours: otHours,
        unpaidLeaveDays: leaves.unpaidLeaveDays,
        sickHalfPayDays: leaves.sickHalfPayDays,
        sickUnpaidDays: leaves.sickUnpaidDays,
        adjustments: empAdjs
      });

      runGrossTotal += calculated.gross_pay;
      runNetTotal += calculated.net_pay;

      lines.push({
        run_id: run.id,
        employee_id: emp.id,
        basic_salary: calculated.basic_salary,
        housing_allowance: calculated.housing_allowance,
        transport_allowance: calculated.transport_allowance,
        other_allowance: calculated.other_allowance,
        ot_hours: calculated.ot_hours,
        ot_amount: calculated.ot_amount,
        leave_deductions: calculated.leave_deductions,
        adjustments: calculated.adjustments,
        gross_pay: calculated.gross_pay,
        net_pay: calculated.net_pay,
        days_worked: calculated.days_worked,
        bank_name: emp.bank_name,
        iban: emp.iban,
        routing_code: emp.routing_code,
        agent_id: emp.agent_id,
        mohre_person_code: emp.mohre_person_code
      });
    }

    // Write Lines
    if (lines.length > 0) {
      const { error: linesErr } = await supabase
        .from('payroll_lines')
        .insert(lines);
      if (linesErr) throw linesErr;
    }

    // Update Run Header Totals
    const { data: updatedRun, error: updateErr } = await supabase
      .from('payroll_runs')
      .update({
        gross_total: runGrossTotal,
        net_total: runNetTotal,
        updated_at: new Date().toISOString()
      })
      .eq('id', run.id)
      .select()
      .single();

    if (updateErr) throw updateErr;
    return updatedRun as PayrollRun;
  },

  /**
   * Approves a payroll run, locking it and all associated timesheets.
   */
  async approvePayrollRun(runId: string): Promise<PayrollRun> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required.');

    const { data: run, error: getErr } = await supabase
      .from('payroll_runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (getErr) throw getErr;

    // Update Status
    const { data: updated, error } = await supabase
      .from('payroll_runs')
      .update({
        status: 'APPROVED',
        approved_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', runId)
      .select()
      .single();

    if (error) throw error;

    // Lock timesheets for that month period
    const [y, m] = run.period_month.split('-');
    const daysInMonth = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
    const startDateStr = `${y}-${m}-01`;
    const endDateStr = `${y}-${m}-${daysInMonth}`;

    // Update all APPROVED timesheets to LOCKED
    const { error: lockErr } = await supabase
      .from('timesheets')
      .update({ status: 'LOCKED' })
      .gte('week_start', startDateStr)
      .lte('week_start', endDateStr)
      .eq('status', 'APPROVED');

    if (lockErr) {
      logger.error('Failed to lock timesheets during payroll approval:', lockErr.message);
    }

    // Surface this payroll run in AP as DRAFT "workforce" payables (action to
    // spend money). Labour cost is allocated per project from timesheet hours;
    // anything not booked to a project falls to Office overhead. No supplier
    // (staff salaries) so supplier_id is null. Idempotent per period.
    try {
      const { data: existingPay } = await supabase
        .from('supplier_invoices').select('id').like('supplier_invoice_number', `PAY-${y}-${m}%`).limit(1);

      if (!existingPay || existingPay.length === 0) {
        // 1. Hours per (employee, project) from this month's timesheet entries
        const { data: entries } = await supabase
          .from('timesheet_entries').select('timesheet_id, project_id, hours')
          .gte('work_date', startDateStr).lte('work_date', endDateStr);
        const tsIds = Array.from(new Set((entries || []).map((e: any) => e.timesheet_id)));
        const { data: ts } = tsIds.length
          ? await supabase.from('timesheets').select('id, employee_id').in('id', tsIds)
          : { data: [] as any[] };
        const empByTs = new Map((ts || []).map((t: any) => [t.id, t.employee_id]));
        const hoursByEmp = new Map<string, { total: number; byProject: Map<string, number> }>();
        for (const e of entries || []) {
          const emp = empByTs.get((e as any).timesheet_id);
          const pid = (e as any).project_id; const h = Number((e as any).hours) || 0;
          if (!emp || !pid || h <= 0) continue;
          let rec = hoursByEmp.get(emp); if (!rec) { rec = { total: 0, byProject: new Map() }; hoursByEmp.set(emp, rec); }
          rec.total += h; rec.byProject.set(pid, (rec.byProject.get(pid) || 0) + h);
        }

        // 2. Allocate each employee's net pay by their project-hours share
        const { data: lines } = await supabase.from('payroll_lines').select('employee_id, net_pay').eq('run_id', runId);

        // Fallback: employee's assigned/home project when they have no timesheet hours
        const lineEmpIds = Array.from(new Set((lines || []).map((l: any) => l.employee_id)));
        const assignedByEmp = new Map<string, string>();
        if (lineEmpIds.length) {
          try {
            const { data: emps } = await supabase.from('employees').select('id, assigned_project_id').in('id', lineEmpIds);
            for (const e of emps || []) if ((e as any).assigned_project_id) assignedByEmp.set((e as any).id, (e as any).assigned_project_id);
          } catch { /* column may not exist yet — fall through to Office */ }
        }

        const byProject = new Map<string, number>();
        let officeAmount = 0;
        for (const ln of lines || []) {
          const net = Number((ln as any).net_pay) || 0; if (net <= 0) continue;
          const rec = hoursByEmp.get((ln as any).employee_id);
          if (!rec || rec.total <= 0) {
            const assigned = assignedByEmp.get((ln as any).employee_id);
            if (assigned) byProject.set(assigned, (byProject.get(assigned) || 0) + net);
            else officeAmount += net;
            continue;
          }
          const projEntries = [...rec.byProject.entries()];
          let allocated = 0;
          projEntries.forEach(([pid, h], i) => {
            const share = i === projEntries.length - 1
              ? Math.round((net - allocated) * 100) / 100
              : Math.round(net * (h / rec.total) * 100) / 100;
            allocated += share;
            byProject.set(pid, (byProject.get(pid) || 0) + share);
          });
        }

        // 3. One DRAFT payable per project + an Office residual
        const base = {
          supplier_id: null as string | null, invoice_type: 'DIRECT_EXPENSE',
          invoice_date: endDateStr, received_date: endDateStr, due_date: endDateStr,
          vat_amount: 0.00, match_status: 'NA', status: 'DRAFT',
          payee_name: 'Staff Payroll', expense_category: 'WORKFORCE', created_by: user.id,
        };
        const rows: any[] = [];
        for (const [pid, amt] of byProject) {
          if (amt <= 0) continue;
          rows.push({ ...base, supplier_invoice_number: `PAY-${y}-${m}-${pid.slice(0, 8)}`, project_id: pid,
            cost_bucket: 'PROJECT', taxable_amount: amt, total: amt,
            notes: `Workforce payroll ${y}-${m} allocated to project (from timesheets).` });
        }
        if (officeAmount > 0 || rows.length === 0) {
          rows.push({ ...base, supplier_invoice_number: `PAY-${y}-${m}`, project_id: null,
            cost_bucket: 'OFFICE', taxable_amount: officeAmount || run.net_total, total: officeAmount || run.net_total,
            notes: `Workforce payroll ${y}-${m} — office / unallocated labour.` });
        }
        const { error: expErr } = await supabase.from('supplier_invoices').insert(rows);
        if (expErr) logger.error('Failed to log payroll payables:', expErr.message);
      }
    } catch (payErr: any) {
      logger.error('Payroll → AP allocation failed:', payErr?.message || payErr);
    }

    // Emit event: payroll.approved
    await eventService.emitEvent(
      'payroll.approved',
      'PAYROLL',
      runId,
      undefined,
      {
        period_month: run.period_month,
        net_total: run.net_total
      }
    );

    return updated as PayrollRun;
  }
};

export default payrollService;
