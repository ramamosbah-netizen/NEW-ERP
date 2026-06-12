// ============================================================
// JEET ERP — Workflow Engine Core
// Pure evaluation functions: no I/O, fully testable.
// Consumed by workflowService and any module needing
// transition/rule/condition evaluation.
// ============================================================

import type {
  WorkflowStatus,
  WorkflowTransition,
  RuleCondition,
  BusinessRule,
  RuleAction,
  ApprovalConfig,
  PendingApproval,
} from '@/types/platform.types';

/** Returns the initial status of a workflow graph (falls back to lowest sort_order). */
export function getInitialStatus(statuses: WorkflowStatus[]): WorkflowStatus | null {
  if (statuses.length === 0) return null;
  return (
    statuses.find(s => s.is_initial) ||
    [...statuses].sort((a, b) => a.sort_order - b.sort_order)[0]
  );
}

/** Evaluates a single condition against a record context. */
export function evaluateCondition(cond: RuleCondition, context: Record<string, unknown>): boolean {
  const raw = context[cond.field];
  const val = cond.value;

  switch (cond.operator) {
    case '=':  return looseEquals(raw, val);
    case '!=': return !looseEquals(raw, val);
    case '>':  return toNum(raw) > toNum(val);
    case '>=': return toNum(raw) >= toNum(val);
    case '<':  return toNum(raw) < toNum(val);
    case '<=': return toNum(raw) <= toNum(val);
    case 'contains':
      return String(raw ?? '').toLowerCase().includes(String(val ?? '').toLowerCase());
    case 'not_contains':
      return !String(raw ?? '').toLowerCase().includes(String(val ?? '').toLowerCase());
    case 'in':
      return toArray(val).some(v => looseEquals(raw, v));
    case 'not_in':
      return !toArray(val).some(v => looseEquals(raw, v));
    case 'is_empty':
      return raw === null || raw === undefined || String(raw).trim() === '';
    case 'not_empty':
      return !(raw === null || raw === undefined || String(raw).trim() === '');
    default:
      return false;
  }
}

/**
 * Evaluates a condition list. Conditions chain with their `join`
 * (default AND). Empty list passes.
 */
export function evaluateConditions(conditions: RuleCondition[], context: Record<string, unknown>): boolean {
  if (!conditions || conditions.length === 0) return true;

  let result = evaluateCondition(conditions[0], context);
  for (let i = 1; i < conditions.length; i++) {
    const join = conditions[i].join || 'AND';
    const current = evaluateCondition(conditions[i], context);
    result = join === 'OR' ? result || current : result && current;
  }
  return result;
}

/**
 * Returns transitions executable from the current status by a user
 * holding the given role keys, against the given record context.
 */
export function getAvailableTransitions(
  transitions: WorkflowTransition[],
  statuses: WorkflowStatus[],
  currentStatusKey: string,
  userRoleKeys: string[],
  context: Record<string, unknown> = {}
): WorkflowTransition[] {
  const current = statuses.find(s => s.status_key === currentStatusKey);
  if (!current) return [];

  return transitions
    .filter(t => t.from_status_id === current.id)
    .filter(t => t.allowed_roles.length === 0 || t.allowed_roles.some(r => userRoleKeys.includes(r)))
    .filter(t => evaluateConditions(t.conditions || [], context))
    .sort((a, b) => a.sort_order - b.sort_order);
}

/** Builds the initial pending-approvals list for a transition's approval config. */
export function buildPendingApprovals(approval: ApprovalConfig): PendingApproval[] {
  if (!approval || approval.mode === 'NONE') return [];
  return approval.approvers.map(a => ({ ...a, approved_by: null, approved_at: null }));
}

/**
 * Applies one approval against a pending list (SEQUENTIAL approves the first
 * unapproved entry; PARALLEL/SINGLE approves any matching entry).
 * Returns the updated list and whether the approval requirement is now met.
 */
export function applyApproval(
  approval: ApprovalConfig,
  pending: PendingApproval[],
  approverUserId: string,
  approverRoleKeys: string[]
): { pending: PendingApproval[]; satisfied: boolean } {
  if (!approval || approval.mode === 'NONE') return { pending, satisfied: true };

  const next = pending.map(p => ({ ...p }));

  const matches = (p: PendingApproval) =>
    !p.approved_by &&
    ((p.type === 'USER' && p.value === approverUserId) ||
     (p.type === 'ROLE' && approverRoleKeys.includes(p.value)));

  if (approval.mode === 'SEQUENTIAL') {
    const firstUnapproved = next.find(p => !p.approved_by);
    if (firstUnapproved && matches(firstUnapproved)) {
      firstUnapproved.approved_by = approverUserId;
      firstUnapproved.approved_at = new Date().toISOString();
    }
  } else {
    const target = next.find(matches);
    if (target) {
      target.approved_by = approverUserId;
      target.approved_at = new Date().toISOString();
    }
  }

  const approvedCount = next.filter(p => p.approved_by).length;
  const required = approval.mode === 'SINGLE'
    ? Math.min(approval.min_approvals || 1, 1)
    : approval.mode === 'PARALLEL'
      ? (approval.min_approvals || next.length)
      : next.length; // SEQUENTIAL requires all

  return { pending: next, satisfied: approvedCount >= required };
}

/**
 * Evaluates active business rules for a module/event against a record,
 * returning matched actions ordered by rule priority.
 */
export function evaluateRules(
  rules: BusinessRule[],
  triggerEvent: string,
  context: Record<string, unknown>
): { rule: BusinessRule; actions: RuleAction[] }[] {
  return rules
    .filter(r => r.is_active && r.trigger_event === triggerEvent)
    .sort((a, b) => a.priority - b.priority)
    .filter(r => evaluateConditions(r.conditions, context))
    .map(r => ({ rule: r, actions: r.actions }));
}

/** Returns true if any matched rule action blocks the operation. */
export function isBlocked(matched: { actions: RuleAction[] }[]): { blocked: boolean; reason?: string } {
  for (const m of matched) {
    const block = m.actions.find(a => a.type === 'BLOCK');
    if (block) {
      return { blocked: true, reason: String(block.params?.message || 'Blocked by business rule') };
    }
  }
  return { blocked: false };
}

/**
 * Renders a {{Variable}} template against a context map.
 * Unknown variables render as an em-dash.
 */
export function renderTemplate(template: string, vars: Record<string, unknown>): string {
  return (template || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const val = key.split('.').reduce<unknown>(
      (acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined),
      vars
    );
    return val === null || val === undefined ? '—' : String(val);
  });
}

/** Computes an SLA due date from now. */
export function computeSlaDueAt(slaHours: number | null | undefined): string | null {
  if (!slaHours || slaHours <= 0) return null;
  return new Date(Date.now() + slaHours * 3600_000).toISOString();
}

// ---------- internals ----------
function looseEquals(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' || typeof b === 'number') return toNum(a) === toNum(b);
  return String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function toArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') return v.split(',').map(s => s.trim());
  return [v];
}
