'use client';

// ============================================================
// JEET ERP — WorkflowPanel
// Drop-in panel for any module detail page. Shows the
// configured workflow state: current status, available action
// buttons, approval progress, SLA, and history timeline.
//
//   <WorkflowPanel moduleKey="PO" entityId={po.id}
//                  context={{ total: po.total }}
//                  onStatusChange={(key) => refetchPo()} />
//
// Renders nothing when no workflow is configured for the
// module, so it is always safe to include.
// ============================================================

import React, { useState } from 'react';
import { useWorkflow } from '@/hooks/useWorkflow';
import type { StatusColor, WorkflowTransition } from '@/types/platform.types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { GitBranch, Clock, CheckCircle2, AlertTriangle, X, History } from 'lucide-react';

const COLOR_VAR: Record<StatusColor, { bg: string; text: string; border: string }> = {
  neutral: { bg: 'var(--status-neutral-bg)', text: 'var(--status-neutral-text)', border: 'var(--status-neutral-border)' },
  info:    { bg: 'var(--status-info-bg)',    text: 'var(--status-info-text)',    border: 'var(--status-info-border)' },
  success: { bg: 'var(--status-success-bg)', text: 'var(--status-success-text)', border: 'var(--status-success-border)' },
  warning: { bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)', border: 'var(--status-warning-border)' },
  danger:  { bg: 'var(--status-danger-bg)',  text: 'var(--status-danger-text)',  border: 'var(--status-danger-border)' },
};

interface WorkflowPanelProps {
  moduleKey: string;
  entityId: string | null | undefined;
  /** Record fields used by transition conditions (e.g. { total: po.total }). */
  context?: Record<string, unknown>;
  /** Called after a transition changes the status (new status_key). */
  onStatusChange?: (newStatusKey: string) => void;
  className?: string;
}

