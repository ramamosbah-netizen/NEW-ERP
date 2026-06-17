// ============================================================
// Aura ERP — Payroll Runs React Hooks (React Query)
// ============================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { payrollService } from '@/services/payrollService';
import { supabase } from '@/lib/supabase';
import type { PayrollRun } from '@/types/payroll.types';

const prKeys = {
  runs: ['payroll', 'runs'] as const,
  run: (id: string) => ['payroll', 'run', id] as const,
  adjustments: (month: string) => ['payroll', 'adjustments', month] as const,
};

export function usePayrollRun(runId?: string) {
  const qc = useQueryClient();

  const runsQ = useQuery({
    queryKey: prKeys.runs,
    queryFn: async () => {
      const { data, error } = await supabase.from('payroll_runs').select('*').order('period_month', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const detailQ = useQuery({
    queryKey: prKeys.run(runId ?? ''),
    enabled: !!runId,
    queryFn: async () => {
      const [runRes, linesRes] = await Promise.all([
        supabase.from('payroll_runs').select('*').eq('id', runId!).single(),
        supabase
          .from('payroll_lines')
          .select(`*, employee:employees(full_name_en, employee_number, designation, department)`)
          .eq('run_id', runId!),
      ]);
      if (runRes.error) throw runRes.error;
      if (linesRes.error) throw linesRes.error;
      return { run: runRes.data as PayrollRun, lines: (linesRes.data as any[]) };
    },
  });

  const startRun = async (periodMonth: string) => {
    const data = await payrollService.runPayrollForMonth(periodMonth);
    await qc.invalidateQueries({ queryKey: prKeys.runs });
    return data;
  };
  const approveRun = async (targetRunId: string) => {
    const data = await payrollService.approvePayrollRun(targetRunId);
    await Promise.all([
      qc.invalidateQueries({ queryKey: prKeys.runs }),
      qc.invalidateQueries({ queryKey: prKeys.run(targetRunId) }),
    ]);
    return data;
  };
  const deleteRun = async (targetRunId: string) => {
    const { error } = await supabase.from('payroll_runs').delete().eq('id', targetRunId);
    if (error) throw error;
    await Promise.all([
      qc.invalidateQueries({ queryKey: prKeys.runs }),
      qc.invalidateQueries({ queryKey: prKeys.run(targetRunId) }),
    ]);
  };

  return {
    payrollRuns: runsQ.data ?? [],
    currentRun: detailQ.data?.run ?? null,
    currentLines: detailQ.data?.lines ?? [],
    loading: runsQ.isPending || (!!runId && detailQ.isLoading),
    error: ((runsQ.error || detailQ.error) as Error | null) ?? null,
    refetchRuns: runsQ.refetch,
    refetchDetails: detailQ.refetch,
    startRun,
    approveRun,
    deleteRun,
  };
}

export function usePayrollAdjustments(periodMonth?: string) {
  const qc = useQueryClient();
  const formattedMonth = periodMonth ? (periodMonth.length === 7 ? `${periodMonth}-01` : periodMonth) : '';
  const key = prKeys.adjustments(formattedMonth);

  const q = useQuery({
    queryKey: key,
    enabled: !!periodMonth,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_adjustments')
        .select(`*, employee:employees(full_name_en, employee_number)`)
        .eq('period_month', formattedMonth)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const addAdjustment = async (params: { employee_id: string; adjustment_type: string; amount: number; reason: string }) => {
    if (!periodMonth) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('payroll_adjustments')
      .insert({ ...params, period_month: formattedMonth, status: 'PENDING', created_by: user?.id || null })
      .select()
      .single();
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: key });
    return data;
  };

  const approveAdjustment = async (adjId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('payroll_adjustments').update({ status: 'APPROVED', approved_by: user?.id || null }).eq('id', adjId);
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: key });
  };

  const rejectAdjustment = async (adjId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('payroll_adjustments').update({ status: 'REJECTED', approved_by: user?.id || null }).eq('id', adjId);
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: key });
  };

  return {
    adjustments: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    addAdjustment,
    approveAdjustment,
    rejectAdjustment,
  };
}

export default usePayrollRun;
