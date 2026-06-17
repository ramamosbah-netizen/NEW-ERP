// ============================================================
// Aura ERP — Leave Management React Hooks (React Query)
// ============================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { leaveService } from '@/services/leaveService';
import { supabase } from '@/lib/supabase';
import type { LeaveRequest } from '@/types/hr.types';

const leaveKeys = {
  detail: (id: string) => ['leave', 'employee', id] as const,
  approvals: ['leave', 'approvals'] as const,
};

export function useLeave(employeeId?: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: leaveKeys.detail(employeeId ?? ''),
    enabled: !!employeeId,
    queryFn: async () => {
      const [requests, { data: bals }] = await Promise.all([
        leaveService.getLeaveRequests(employeeId!),
        supabase.from('leave_balances').select('*').eq('employee_id', employeeId!),
      ]);
      return { requests, balances: bals || [] };
    },
  });

  const submitRequest = async (
    params: Omit<LeaveRequest, 'id' | 'status' | 'approver_id' | 'created_at' | 'updated_at'>,
  ) => {
    const res = await leaveService.createLeaveRequest(params);
    await qc.invalidateQueries({ queryKey: leaveKeys.detail(employeeId ?? '') });
    return res;
  };

  const getWorkingDays = async (fromDate: string, toDate: string) =>
    leaveService.calculateWorkingDays(fromDate, toDate);

  return {
    requests: q.data?.requests ?? [],
    balances: q.data?.balances ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    submitRequest,
    getWorkingDays,
  };
}

export function useLeaveApprovals() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: leaveKeys.approvals, queryFn: () => leaveService.getApprovalsQueue() });

  const approve = async (requestId: string) => {
    await leaveService.approveLeaveRequest(requestId);
    await qc.invalidateQueries({ queryKey: leaveKeys.approvals });
  };
  const reject = async (requestId: string) => {
    await leaveService.rejectLeaveRequest(requestId);
    await qc.invalidateQueries({ queryKey: leaveKeys.approvals });
  };

  return {
    queue: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    approve,
    reject,
  };
}

export default useLeave;
