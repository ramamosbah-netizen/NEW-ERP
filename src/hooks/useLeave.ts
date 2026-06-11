// ============================================================
// JEET ERP — Leave Management React Hook
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { leaveService } from '@/services/leaveService';
import { supabase } from '@/lib/supabase';
import type { LeaveRequest, LeaveBalance } from '@/types/hr.types';

export function useLeave(employeeId?: string) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchLeaveDetails = useCallback(async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      setError(null);
      
      const [reqs, { data: bals }] = await Promise.all([
        leaveService.getLeaveRequests(employeeId),
        supabase
          .from('leave_balances')
          .select('*')
          .eq('employee_id', employeeId)
      ]);

      setRequests(reqs);
      setBalances(bals || []);
    } catch (err: any) {
      console.error('Failed to load leave details:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchLeaveDetails();
  }, [fetchLeaveDetails]);

  const submitRequest = async (params: Omit<LeaveRequest, 'id' | 'status' | 'approver_id' | 'created_at' | 'updated_at'>) => {
    try {
      setLoading(true);
      const res = await leaveService.createLeaveRequest(params);
      await fetchLeaveDetails();
      return res;
    } catch (err: any) {
      console.error('Failed to submit leave request:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getWorkingDays = async (fromDate: string, toDate: string) => {
    return leaveService.calculateWorkingDays(fromDate, toDate);
  };

  return {
    requests,
    balances,
    loading,
    error,
    refetch: fetchLeaveDetails,
    submitRequest,
    getWorkingDays
  };
}

export function useLeaveApprovals() {
  const [queue, setQueue] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await leaveService.getApprovalsQueue();
      setQueue(data);
    } catch (err: any) {
      console.error('Failed to load leave approvals queue:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const approve = async (requestId: string) => {
    try {
      setLoading(true);
      await leaveService.approveLeaveRequest(requestId);
      await fetchQueue();
    } catch (err: any) {
      console.error('Failed to approve leave request:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const reject = async (requestId: string) => {
    try {
      setLoading(true);
      await leaveService.rejectLeaveRequest(requestId);
      await fetchQueue();
    } catch (err: any) {
      console.error('Failed to reject leave request:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    queue,
    loading,
    error,
    refetch: fetchQueue,
    approve,
    reject
  };
}
export default useLeave;
