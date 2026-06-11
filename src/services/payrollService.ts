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
      console.error('Failed to query OT entries:', error);
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
      console.error('Failed to query leave requests:', error);
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
        console.warn(`Skipping payroll calculation for ${emp.full_name_en}: No compensation record found.`);
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
      console.error('Failed to lock timesheets during payroll approval:', lockErr.message);
    }

    // Create DIRECT_EXPENSE record in supplier_invoices (matching Phase 4 financials)
    // Category: SALARIES_PLACEHOLDER (which maps to payroll total)
    const { error: expErr } = await supabase
      .from('supplier_invoices')
      .insert({
        supplier_id: '88888888-8888-8888-8888-888888888888', // System/Virtual Payroll Supplier ID placeholder
        supplier_invoice_number: `PAY-${y}-${m}`,
        invoice_type: 'DIRECT_EXPENSE',
        invoice_date: endDateStr,
        received_date: endDateStr,
        due_date: endDateStr,
        taxable_amount: run.net_total,
        vat_amount: 0.00,
        total: run.net_total,
        status: 'APPROVED',
        expense_category: 'SALARIES_PLACEHOLDER',
        notes: `Payroll disbursement for month ${y}-${m}`,
        created_by: user.id
      });

    if (expErr) {
      console.error('Failed to log Direct Expense for payroll:', expErr);
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
