// ============================================================
// JEET ERP — End of Service Benefit (EOSB) React Hook
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { gratuityService } from '@/services/gratuityService';
import { supabase } from '@/lib/supabase';
import type { EosbCalculation } from '@/types/payroll.types';

export function useEOSB() {
  const [liabilityReport, setLiabilityReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchLiabilityReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all ACTIVE employees
      const { data: employees, error: empErr } = await supabase
        .from('employees')
        .select('id, employee_number, full_name_en, join_date, status, designation, department')
        .eq('is_active', true)
        .eq('status', 'ACTIVE');

      if (empErr) throw empErr;

      // Fetch compensations
      const { data: compensations, error: compErr } = await supabase
        .from('employee_compensation')
        .select('*')
        .order('effective_from', { ascending: false });

      if (compErr) throw compErr;

      // Map compensations by employee_id (latest effective first)
      const latestCompMap = new Map<string, any>();
      for (const comp of compensations || []) {
        if (!latestCompMap.has(comp.employee_id)) {
          latestCompMap.set(comp.employee_id, comp);
        }
      }

      const report: any[] = [];
      const today = new Date().toISOString().split('T')[0];

      for (const emp of employees || []) {
        const comp = latestCompMap.get(emp.id);
        if (!comp) continue;

        // Perform mock calculation to get accrued gratuity
        const calc = gratuityService.calculateEOSB({
          joinDate: emp.join_date,
          exitDate: today,
          basicSalary: Number(comp.basic_salary),
          totalSalary: Number(comp.basic_salary) + Number(comp.housing_allowance) + Number(comp.transport_allowance) + Number(comp.other_allowance),
          unpaidLeaveDays: 0, // In real world we can count their historical unpaid leave
          leaveBalanceDays: 0,
          pendingSalaryDays: 0,
          outstandingAdvances: 0
        });

        report.push({
          employee_id: emp.id,
          employee_number: emp.employee_number,
          full_name_en: emp.full_name_en,
          designation: emp.designation,
          department: emp.department,
          join_date: emp.join_date,
          basic_salary: comp.basic_salary,
          effective_service_days: calc.effectiveServiceDays,
          accrued_gratuity: calc.gratuityAmount
        });
      }

      setLiabilityReport(report);
    } catch (err: any) {
      console.error('Failed to compile gratuity liability report:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiabilityReport();
  }, [fetchLiabilityReport]);

  const calculateSettlement = (params: {
    joinDate: string;
    exitDate: string;
    basicSalary: number;
    totalSalary: number;
    unpaidLeaveDays: number;
    leaveBalanceDays: number;
    pendingSalaryDays: number;
    outstandingAdvances: number;
  }): EosbCalculation => {
    return gratuityService.calculateEOSB(params);
  };

  return {
    liabilityReport,
    loading,
    error,
    refetch: fetchLiabilityReport,
    calculateSettlement
  };
}
export default useEOSB;