export const WorkflowPanel: React.FC<WorkflowPanelProps> = ({
  moduleKey,
  entityId,
  context = {},
  onStatusChange,
  className = '',
}) => {
  const wf = useWorkflow(moduleKey, entityId, context);
  const [confirmTransition, setConfirmTransition] = useState<WorkflowTransition | null>(null);
  const [comment, setComment] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // No workflow configured for this module → render nothing
  if (!wf.loading && !wf.configured) return null;

  const colorOf = (color: StatusColor) => COLOR_VAR[color] || COLOR_VAR.neutral;

  const runTransition = async () => {
    if (!confirmTransition) return;
    const result = await wf.execute(confirmTransition.id, comment.trim() || undefined);
    setConfirmTransition(null);
    setComment('');
    if (result?.statusChanged) {
      onStatusChange?.(result.newStatusKey);
    }
  };

  const approvedCount = wf.pendingApprovals.filter(p => p.approved_by).length;

  return (
    <Card
      title="Workflow"
      subtitle={wf.status ? undefined : 'Configured process for this document'}
      icon={GitBranch}
      className={className}
      headerActions={
        wf.history.length > 0 ? (
          <Button size="sm" variant="muted" icon={History} onClick={() => setShowHistory(s => !s)}>
            {showHistory ? 'Hide history' : `History (${wf.history.length})`}
          </Button>
        ) : undefined
      }
    >
      {wf.loading ? (
        <div className="py-6 flex justify-center">
          <div className="h-5 w-5 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] animate-spin rounded-full" />
        </div>
      ) : !wf.started ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--text-muted)]">
            This document is not tracked by the configured workflow yet.
          </p>
          <Button size="sm" variant="secondary" isLoading={wf.executing} onClick={wf.start}>
            Start workflow
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {wf.error && (
            <div className="flex items-center justify-between gap-2 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-md px-3 py-2 text-xs text-[var(--status-danger-text)]">
              <span>{wf.error}</span>
              <button onClick={() => wf.refresh()} className="cursor-pointer"><X size={12} /></button>
            </div>
          )}

          {/* Current status + SLA */}
          <div className="flex items-center gap-3 flex-wrap">
            {wf.status && (
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border"
                style={{
                  backgroundColor: colorOf(wf.status.color).bg,
                  color: colorOf(wf.status.color).text,
                  borderColor: colorOf(wf.status.color).border,
                }}
              >
                {wf.status.label}
              </span>
            )}
            {wf.slaDueAt && (
              <span className={`inline-flex items-center gap-1 text-xs ${wf.slaOverdue ? 'text-[var(--error)] font-medium' : 'text-[var(--text-muted)]'}`}>
                {wf.slaOverdue ? <AlertTriangle size={12} /> : <Clock size={12} />}
                {wf.slaOverdue ? 'SLA overdue since ' : 'SLA due '}
                {new Date(wf.slaDueAt).toLocaleString('en-AE', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            )}
          </div>

          {/* Pending approvals progress */}
          {wf.pendingApprovals.length > 0 && (
            <div className="bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] rounded-md px-3 py-2.5">
              <p className="text-xs font-medium text-[var(--status-warning-text)] mb-1.5">
                Awaiting approvals — {approvedCount}/{wf.pendingApprovals.length} recorded
              </p>
              <div className="flex flex-wrap gap-1.5">
                {wf.pendingApprovals.map((p, i) => (
                  <span key={i} className={`inline-flex items-center gap-1 text-[0.6875rem] px-2 py-0.5 rounded-md border ${
                    p.approved_by
                      ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]'
                      : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-color)]'
                  }`}>
                    {p.approved_by && <CheckCircle2 size={10} />}
                    {p.type === 'ROLE' ? `Role: ${p.value}` : p.value}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Available actions */}
          {wf.transitions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {wf.transitions.map(t => (
                <Button
                  key={t.id}
                  size="sm"
                  variant={t.action_key.includes('REJECT') || t.action_key.includes('CANCEL') ? 'danger'
                    : t.action_key.includes('APPROVE') ? 'success' : 'primary'}
                  disabled={wf.executing}
                  onClick={() => setConfirmTransition(t)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">
              No actions available to you at this stage.
            </p>
          )}

          {/* History timeline */}
          {showHistory && wf.history.length > 0 && (
            <div className="border-t border-[var(--border-color)] pt-3 flex flex-col gap-2.5 max-h-64 overflow-y-auto">
              {[...wf.history].reverse().map((h, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs">
                  <div className="h-1.5 w-1.5 rounded-full bg-[var(--text-muted)] mt-1.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[var(--text-primary)] font-medium">{h.by_name}</span>
                    <span className="text-[var(--text-secondary)]"> — {h.action.replace(/_/g, ' ').toLowerCase()}</span>
                    {h.from !== h.to && (
                      <span className="text-[var(--text-muted)]"> ({h.from || 'start'} → {h.to})</span>
                    )}
                    <span className="text-[var(--text-muted)] block mt-0.5">
                      {new Date(h.at).toLocaleString('en-AE', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                    {h.comment && (
                      <p className="text-[var(--text-secondary)] bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-md px-2 py-1 mt-1">
                        {h.comment}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirm modal */}
      {confirmTransition && (
        <div className="quote-modal-overlay" onClick={() => setConfirmTransition(null)}>
          <div className="quote-modal" onClick={e => e.stopPropagation()}>
            <div className="quote-modal-header">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">{confirmTransition.label}</h3>
              <button onClick={() => setConfirmTransition(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"><X size={16} /></button>
            </div>
            <div className="quote-modal-body flex flex-col gap-4">
              {confirmTransition.approval?.mode !== 'NONE' && (
                <p className="text-xs text-[var(--text-muted)]">
                  This action requires {confirmTransition.approval.mode === 'SINGLE' ? 'one approval' :
                    confirmTransition.approval.mode === 'SEQUENTIAL' ? 'sequential approvals from all approvers' :
                    `at least ${confirmTransition.approval.min_approvals} approval(s)`} — the status changes once the requirement is met.
                </p>
              )}
              <div className="quote-form-group">
                <label>Comment (optional)</label>
                <textarea
                  className="quote-form-textarea"
                  rows={3}
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Add a note for the audit trail…"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setConfirmTransition(null)}>Cancel</Button>
                <Button variant="primary" size="sm" isLoading={wf.executing} onClick={runTransition}>
                  Confirm — {confirmTransition.label}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default WorkflowPanel;
