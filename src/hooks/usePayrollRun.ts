// ============================================================
// JEET ERP — Payroll Runs React Hook
// ============================================================

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from 'react';
import { payrollService } from '@/services/payrollService';
import { supabase } from '@/lib/supabase';
import type { PayrollRun, PayrollLine, PayrollAdjustment } from '@/types/payroll.types';

export function usePayrollRun(runId?: string) {
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [currentRun, setCurrentRun] = useState<PayrollRun | null>(null);
  const [currentLines, setCurrentLines] = useState<PayrollLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchRuns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('payroll_runs')
        .select('*')
        .order('period_month', { ascending: false });

      if (err) throw err;
      setPayrollRuns(data || []);
    } catch (err: any) {
      logger.error('Failed to fetch payroll runs list:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRunDetails = useCallback(async () => {
    if (!runId) return;
    try {
      setLoading(true);
      setError(null);

      const [runRes, linesRes] = await Promise.all([
        supabase
          .from('payroll_runs')
          .select('*')
          .eq('id', runId)
          .single(),
        supabase
          .from('payroll_lines')
          .select(`
            *,
            employee:employees(full_name_en, employee_number, designation, department)
          `)
          .eq('run_id', runId)
      ]);

      if (runRes.error) throw runRes.error;
      if (linesRes.error) throw linesRes.error;

      setCurrentRun(runRes.data as PayrollRun);
      setCurrentLines(linesRes.data as any[]);
    } catch (err: any) {
      logger.error(`Failed to fetch run details for ${runId}:`, err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  useEffect(() => {
    fetchRunDetails();
  }, [fetchRunDetails]);

  const startRun = async (periodMonth: string) => {
    try {
      setLoading(true);
      const data = await payrollService.runPayrollForMonth(periodMonth);
      await fetchRuns();
      return data;
    } catch (err: any) {
      logger.error(`Failed to run payroll for ${periodMonth}:`, err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const approveRun = async (targetRunId: string) => {
    try {
      setLoading(true);
      const data = await payrollService.approvePayrollRun(targetRunId);
      if (runId === targetRunId) {
        await fetchRunDetails();
      }
      await fetchRuns();
      return data;
    } catch (err: any) {
      logger.error(`Failed to approve run ${targetRunId}:`, err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteRun = async (targetRunId: string) => {
    try {
      setLoading(true);
      const { error: delErr } = await supabase
        .from('payroll_runs')
        .delete()
        .eq('id', targetRunId);

      if (delErr) throw delErr;
      await fetchRuns();
      if (runId === targetRunId) {
        setCurrentRun(null);
        setCurrentLines([]);
      }
    } catch (err: any) {
      logger.error(`Failed to delete run ${targetRunId}:`, err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    payrollRuns,
    currentRun,
    currentLines,
    loading,
    error,
    refetchRuns: fetchRuns,
    refetchDetails: fetchRunDetails,
    startRun,
    approveRun,
    deleteRun
  };
}

export function usePayrollAdjustments(periodMonth?: string) {
  const [adjustments, setAdjustments] = useState<PayrollAdjustment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAdjustments = useCallback(async () => {
    if (!periodMonth) return;
    try {
      setLoading(true);
      setError(null);

      const formattedMonth = periodMonth.length === 7 ? `${periodMonth}-01` : periodMonth;

      const { data, error: err } = await supabase
        .from('payroll_adjustments')
        .select(`
          *,
          employee:employees(full_name_en, employee_number)
        `)
        .eq('period_month', formattedMonth)
        .order('created_at', { ascending: false });

      if (err) throw err;
      setAdjustments(data || []);
    } catch (err: any) {
      logger.error('Failed to load payroll adjustments:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [periodMonth]);

  useEffect(() => {
    fetchAdjustments();
  }, [fetchAdjustments]);

  const addAdjustment = async (params: {
    employee_id: string;
    adjustment_type: string;
    amount: number;
    reason: string;
  }) => {
    if (!periodMonth) return;
    const { data: { user } } = await supabase.auth.getUser();

    const formattedMonth = periodMonth.length === 7 ? `${periodMonth}-01` : periodMonth;

    const { data, error: err } = await supabase
      .from('payroll_adjustments')
      .insert({
        ...params,
        period_month: formattedMonth,
        status: 'PENDING',
        created_by: user?.id || null
      })
      .select()
      .single();

    if (err) throw err;
    await fetchAdjustments();
    return data;
  };

  const approveAdjustment = async (adjId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error: err } = await supabase
      .from('payroll_adjustments')
      .update({
        status: 'APPROVED',
        approved_by: user?.id || null
      })
      .eq('id', adjId);

    if (err) throw err;
    await fetchAdjustments();
  };

  const rejectAdjustment = async (adjId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error: err } = await supabase
      .from('payroll_adjustments')
      .update({
        status: 'REJECTED',
        approved_by: user?.id || null
      })
      .eq('id', adjId);

    if (err) throw err;
    await fetchAdjustments();
  };

  return {
    adjustments,
    loading,
    error,
    refetch: fetchAdjustments,
    addAdjustment,
    approveAdjustment,
    rejectAdjustment
  };
}
export default usePayrollRun;
