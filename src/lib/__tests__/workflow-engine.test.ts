import { describe, it, expect } from 'vitest';
import {
  getInitialStatus,
  evaluateCondition,
  evaluateConditions,
  getAvailableTransitions,
  buildPendingApprovals,
  applyApproval,
  evaluateRules,
  isBlocked,
  renderTemplate,
  computeSlaDueAt,
} from '@/lib/workflow/engine';
import type {
  WorkflowStatus,
  WorkflowTransition,
  ApprovalConfig,
  BusinessRule,
} from '@/types/platform.types';

function mkStatus(p: Partial<WorkflowStatus> & { status_key: string }): WorkflowStatus {
  return {
    id: p.id ?? p.status_key,
    workflow_id: 'wf',
    status_key: p.status_key,
    label: p.label ?? p.status_key,
    color: p.color ?? 'neutral',
    is_initial: p.is_initial ?? false,
    is_terminal: p.is_terminal ?? false,
    sort_order: p.sort_order ?? 0,
  };
}

function mkTransition(
  p: Partial<WorkflowTransition> & { from_status_id: string; to_status_id: string },
): WorkflowTransition {
  return {
    id: p.id ?? `${p.from_status_id}->${p.to_status_id}`,
    workflow_id: 'wf',
    from_status_id: p.from_status_id,
    to_status_id: p.to_status_id,
    action_key: p.action_key ?? 'go',
    label: p.label ?? 'Go',
    allowed_roles: p.allowed_roles ?? [],
    approval: p.approval ?? { mode: 'NONE', approvers: [], min_approvals: 0 },
    notifications: p.notifications ?? [],
    conditions: p.conditions ?? [],
    sla_hours: p.sla_hours ?? null,
    escalation: p.escalation ?? null,
    sort_order: p.sort_order ?? 0,
  };
}

describe('getInitialStatus', () => {
  it('prefers the flagged initial status', () => {
    const statuses = [
      mkStatus({ status_key: 'b', sort_order: 0 }),
      mkStatus({ status_key: 'a', sort_order: 1, is_initial: true }),
    ];
    expect(getInitialStatus(statuses)?.status_key).toBe('a');
  });

  it('falls back to the lowest sort_order', () => {
    const statuses = [
      mkStatus({ status_key: 'b', sort_order: 5 }),
      mkStatus({ status_key: 'a', sort_order: 1 }),
    ];
    expect(getInitialStatus(statuses)?.status_key).toBe('a');
  });

  it('returns null when empty', () => {
    expect(getInitialStatus([])).toBeNull();
  });
});

describe('evaluateCondition', () => {
  it('handles numeric comparisons', () => {
    expect(evaluateCondition({ field: 'amount', operator: '>', value: 1000 }, { amount: 2000 })).toBe(true);
    expect(evaluateCondition({ field: 'amount', operator: '<=', value: 1000 }, { amount: 2000 })).toBe(false);
  });

  it('handles equality loosely (string/number)', () => {
    expect(evaluateCondition({ field: 'x', operator: '=', value: '5' }, { x: 5 })).toBe(true);
  });

  it('handles in / contains / empty operators', () => {
    expect(evaluateCondition({ field: 'r', operator: 'in', value: ['a', 'b'] }, { r: 'b' })).toBe(true);
    expect(evaluateCondition({ field: 's', operator: 'contains', value: 'oo' }, { s: 'Foobar' })).toBe(true);
    expect(evaluateCondition({ field: 'n', operator: 'is_empty', value: null }, { n: '' })).toBe(true);
    expect(evaluateCondition({ field: 'n', operator: 'not_empty', value: null }, { n: 'x' })).toBe(true);
  });
});

describe('evaluateConditions', () => {
  it('passes an empty condition list', () => {
    expect(evaluateConditions([], {})).toBe(true);
  });

  it('chains with AND / OR joins', () => {
    const ctx = { a: 10, b: 0 };
    expect(
      evaluateConditions(
        [
          { field: 'a', operator: '>', value: 5 },
          { field: 'b', operator: '>', value: 5, join: 'AND' },
        ],
        ctx,
      ),
    ).toBe(false);
    expect(
      evaluateConditions(
        [
          { field: 'a', operator: '>', value: 5 },
          { field: 'b', operator: '>', value: 5, join: 'OR' },
        ],
        ctx,
      ),
    ).toBe(true);
  });
});

