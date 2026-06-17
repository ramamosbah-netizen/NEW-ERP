// ============================================================
// Aura ERP — Timesheets React Hooks (React Query)
// ============================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { timesheetService } from '@/services/timesheetService';
import type { Timesheet, TimesheetEntry } from '@/types/timesheet.types';

const tsKeys = {
  detail: (employeeId: string, weekStart: string) => ['timesheet', employeeId, weekStart] as const,
  approvals: ['timesheet', 'approvals'] as const,
};

export function useTimesheet(employeeId?: string, weekStart?: string) {
  const qc = useQueryClient();
  const enabled = !!employeeId && !!weekStart;
  const key = tsKeys.detail(employeeId ?? '', weekStart ?? '');

  const q = useQuery({
    queryKey: key,
    enabled,
    queryFn: () => timesheetService.getTimesheet(employeeId!, weekStart!),
  });

  const timesheet = q.data?.timesheet ?? null;
  const entries = q.data?.entries ?? [];

  const initTimesheet = async () => {
    if (!enabled) return;
    const ts = await timesheetService.getOrCreateTimesheet(employeeId!, weekStart!);
    await qc.invalidateQueries({ queryKey: key });
    return ts;
  };

  const saveEntries = async (newEntries: Omit<TimesheetEntry, 'id' | 'timesheet_id' | 'created_at'>[]) => {
    let tsId = timesheet?.id;
    if (!tsId) {
      const ts = await timesheetService.getOrCreateTimesheet(employeeId!, weekStart!);
      tsId = ts?.id;
    }
    if (!tsId) return;
    const saved = await timesheetService.saveEntries(tsId, newEntries);
    await qc.invalidateQueries({ queryKey: key });
    return saved;
  };

  const submit = async () => {
    if (!timesheet?.id) return;
    const updated = await timesheetService.submitTimesheet(timesheet.id);
    await qc.invalidateQueries({ queryKey: key });
    return updated;
  };

  const getSuggestions = async () => {
    if (!enabled) return [];
    return timesheetService.getPrefillSuggestions(employeeId!, weekStart!);
  };

  return {
    timesheet,
    entries,
    loading: q.isLoading,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    initTimesheet,
    saveEntries,
    submit,
    getSuggestions,
  };
}

export function useTimesheetApprovals() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: tsKeys.approvals, queryFn: () => timesheetService.getApprovalsQueue() });

  const approve = async (timesheetId: string) => {
    await timesheetService.approveTimesheet(timesheetId);
    await qc.invalidateQueries({ queryKey: tsKeys.approvals });
  };
  const reject = async (timesheetId: string, reason: string) => {
    await timesheetService.rejectTimesheet(timesheetId, reason);
    await qc.invalidateQueries({ queryKey: tsKeys.approvals });
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
