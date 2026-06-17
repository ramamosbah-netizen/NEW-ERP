// ============================================================
// Aura ERP — End of Service Benefit (EOSB) React Hook (React Query)
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { gratuityService } from '@/services/gratuityService';
import { supabase } from '@/lib/supabase';
import type { EosbCalculation } from '@/types/payroll.types';

async function buildLiabilityReport(): Promise<any[]> {
  const { data: employees, error: empErr } = await supabase
    .from('employees')
    .select('id, employee_number, full_name_en, join_date, status, designation, department')
    .eq('is_active', true)
    .eq('status', 'ACTIVE');
  if (empErr) throw empErr;

  const { data: compensations, error: compErr } = await supabase
    .from('employee_compensation')
    .select('*')
    .order('effective_from', { ascending: false });
  if (compErr) throw compErr;

  const latestCompMap = new Map<string, any>();
  for (const comp of compensations || []) {
    if (!latestCompMap.has(comp.employee_id)) latestCompMap.set(comp.employee_id, comp);
  }

  const report: any[] = [];
  const today = new Date().toISOString().split('T')[0];

  for (const emp of employees || []) {
    const comp = latestCompMap.get(emp.id);
    if (!comp) continue;
    const calc = gratuityService.calculateEOSB({
      joinDate: emp.join_date,
      exitDate: today,
      basicSalary: Number(comp.basic_salary),
      totalSalary: Number(comp.basic_salary) + Number(comp.housing_allowance) + Number(comp.transport_allowance) + Number(comp.other_allowance),
      unpaidLeaveDays: 0,
      leaveBalanceDays: 0,
      pendingSalaryDays: 0,
      outstandingAdvances: 0,
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
      accrued_gratuity: calc.gratuityAmount,
    });
  }
  return report;
}

export function useEOSB() {
  const q = useQuery({ queryKey: ['eosb', 'liability'], queryFn: buildLiabilityReport });

  const calculateSettlement = (params: {
    joinDate: string; exitDate: string; basicSalary: number; totalSalary: number;
    unpaidLeaveDays: number; leaveBalanceDays: number; pendingSalaryDays: number; outstandingAdvances: number;
  }): EosbCalculation => gratuityService.calculateEOSB(params);

  return {
    liabilityReport: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    calculateSettlement,
  };
}

export default useEOSB;
