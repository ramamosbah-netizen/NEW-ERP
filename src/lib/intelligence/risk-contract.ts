// ============================================================
// AURA 0.2 — Risk Contract Layer (V1)
// The SINGLE orchestration boundary for the risk-alert lifecycle.
//
// Direction of control:   engine → alerts → (THIS contract) → UI / API
// Everything that MUTATES an alert's state MUST go through the command
// interface below (ackAlert / resolveAlert / dismissAlert). UI and API never
// touch alert state directly and never re-implement transition rules.
//
// Design: a PURE state machine (no I/O) + a thin command layer that persists
// through an injected RiskAlertStore port. The contract has ZERO infrastructure
// coupling (no Supabase import) — it is unit-testable and stable, so the later
// AI layers (Hermes / Memory) build on a fixed contract, not on scattered
// mutation sites.
//
// Status: ADDITIVE — added BEFORE Batch 2, NOT yet wired. Batch 2 supplies the
// RiskAlertStore adapter and points AlertActions + /api/intelligence/alert here.
// SUPERSEDES the inline state machine in intelligence-service.ts (transitionAlert).
// NOTE: this is STRICTER — RESOLVED is reachable only via ACKNOWLEDGED
// (no direct OPEN → RESOLVED). The frozen transitionAlert allowed it; the
// contract is now the source of truth, so that looser path is dropped.
// ============================================================

import type { RiskStatus, RiskAction } from '@/types/intelligence.types';

// ---- State machine (canonical, pure) --------------------------------------

/** An alert enters the machine here when the engine first persists it. */
export const INITIAL_STATE: RiskStatus = 'OPEN';

/** from-state → states it may move to. Terminal states map to []. */
export const ALLOWED_TRANSITIONS: Record<RiskStatus, RiskStatus[]> = {
  OPEN:         ['ACKNOWLEDGED', 'DISMISSED'],
  ACKNOWLEDGED: ['RESOLVED', 'DISMISSED'],
  RESOLVED:     [],
  DISMISSED:    [],
};

const ACTION_TARGET: Record<RiskAction, RiskStatus> = {
  acknowledge: 'ACKNOWLEDGED',
  resolve:     'RESOLVED',
  dismiss:     'DISMISSED',
};

export function nextStatus(action: RiskAction): RiskStatus {
  return ACTION_TARGET[action];
}

export function canTransition(from: RiskStatus, to: RiskStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminal(status: RiskStatus): boolean {
  return (ALLOWED_TRANSITIONS[status]?.length ?? 0) === 0;
}

/** Actions legal from `status` — UI affordances DERIVE from this (single source of truth). */
export function allowedActions(status: RiskStatus): RiskAction[] {
  return (Object.keys(ACTION_TARGET) as RiskAction[]).filter((a) => canTransition(status, ACTION_TARGET[a]));
}

// ---- Transition planning (pure) -------------------------------------------

export interface TransitionContext {
  actorId: string | null;
  note?: string;
  /** ISO timestamp; injected for determinism. Defaults at the command boundary. */
  now?: string;
}

/** The exact column set a transition writes — computed here, applied by the store. */
export interface AlertPatch {
  status: RiskStatus;
  status_changed_by: string | null;
  updated_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  resolution_note?: string;
}

export type TransitionPlan =
  | { ok: true; from: RiskStatus; to: RiskStatus; patch: AlertPatch }
  | { ok: false; from: RiskStatus; error: string };

/** Validate against the state machine + compute the patch. No I/O. */
export function planTransition(from: RiskStatus, action: RiskAction, ctx: TransitionContext): TransitionPlan {
  const to = ACTION_TARGET[action];
  if (!canTransition(from, to)) {
    return { ok: false, from, error: `Illegal transition: ${from} --${action}--> ${to}` };
  }
  const now = ctx.now ?? new Date().toISOString();
  const patch: AlertPatch = { status: to, status_changed_by: ctx.actorId, updated_at: now };
  if (action === 'acknowledge') patch.acknowledged_at = now;
  if (action === 'resolve') { patch.resolved_at = now; if (ctx.note) patch.resolution_note = ctx.note; }
  if (action === 'dismiss' && ctx.note) patch.resolution_note = ctx.note;
  return { ok: true, from, to, patch };
}

// ---- Command interface (the ONLY mutation gateway) ------------------------

/**
 * Persistence port. Batch 2 supplies a Supabase-backed adapter; the contract
 * itself stays infrastructure-free. Company-access checks live at the API
 * boundary, NOT here — this contract governs state legality only.
 */
export interface RiskAlertStore {
  getStatus(alertId: string): Promise<RiskStatus | null>;
  applyPatch(alertId: string, patch: AlertPatch): Promise<void>;
}

export type CommandResult =
  | { ok: true; alertId: string; from: RiskStatus; to: RiskStatus }
  | { ok: false; error: string };

/** Canonical gateway: load current state → validate (state machine) → persist. */
export async function dispatchAlertCommand(
  store: RiskAlertStore,
  alertId: string,
  action: RiskAction,
  ctx: TransitionContext,
): Promise<CommandResult> {
  const from = await store.getStatus(alertId);
  if (from === null) return { ok: false, error: 'Alert not found' };
  const plan = planTransition(from, action, ctx);
  if (!plan.ok) return { ok: false, error: plan.error };
  await store.applyPatch(alertId, plan.patch);
  return { ok: true, alertId, from: plan.from, to: plan.to };
}

// Named commands — the interface UI/API must call (and nothing else).
export const ackAlert = (store: RiskAlertStore, alertId: string, ctx: TransitionContext) =>
  dispatchAlertCommand(store, alertId, 'acknowledge', ctx);

export const resolveAlert = (store: RiskAlertStore, alertId: string, ctx: TransitionContext) =>
  dispatchAlertCommand(store, alertId, 'resolve', ctx);

export const dismissAlert = (store: RiskAlertStore, alertId: string, ctx: TransitionContext) =>
  dispatchAlertCommand(store, alertId, 'dismiss', ctx);
