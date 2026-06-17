// ============================================================
// JEET ERP — Workflow Service
// CRUD for workflow definitions + runtime instance engine.
// Any module starts/advances workflows via this service without
// knowing the configuration details.
// ============================================================

import { supabase } from '@/lib/supabase';
import { recordAudit } from '@/lib/audit/recordAudit';
import {
  getInitialStatus,
  getAvailableTransitions,
  buildPendingApprovals,
  applyApproval,
  computeSlaDueAt,
} from '@/lib/workflow/engine';
import type {
  WorkflowDefinition,
  WorkflowStatus,
  WorkflowTransition,
  WorkflowWithGraph,
  WorkflowInstance,
  WorkflowHistoryEntry,
} from '@/types/platform.types';

async function getCurrentUserWithRoles(): Promise<{ id: string; name: string; roleKeys: string[] }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const [{ data: profile }, { data: userRoles }] = await Promise.all([
    supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle(),
    supabase.from('user_roles').select('role:roles(role_key, is_active)').eq('user_id', user.id),
  ]);

  const roleKeys = (userRoles || [])
    .map((ur: any) => ur.role)
    .filter((r: any) => r?.is_active)
    .map((r: any) => r.role_key);

  if (profile?.role && !roleKeys.includes(profile.role)) roleKeys.push(profile.role);

  return { id: user.id, name: profile?.full_name || user.email || 'User', roleKeys };
}

