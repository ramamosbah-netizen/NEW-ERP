// ============================================================
// JEET ERP — useWorkflow hook
// Drop-in workflow state for any module detail page.
//
//   const wf = useWorkflow('PO', poId, { total: po.total });
//   wf.status, wf.transitions, wf.execute(t.id, comment), wf.history
// ============================================================

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import workflowService from '@/services/workflowService';
import type {
  WorkflowInstance,
  WorkflowTransition,
  WorkflowWithGraph,
  WorkflowStatus,
  WorkflowHistoryEntry,
  PendingApproval,
} from '@/types/platform.types';

export interface UseWorkflowResult {
  /** True while loading the workflow state. */
  loading: boolean;
  /** True when an active workflow definition exists for this module. */
  configured: boolean;
  /** True when this entity has a workflow instance. */
  started: boolean;
  /** The current status definition (label, color) or null. */
  status: WorkflowStatus | null;
  /** Transitions the current user can execute right now. */
  transitions: WorkflowTransition[];
  /** Pending approvals on the in-flight transition (if any). */
  pendingApprovals: PendingApproval[];
  /** Full history of the instance, newest last. */
  history: WorkflowHistoryEntry[];
  /** SLA deadline of the current stage, if set. */
  slaDueAt: string | null;
  /** True when the SLA deadline has passed. */
  slaOverdue: boolean;
  /** Error message from the last operation, if any. */
  error: string | null;
  /** True while a transition is executing. */
  executing: boolean;
  /** Starts the workflow instance for this entity. */
  start: () => Promise<void>;
  /** Executes a transition by id with an optional comment. */
  execute: (transitionId: string, comment?: string) => Promise<{ statusChanged: boolean; awaitingApprovals: number; newStatusKey: string } | null>;
  /** Reloads workflow state. */
  refresh: () => Promise<void>;
}

export function useWorkflow(
  moduleKey: string,
  entityId: string | null | undefined,
  context: Record<string, unknown> = {}
): UseWorkflowResult {
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [workflow, setWorkflow] = useState<WorkflowWithGraph | null>(null);
  const [instance, setInstance] = useState<WorkflowInstance | null>(null);
  const [transitions, setTransitions] = useState<WorkflowTransition[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Serialize context so effect deps stay stable across re-renders
  const contextKey = JSON.stringify(context);

  const refresh = useCallback(async () => {
    if (!entityId) { setLoading(false); return; }
    try {
      setLoading(true);
      const ctx = JSON.parse(contextKey);
      const result = await workflowService.getMyAvailableTransitions(moduleKey, entityId, ctx);
      if (!result) {
        // Either no workflow configured, or no instance yet — distinguish:
        const wf = await workflowService.getActiveWorkflow(moduleKey);
        setWorkflow(wf);
        setInstance(null);
        setTransitions([]);
      } else {
        setWorkflow(result.workflow);
        setInstance(result.instance);
        setTransitions(result.transitions);
      }
      setError(null);
    } catch (err: any) {
      // Tables missing (migration not applied) → behave as unconfigured
      setWorkflow(null);
      setInstance(null);
      setTransitions([]);
      if (!String(err.message || '').match(/relation|schema cache/i)) {
        setError(err.message || 'Failed to load workflow');
      }
    } finally {
      setLoading(false);
    }
  }, [moduleKey, entityId, contextKey]);

  useEffect(() => { refresh(); }, [refresh]);

  const start = useCallback(async () => {
    if (!entityId) return;
    try {
      setExecuting(true);
      await workflowService.startInstance(moduleKey, entityId);
      await refresh();
    } catch (err: any) {
      setError(err.message || 'Failed to start workflow');
    } finally {
      setExecuting(false);
    }
  }, [moduleKey, entityId, refresh]);

  const execute = useCallback(async (transitionId: string, comment?: string) => {
    if (!entityId) return null;
    try {
      setExecuting(true);
      const ctx = JSON.parse(contextKey);
      const result = await workflowService.executeTransition(moduleKey, entityId, transitionId, { comment, context: ctx });
      await refresh();
      return {
        statusChanged: result.statusChanged,
        awaitingApprovals: result.awaitingApprovals,
        newStatusKey: result.instance.current_status_key,
      };
    } catch (err: any) {
      setError(err.message || 'Transition failed');
      return null;
    } finally {
      setExecuting(false);
    }
  }, [moduleKey, entityId, contextKey, refresh]);

  const status = useMemo(() => {
    if (!workflow || !instance) return null;
    return workflow.statuses.find(s => s.status_key === instance.current_status_key) || null;
  }, [workflow, instance]);

  const slaDueAt = instance?.sla_due_at || null;

  return {
    loading,
    configured: !!workflow,
    started: !!instance,
    status,
    transitions,
    pendingApprovals: instance?.pending_approvals || [],
    history: instance?.history || [],
    slaDueAt,
    slaOverdue: !!slaDueAt && new Date(slaDueAt) < new Date(),
    error,
    executing,
    start,
    execute,
    refresh,
  };
}

export default useWorkflow;