describe('getAvailableTransitions', () => {
  const statuses = [mkStatus({ status_key: 'draft' }), mkStatus({ status_key: 'review' })];
  const transitions = [
    mkTransition({ from_status_id: 'draft', to_status_id: 'review', allowed_roles: ['manager'], sort_order: 1 }),
    mkTransition({ from_status_id: 'draft', to_status_id: 'review', action_key: 'open', allowed_roles: [], sort_order: 0 }),
  ];

  it('filters by current status and role, and sorts', () => {
    const out = getAvailableTransitions(transitions, statuses, 'draft', ['engineer']);
    // only the open-to-all transition is available to an engineer
    expect(out).toHaveLength(1);
    expect(out[0].action_key).toBe('open');
  });

  it('honours condition gating', () => {
    const gated = [
      mkTransition({
        from_status_id: 'draft',
        to_status_id: 'review',
        conditions: [{ field: 'amount', operator: '>', value: 1000 }],
      }),
    ];
    expect(getAvailableTransitions(gated, statuses, 'draft', [], { amount: 500 })).toHaveLength(0);
    expect(getAvailableTransitions(gated, statuses, 'draft', [], { amount: 5000 })).toHaveLength(1);
  });
});

describe('approvals', () => {
  it('SEQUENTIAL requires every approver in order', () => {
    const approval: ApprovalConfig = {
      mode: 'SEQUENTIAL',
      approvers: [
        { type: 'ROLE', value: 'manager' },
        { type: 'ROLE', value: 'gm' },
      ],
      min_approvals: 0,
    };
    const pending = buildPendingApprovals(approval);
    expect(pending).toHaveLength(2);

    const first = applyApproval(approval, pending, 'u1', ['manager']);
    expect(first.satisfied).toBe(false);

    const second = applyApproval(approval, first.pending, 'u2', ['gm']);
    expect(second.satisfied).toBe(true);
  });

  it('SINGLE is satisfied by one matching approver', () => {
    const approval: ApprovalConfig = {
      mode: 'SINGLE',
      approvers: [
        { type: 'ROLE', value: 'manager' },
        { type: 'ROLE', value: 'gm' },
      ],
      min_approvals: 1,
    };
    const res = applyApproval(approval, buildPendingApprovals(approval), 'u1', ['gm']);
    expect(res.satisfied).toBe(true);
  });

  it('PARALLEL needs min_approvals approvers', () => {
    const approval: ApprovalConfig = {
      mode: 'PARALLEL',
      approvers: [
        { type: 'ROLE', value: 'a' },
        { type: 'ROLE', value: 'b' },
      ],
      min_approvals: 2,
    };
    const one = applyApproval(approval, buildPendingApprovals(approval), 'u1', ['a']);
    expect(one.satisfied).toBe(false);
    const two = applyApproval(approval, one.pending, 'u2', ['b']);
    expect(two.satisfied).toBe(true);
  });
});

describe('business rules', () => {
  function mkRule(p: Partial<BusinessRule> & { trigger_event: BusinessRule['trigger_event'] }): BusinessRule {
    return {
      id: p.id ?? 'r',
      module_key: 'PO',
      name: p.name ?? 'rule',
      description: null,
      trigger_event: p.trigger_event,
      conditions: p.conditions ?? [],
      actions: p.actions ?? [],
      priority: p.priority ?? 0,
      is_active: p.is_active ?? true,
      created_at: '',
      updated_at: '',
    };
  }

  it('matches active rules for the event and reports blocks', () => {
    const rules = [
      mkRule({
        trigger_event: 'ON_SUBMIT',
        conditions: [{ field: 'amount', operator: '>', value: 50000 }],
        actions: [{ type: 'BLOCK', params: { message: 'Needs GM sign-off' } }],
      }),
    ];
    const matched = evaluateRules(rules, 'ON_SUBMIT', { amount: 100000 });
    expect(matched).toHaveLength(1);
    expect(isBlocked(matched)).toEqual({ blocked: true, reason: 'Needs GM sign-off' });

    const none = evaluateRules(rules, 'ON_SUBMIT', { amount: 10 });
    expect(none).toHaveLength(0);
    expect(isBlocked(none).blocked).toBe(false);
  });
});

describe('renderTemplate', () => {
  it('substitutes known vars and dashes unknown ones', () => {
    expect(renderTemplate('Hi {{name}} on {{project.code}}', { name: 'Sam', project: { code: 'P1' } }))
      .toBe('Hi Sam on P1');
    expect(renderTemplate('Ref {{missing}}', {})).toBe('Ref —');
  });
});

describe('computeSlaDueAt', () => {
  it('returns null for non-positive hours', () => {
    expect(computeSlaDueAt(0)).toBeNull();
    expect(computeSlaDueAt(null)).toBeNull();
  });

  it('returns a future ISO timestamp for positive hours', () => {
    const due = computeSlaDueAt(24);
    expect(due).not.toBeNull();
    expect(new Date(due as string).getTime()).toBeGreaterThan(Date.now());
  });
});
