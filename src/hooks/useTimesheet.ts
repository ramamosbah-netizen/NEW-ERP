// ============================================================
// JEET ERP — Timesheets React Hook
// ============================================================

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from 'react';
import { timesheetService } from '@/services/timesheetService';
import type { Timesheet, TimesheetEntry } from '@/types/timesheet.types';

export function useTimesheet(employeeId?: string, weekStart?: string) {
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTimesheet = useCallback(async () => {
    if (!employeeId || !weekStart) return;
    try {
      setLoading(true);
      setError(null);
      
      const { timesheet: ts, entries: ent } = await timesheetService.getTimesheet(employeeId, weekStart);
      setTimesheet(ts);
      setEntries(ent);
    } catch (err: any) {
      logger.error('Failed to fetch timesheet:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [employeeId, weekStart]);

  useEffect(() => {
    fetchTimesheet();
  }, [fetchTimesheet]);

  const initTimesheet = async () => {
    if (!employeeId || !weekStart) return;
    try {
      setLoading(true);
      const ts = await timesheetService.getOrCreateTimesheet(employeeId, weekStart);
      setTimesheet(ts);
      setEntries([]);
      return ts;
    } catch (err: any) {
      logger.error('Failed to create timesheet:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const saveEntries = async (newEntries: Omit<TimesheetEntry, 'id' | 'timesheet_id' | 'created_at'>[]) => {
    let tsId = timesheet?.id;
    if (!tsId) {
      const ts = await initTimesheet();
      tsId = ts?.id;
    }
    if (!tsId) return;

    try {
      setLoading(true);
      const saved = await timesheetService.saveEntries(tsId, newEntries);
      setEntries(saved);
      // Reload timesheet header to get updated totals
      const { timesheet: updatedTs } = await timesheetService.getTimesheet(employeeId!, weekStart!);
      setTimesheet(updatedTs);
      return saved;
    } catch (err: any) {
      logger.error('Failed to save entries:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!timesheet?.id) return;
    try {
      setLoading(true);
      const updated = await timesheetService.submitTimesheet(timesheet.id);
      setTimesheet(updated);
      return updated;
    } catch (err: any) {
      logger.error('Failed to submit timesheet:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getSuggestions = async () => {
    if (!employeeId || !weekStart) return [];
    return timesheetService.getPrefillSuggestions(employeeId, weekStart);
  };

  return {
    timesheet,
    entries,
    loading,
    error,
    refetch: fetchTimesheet,
    initTimesheet,
    saveEntries,
    submit,
    getSuggestions
  };
}

export function useTimesheetApprovals() {
  const [queue, setQueue] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await timesheetService.getApprovalsQueue();
      setQueue(data);
    } catch (err: any) {
      logger.error('Failed to load approvals queue:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const approve = async (timesheetId: string) => {
    try {
      setLoading(true);
      await timesheetService.approveTimesheet(timesheetId);
      await fetchQueue();
    } catch (err: any) {
      logger.error('Failed to approve timesheet:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const reject = async (timesheetId: string, reason: string) => {
    try {
      setLoading(true);
      await timesheetService.rejectTimesheet(timesheetId, reason);
      await fetchQueue();
    } catch (err: any) {
      logger.error('Failed to reject timesheet:', err);
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