export const workflowService = {
  // ---------- Definitions ----------
  async getDefinitions(): Promise<WorkflowDefinition[]> {
    const { data, error } = await supabase
      .from('workflow_definitions')
      .select('*')
      .order('module_key')
      .order('version', { ascending: false });
    if (error) throw error;
    return data as WorkflowDefinition[];
  },

  async getWorkflowGraph(workflowId: string): Promise<WorkflowWithGraph> {
    const [{ data: def, error: e1 }, { data: statuses, error: e2 }, { data: transitions, error: e3 }] =
      await Promise.all([
        supabase.from('workflow_definitions').select('*').eq('id', workflowId).single(),
        supabase.from('workflow_statuses').select('*').eq('workflow_id', workflowId).order('sort_order'),
        supabase.from('workflow_transitions').select('*').eq('workflow_id', workflowId).order('sort_order'),
      ]);
    if (e1) throw e1;
    if (e2) throw e2;
    if (e3) throw e3;
    return {
      ...(def as WorkflowDefinition),
      statuses: (statuses || []) as WorkflowStatus[],
      transitions: (transitions || []) as WorkflowTransition[],
    };
  },

  async createDefinition(input: { module_key: string; name: string; description?: string }): Promise<WorkflowDefinition> {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('workflow_definitions')
      .insert({ ...input, created_by: user?.id || null })
      .select()
      .single();
    if (error) throw error;

    await recordAudit({
      action: 'CREATE', entity_type: 'WORKFLOW', entity_id: data.id,
      entity_label: input.name, summary: `Created workflow '${input.name}' for module ${input.module_key}`,
      module: 'SYSTEM',
    });
    return data as WorkflowDefinition;
  },

  async updateDefinition(id: string, patch: Partial<Pick<WorkflowDefinition, 'name' | 'description'>>): Promise<void> {
    const { error } = await supabase
      .from('workflow_definitions')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  /** Activates a workflow, deactivating any other active workflow for the same module. */
  async activateDefinition(id: string): Promise<void> {
    const { data: def, error: e1 } = await supabase
      .from('workflow_definitions').select('module_key, name').eq('id', id).single();
    if (e1) throw e1;

    const { error: e2 } = await supabase
      .from('workflow_definitions')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('module_key', def.module_key)
      .eq('is_active', true);
    if (e2) throw e2;

    const { error: e3 } = await supabase
      .from('workflow_definitions')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (e3) throw e3;

    await recordAudit({
      action: 'UPDATE', entity_type: 'WORKFLOW', entity_id: id,
      entity_label: def.name, summary: `Activated workflow '${def.name}' for module ${def.module_key}`,
      module: 'SYSTEM',
    });
  },

  async deactivateDefinition(id: string): Promise<void> {
    const { error } = await supabase
      .from('workflow_definitions')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async deleteDefinition(id: string): Promise<void> {
    const { error } = await supabase.from('workflow_definitions').delete().eq('id', id);
    if (error) throw error;
  },

  /** Deep-clones a workflow (statuses + transitions) as an inactive new version. */
  async cloneDefinition(id: string, newName?: string): Promise<WorkflowDefinition> {
    const graph = await this.getWorkflowGraph(id);
    const { data: { user } } = await supabase.auth.getUser();

    const { data: newDef, error: e1 } = await supabase
      .from('workflow_definitions')
      .insert({
        module_key: graph.module_key,
        name: newName || `${graph.name} (copy)`,
        description: graph.description,
        is_active: false,
        version: graph.version + 1,
        created_by: user?.id || null,
      })
      .select()
      .single();
    if (e1) throw e1;

    // Clone statuses, remembering old→new id mapping
    const idMap = new Map<string, string>();
    for (const s of graph.statuses) {
      const { data: ns, error } = await supabase
        .from('workflow_statuses')
        .insert({
          workflow_id: newDef.id,
          status_key: s.status_key, label: s.label, color: s.color,
          is_initial: s.is_initial, is_terminal: s.is_terminal, sort_order: s.sort_order,
        })
        .select()
        .single();
      if (error) throw error;
      idMap.set(s.id, ns.id);
    }

    if (graph.transitions.length > 0) {
      const inserts = graph.transitions.map(t => ({
        workflow_id: newDef.id,
        from_status_id: idMap.get(t.from_status_id),
        to_status_id: idMap.get(t.to_status_id),
        action_key: t.action_key, label: t.label, allowed_roles: t.allowed_roles,
        approval: t.approval, notifications: t.notifications, conditions: t.conditions,
        sla_hours: t.sla_hours, escalation: t.escalation, sort_order: t.sort_order,
      }));
      const { error } = await supabase.from('workflow_transitions').insert(inserts);
      if (error) throw error;
    }

    return newDef as WorkflowDefinition;
  },

  // ---------- Statuses ----------
  async upsertStatus(status: Partial<WorkflowStatus> & { workflow_id: string; status_key: string; label: string }): Promise<WorkflowStatus> {
    if (status.is_initial) {
      // Only one initial status per workflow
      await supabase
        .from('workflow_statuses')
        .update({ is_initial: false })
        .eq('workflow_id', status.workflow_id)
        .eq('is_initial', true);
    }
    const { data, error } = status.id
      ? await supabase.from('workflow_statuses').update(status).eq('id', status.id).select().single()
      : await supabase.from('workflow_statuses').insert(status).select().single();
    if (error) throw error;
    return data as WorkflowStatus;
  },

  async deleteStatus(id: string): Promise<void> {
    const { error } = await supabase.from('workflow_statuses').delete().eq('id', id);
    if (error) throw error;
  },

  // ---------- Transitions ----------
  async upsertTransition(t: Partial<WorkflowTransition> & {
    workflow_id: string; from_status_id: string; to_status_id: string; action_key: string; label: string;
  }): Promise<WorkflowTransition> {
    const { data, error } = t.id
      ? await supabase.from('workflow_transitions').update(t).eq('id', t.id).select().single()
      : await supabase.from('workflow_transitions').insert(t).select().single();
    if (error) throw error;
    return data as WorkflowTransition;
  },

  async deleteTransition(id: string): Promise<void> {
    const { error } = await supabase.from('workflow_transitions').delete().eq('id', id);
    if (error) throw error;
  },

  // ---------- Runtime ----------
  /** Returns the active workflow graph for a module, or null when none configured. */
  async getActiveWorkflow(moduleKey: string): Promise<WorkflowWithGraph | null> {
    const { data: def, error } = await supabase
      .from('workflow_definitions')
      .select('*')
      .eq('module_key', moduleKey)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw error;
    if (!def) return null;
    return this.getWorkflowGraph(def.id);
  },

  /** Starts (or returns the existing) workflow instance for an entity. */
  async startInstance(moduleKey: string, entityId: string): Promise<WorkflowInstance | null> {
    const workflow = await this.getActiveWorkflow(moduleKey);
    if (!workflow) return null;

    const { data: existing } = await supabase
      .from('workflow_instances')
      .select('*')
      .eq('entity_type', moduleKey)
      .eq('entity_id', entityId)
      .maybeSingle();
    if (existing) return existing as WorkflowInstance;

    const initial = getInitialStatus(workflow.statuses);
    if (!initial) throw new Error(`Workflow '${workflow.name}' has no statuses`);

    const me = await getCurrentUserWithRoles();
    const entry: WorkflowHistoryEntry = {
      at: new Date().toISOString(), by: me.id, by_name: me.name,
      action: 'START', from: '', to: initial.status_key,
    };

    const { data, error } = await supabase
      .from('workflow_instances')
      .insert({
        workflow_id: workflow.id,
        entity_type: moduleKey,
        entity_id: entityId,
        current_status_key: initial.status_key,
        history: [entry],
      })
      .select()
      .single();
    if (error) throw error;
    return data as WorkflowInstance;
  },

  async getInstance(moduleKey: string, entityId: string): Promise<WorkflowInstance | null> {
    const { data, error } = await supabase
      .from('workflow_instances')
      .select('*')
      .eq('entity_type', moduleKey)
      .eq('entity_id', entityId)
      .maybeSingle();
    if (error) throw error;
    return data as WorkflowInstance | null;
  },

  /** Returns transitions the current user can execute for an entity right now. */
  async getMyAvailableTransitions(
    moduleKey: string,
    entityId: string,
    context: Record<string, unknown> = {}
  ): Promise<{ instance: WorkflowInstance; transitions: WorkflowTransition[]; workflow: WorkflowWithGraph } | null> {
    const workflow = await this.getActiveWorkflow(moduleKey);
    if (!workflow) return null;
    const instance = await this.getInstance(moduleKey, entityId);
    if (!instance) return null;

    const me = await getCurrentUserWithRoles();
    const transitions = getAvailableTransitions(
      workflow.transitions, workflow.statuses, instance.current_status_key, me.roleKeys, context
    );
    return { instance, transitions, workflow };
  },

  /**
   * Executes a transition. Handles approval gathering: if the transition
   * requires approvals and they are not yet satisfied, the approval is
   * recorded but the status does not change until the requirement is met.
   */
  async executeTransition(
    moduleKey: string,
    entityId: string,
    transitionId: string,
    options: { comment?: string; context?: Record<string, unknown> } = {}
  ): Promise<{ instance: WorkflowInstance; statusChanged: boolean; awaitingApprovals: number }> {
    const workflow = await this.getActiveWorkflow(moduleKey);
    if (!workflow) throw new Error(`No active workflow for module ${moduleKey}`);

    const instance = await this.getInstance(moduleKey, entityId);
    if (!instance) throw new Error('Workflow instance not found — call startInstance first');

    const transition = workflow.transitions.find(t => t.id === transitionId);
    if (!transition) throw new Error('Transition not found in active workflow');

    const me = await getCurrentUserWithRoles();

    // Authorization check
    const available = getAvailableTransitions(
      workflow.transitions, workflow.statuses, instance.current_status_key, me.roleKeys, options.context || {}
    );
    if (!available.some(t => t.id === transitionId)) {
      throw new Error('You are not allowed to execute this transition from the current status');
    }

    const fromStatus = workflow.statuses.find(s => s.id === transition.from_status_id)!;
    const toStatus = workflow.statuses.find(s => s.id === transition.to_status_id)!;

    // Maker-checker: the user who created/started this record cannot also approve
    // it. A separate user must perform any approval-bearing transition.
    if (transition.approval && transition.approval.mode !== 'NONE') {
      const starter =
        (instance.history || []).find(h => h.action === 'START') || (instance.history || [])[0];
      if (starter?.by && starter.by === me.id) {
        throw new Error(
          'Maker-checker: you cannot approve a record you created. A different user must approve it.',
        );
      }
    }

    // Approval handling
    let pending = instance.pending_approvals?.length
      ? instance.pending_approvals
      : buildPendingApprovals(transition.approval);

    let satisfied = true;
    if (transition.approval && transition.approval.mode !== 'NONE') {
      const result = applyApproval(transition.approval, pending, me.id, me.roleKeys);
      pending = result.pending;
      satisfied = result.satisfied;
    }

    const entry: WorkflowHistoryEntry = {
      at: new Date().toISOString(), by: me.id, by_name: me.name,
      action: transition.action_key,
      from: fromStatus.status_key,
      to: satisfied ? toStatus.status_key : fromStatus.status_key,
      comment: options.comment,
    };

    const patch: Record<string, unknown> = {
      history: [...(instance.history || []), entry],
      pending_approvals: satisfied ? [] : pending,
      updated_at: new Date().toISOString(),
    };

    if (satisfied) {
      patch.current_status_key = toStatus.status_key;
      patch.sla_due_at = computeSlaDueAt(transition.sla_hours);
    }

    const { data: updated, error } = await supabase
      .from('workflow_instances')
      .update(patch)
      .eq('id', instance.id)
      .select()
      .single();
    if (error) throw error;

    await recordAudit({
      action: 'UPDATE', entity_type: 'WORKFLOW_INSTANCE', entity_id: instance.id,
      entity_label: `${moduleKey}/${entityId}`,
      summary: satisfied
        ? `${transition.label}: ${fromStatus.label} → ${toStatus.label}`
        : `${transition.label}: approval recorded (${pending.filter(p => p.approved_by).length}/${pending.length})`,
      module: 'SYSTEM',
    });

    return {
      instance: updated as WorkflowInstance,
      statusChanged: satisfied,
      awaitingApprovals: satisfied ? 0 : pending.filter(p => !p.approved_by).length,
    };
  },

  // ---------- Analytics ----------
  async getWorkflowAnalytics(moduleKey: string): Promise<{
    byStatus: Record<string, number>;
    total: number;
    overdue: number;
    avgHoursToTerminal: number | null;
  }> {
    const { data: instances, error } = await supabase
      .from('workflow_instances')
      .select('current_status_key, sla_due_at, created_at, updated_at, history')
      .eq('entity_type', moduleKey);
    if (error) throw error;

    const byStatus: Record<string, number> = {};
    let overdue = 0;
    const terminalDurations: number[] = [];
    const workflow = await this.getActiveWorkflow(moduleKey);
    const terminalKeys = new Set((workflow?.statuses || []).filter(s => s.is_terminal).map(s => s.status_key));

    for (const inst of instances || []) {
      byStatus[inst.current_status_key] = (byStatus[inst.current_status_key] || 0) + 1;
      if (inst.sla_due_at && new Date(inst.sla_due_at) < new Date()) overdue++;
      if (terminalKeys.has(inst.current_status_key)) {
        terminalDurations.push(
          (new Date(inst.updated_at).getTime() - new Date(inst.created_at).getTime()) / 3600_000
        );
      }
    }

    return {
      byStatus,
      total: (instances || []).length,
      overdue,
      avgHoursToTerminal: terminalDurations.length
        ? Math.round(terminalDurations.reduce((a, b) => a + b, 0) / terminalDurations.length)
        : null,
    };
  },
};

export default workflowService;
