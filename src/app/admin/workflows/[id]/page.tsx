'use client';

// ============================================================
// JEET ERP — Visual Workflow Designer
// Status pipeline graph + status editor + transition editor
// with approval matrix, notifications, conditions, SLA and
// escalation — all persisted live.
// ============================================================

import React, { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import workflowService from '@/services/workflowService';
import userRoleService from '@/services/userRoleService';
import type {
  WorkflowWithGraph, WorkflowStatus, WorkflowTransition,
  StatusColor, ApprovalMode, RuleCondition,
} from '@/types/platform.types';
import type { Role } from '@/types/rbac.types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Plus, Trash2, X, Power, ArrowRight, Flag, FlagOff, Save } from 'lucide-react';

const STATUS_COLORS: { value: StatusColor; label: string }[] = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'info', label: 'Info (blue)' },
  { value: 'warning', label: 'Warning (amber)' },
  { value: 'success', label: 'Success (green)' },
  { value: 'danger', label: 'Danger (red)' },
];

const COLOR_VAR: Record<StatusColor, { bg: string; text: string; border: string }> = {
  neutral: { bg: 'var(--status-neutral-bg)', text: 'var(--status-neutral-text)', border: 'var(--status-neutral-border)' },
  info:    { bg: 'var(--status-info-bg)',    text: 'var(--status-info-text)',    border: 'var(--status-info-border)' },
  success: { bg: 'var(--status-success-bg)', text: 'var(--status-success-text)', border: 'var(--status-success-border)' },
  warning: { bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)', border: 'var(--status-warning-border)' },
  danger:  { bg: 'var(--status-danger-bg)',  text: 'var(--status-danger-text)',  border: 'var(--status-danger-border)' },
};

const OPERATORS = ['=', '!=', '>', '>=', '<', '<=', 'contains', 'not_contains', 'in', 'not_in', 'is_empty', 'not_empty'];

export default function WorkflowDesignerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [graph, setGraph] = useState<WorkflowWithGraph | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Status modal
  const [statusModal, setStatusModal] = useState<Partial<WorkflowStatus> | null>(null);
  // Transition modal
  const [transModal, setTransModal] = useState<Partial<WorkflowTransition> | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [g, r] = await Promise.all([
        workflowService.getWorkflowGraph(id),
        userRoleService.getRoles(),
      ]);
      setGraph(g);
      setRoles(r);
    } catch (err: any) {
      setError(err.message || 'Failed to load workflow');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(null), 2500); };

  // ---------- Status CRUD ----------
  const saveStatus = async () => {
    if (!graph || !statusModal?.label) return;
    setSaving(true);
    try {
      await workflowService.upsertStatus({
        id: statusModal.id,
        workflow_id: graph.id,
        status_key: (statusModal.status_key || statusModal.label).toUpperCase().replace(/\s+/g, '_'),
        label: statusModal.label,
        color: (statusModal.color || 'neutral') as StatusColor,
        is_initial: !!statusModal.is_initial,
        is_terminal: !!statusModal.is_terminal,
        sort_order: statusModal.sort_order ?? graph.statuses.length,
      });
      setStatusModal(null);
      await load();
      flash('Status saved');
    } catch (err: any) {
      setError(err.message || 'Failed to save status');
    } finally {
      setSaving(false);
    }
  };

  const deleteStatus = async (s: WorkflowStatus) => {
    if (!window.confirm(`Delete status "${s.label}"? Transitions touching it are removed too.`)) return;
    setSaving(true);
    try {
      await workflowService.deleteStatus(s.id);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to delete status');
    } finally {
      setSaving(false);
    }
  };

  // ---------- Transition CRUD ----------
  const openNewTransition = () => {
    if (!graph || graph.statuses.length < 2) {
      setError('Add at least two statuses before creating transitions.');
      return;
    }
    setTransModal({
      workflow_id: graph.id,
      from_status_id: graph.statuses[0].id,
      to_status_id: graph.statuses[1].id,
      action_key: '',
      label: '',
      allowed_roles: [],
      approval: { mode: 'NONE', approvers: [], min_approvals: 1 },
      notifications: [],
      conditions: [],
      sla_hours: null,
      escalation: null,
      sort_order: graph.transitions.length,
    });
  };

  const saveTransition = async () => {
    if (!graph || !transModal?.label || !transModal.from_status_id || !transModal.to_status_id) return;
    setSaving(true);
    try {
      await workflowService.upsertTransition({
        id: transModal.id,
        workflow_id: graph.id,
        from_status_id: transModal.from_status_id,
        to_status_id: transModal.to_status_id,
        action_key: (transModal.action_key || transModal.label).toUpperCase().replace(/\s+/g, '_'),
        label: transModal.label,
        allowed_roles: transModal.allowed_roles || [],
        approval: transModal.approval || { mode: 'NONE', approvers: [], min_approvals: 1 },
        notifications: transModal.notifications || [],
        conditions: transModal.conditions || [],
        sla_hours: transModal.sla_hours || null,
        escalation: transModal.escalation || null,
        sort_order: transModal.sort_order ?? 0,
      });
      setTransModal(null);
      await load();
      flash('Transition saved');
    } catch (err: any) {
      setError(err.message || 'Failed to save transition');
    } finally {
      setSaving(false);
    }
  };

  const deleteTransition = async (t: WorkflowTransition) => {
    if (!window.confirm(`Delete transition "${t.label}"?`)) return;
    setSaving(true);
    try {
      await workflowService.deleteTransition(t.id);
      await load();
    } finally {
      setSaving(false);
    }
  };

  // ---------- Graph layout (auto-positioned pipeline) ----------
  const renderGraph = () => {
    if (!graph || graph.statuses.length === 0) return null;
    const statuses = [...graph.statuses].sort((a, b) => a.sort_order - b.sort_order);
    const nodeW = 150, nodeH = 44, gapX = 70, perRow = 4, gapY = 90;
    const positions = new Map<string, { x: number; y: number }>();
    statuses.forEach((s, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const x = 20 + col * (nodeW + gapX) + (row % 2 === 1 ? 30 : 0);
      const y = 20 + row * (nodeH + gapY);
      positions.set(s.id, { x, y });
    });
    const rows = Math.ceil(statuses.length / perRow);
    const width = 20 + perRow * (nodeW + gapX);
    const height = 30 + rows * (nodeH + gapY);

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 420 }}>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-muted)" />
          </marker>
        </defs>
        {/* Edges */}
        {graph.transitions.map(t => {
          const from = positions.get(t.from_status_id);
          const to = positions.get(t.to_status_id);
          if (!from || !to) return null;
          const x1 = from.x + nodeW, y1 = from.y + nodeH / 2;
          const x2 = to.x, y2 = to.y + nodeH / 2;
          const sameRow = Math.abs(y1 - y2) < 4;
          const backward = x2 < x1;
          const midX = (x1 + x2) / 2;
          const d = sameRow && !backward
            ? `M ${x1} ${y1} L ${x2 - 4} ${y2}`
            : backward
              ? `M ${from.x + nodeW / 2} ${from.y + nodeH} C ${from.x + nodeW / 2} ${from.y + nodeH + 44}, ${to.x + nodeW / 2} ${to.y + nodeH + 44}, ${to.x + nodeW / 2} ${to.y + nodeH + 4}`
              : `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2 - 4} ${y2}`;
          const labelX = backward ? (from.x + to.x + nodeW) / 2 : midX;
          const labelY = backward ? Math.max(y1, y2) + 52 : (y1 + y2) / 2 - 7;
          return (
            <g key={t.id} className="cursor-pointer" onClick={() => setTransModal({ ...t })}>
              <path d={d} fill="none" stroke="var(--text-muted)" strokeWidth="1.2" markerEnd="url(#arrow)" opacity="0.7" />
              <text x={labelX} y={labelY} textAnchor="middle" fontSize="10" fill="var(--text-secondary)" className="select-none">
                {t.label}{t.approval?.mode !== 'NONE' ? ' ✓' : ''}
              </text>
            </g>
          );
        })}
        {/* Nodes */}
        {statuses.map(s => {
          const pos = positions.get(s.id)!;
          const c = COLOR_VAR[s.color] || COLOR_VAR.neutral;
          return (
            <g key={s.id} className="cursor-pointer" onClick={() => setStatusModal({ ...s })}>
              <rect x={pos.x} y={pos.y} width={nodeW} height={nodeH} rx="8"
                fill={c.bg} stroke={c.border} strokeWidth="1.2" />
              <text x={pos.x + nodeW / 2} y={pos.y + 19} textAnchor="middle" fontSize="11.5" fontWeight="600" fill={c.text} className="select-none">
                {s.label.length > 20 ? s.label.slice(0, 19) + '…' : s.label}
              </text>
              <text x={pos.x + nodeW / 2} y={pos.y + 34} textAnchor="middle" fontSize="8.5" fill={c.text} opacity="0.7" className="select-none">
                {s.is_initial ? '● START' : s.is_terminal ? '■ END' : s.status_key}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  if (loading) {
    return <div className="py-24 flex justify-center"><div className="h-7 w-7 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] animate-spin rounded-full" /></div>;
  }
  if (!graph) {
    return <div className="py-24 text-center text-sm text-[var(--text-muted)]">{error || 'Workflow not found'}</div>;
  }

  const statusById = (sid: string) => graph.statuses.find(s => s.id === sid);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={graph.name}
        referenceId={graph.module_key}
        status={graph.is_active ? 'ACTIVE' : 'DRAFT'}
        subtitle={graph.description || 'Click a node or edge in the diagram to edit it'}
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Workflows', href: '/admin/workflows' }, { label: graph.name }]}
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={graph.is_active ? 'warning' : 'success'}
              icon={Power}
              onClick={async () => {
                if (graph.is_active) await workflowService.deactivateDefinition(graph.id);
                else await workflowService.activateDefinition(graph.id);
                await load();
              }}
            >
              {graph.is_active ? 'Deactivate' : 'Activate'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => router.push('/admin/workflows')}>Back to list</Button>
          </div>
        }
      />

      {error && (
        <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button>
        </div>
      )}
      {notice && (
        <div className="bg-[var(--status-success-bg)] border border-[var(--status-success-border)] rounded-lg p-3 text-xs text-[var(--status-success-text)]">
          {notice}
        </div>
      )}

      {/* Pipeline diagram */}
      <Card
        title="Pipeline diagram"
        subtitle="Statuses are nodes; transitions are edges (✓ marks approval-gated transitions). Click to edit."
        headerActions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" icon={Plus} onClick={() => setStatusModal({ workflow_id: graph.id, color: 'neutral' })}>Status</Button>
            <Button size="sm" variant="secondary" icon={Plus} onClick={openNewTransition}>Transition</Button>
          </div>
        }
      >
        {graph.statuses.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] py-8 text-center">No statuses yet — add the first status to begin designing the pipeline.</p>
        ) : renderGraph()}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Statuses table */}
        <Card title={`Statuses (${graph.statuses.length})`} padding={false}>
          <div className="divide-y divide-[var(--border-color)]">
            {[...graph.statuses].sort((a, b) => a.sort_order - b.sort_order).map(s => {
              const c = COLOR_VAR[s.color] || COLOR_VAR.neutral;
              return (
                <div key={s.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-[var(--bg-card-hover)]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[0.6875rem] font-medium border"
                      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}>
                      {s.label}
                    </span>
                    {s.is_initial && <Flag size={12} className="text-[var(--success)]" />}
                    {s.is_terminal && <FlagOff size={12} className="text-[var(--text-muted)]" />}
                    <span className="font-mono text-xs text-[var(--text-muted)] truncate">{s.status_key}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="muted" onClick={() => setStatusModal({ ...s })}>Edit</Button>
                    <Button size="sm" variant="muted" icon={Trash2} onClick={() => deleteStatus(s)} />
                  </div>
                </div>
              );
            })}
            {graph.statuses.length === 0 && <p className="px-4 py-6 text-xs text-[var(--text-muted)]">None yet.</p>}
          </div>
        </Card>

        {/* Transitions table */}
        <Card title={`Transitions (${graph.transitions.length})`} padding={false}>
          <div className="divide-y divide-[var(--border-color)]">
            {[...graph.transitions].sort((a, b) => a.sort_order - b.sort_order).map(t => (
              <div key={t.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-[var(--bg-card-hover)]">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-medium text-[var(--text-primary)]">{t.label}</span>
                    {t.approval?.mode !== 'NONE' && (
                      <span className="text-[0.6875rem] px-1.5 py-0.5 rounded bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border border-[var(--status-warning-border)]">
                        {t.approval.mode}
                      </span>
                    )}
                    {t.sla_hours && <span className="text-[0.6875rem] text-[var(--text-muted)]">SLA {t.sla_hours}h</span>}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] mt-0.5">
                    {statusById(t.from_status_id)?.label} <ArrowRight size={10} /> {statusById(t.to_status_id)?.label}
                    {t.allowed_roles.length > 0 && <span className="ml-1.5">· {t.allowed_roles.join(', ')}</span>}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button size="sm" variant="muted" onClick={() => setTransModal({ ...t })}>Edit</Button>
                  <Button size="sm" variant="muted" icon={Trash2} onClick={() => deleteTransition(t)} />
                </div>
              </div>
            ))}
            {graph.transitions.length === 0 && <p className="px-4 py-6 text-xs text-[var(--text-muted)]">None yet.</p>}
          </div>
        </Card>
      </div>

      {/* ---------- Status modal ---------- */}
      {statusModal && (
        <div className="quote-modal-overlay" onClick={() => setStatusModal(null)}>
          <div className="quote-modal" onClick={e => e.stopPropagation()}>
            <div className="quote-modal-header">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">{statusModal.id ? 'Edit status' : 'New status'}</h3>
              <button onClick={() => setStatusModal(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"><X size={16} /></button>
            </div>
            <div className="quote-modal-body flex flex-col gap-4">
              <div className="quote-form-grid">
                <div className="quote-form-group">
                  <label>Label</label>
                  <input className="quote-form-input" value={statusModal.label || ''} onChange={e => setStatusModal({ ...statusModal, label: e.target.value })} placeholder="e.g. Under Review" />
                </div>
                <div className="quote-form-group">
                  <label>Status key (auto if blank)</label>
                  <input className="quote-form-input font-mono" value={statusModal.status_key || ''} onChange={e => setStatusModal({ ...statusModal, status_key: e.target.value })} placeholder="UNDER_REVIEW" />
                </div>
                <div className="quote-form-group">
                  <label>Color</label>
                  <select className="quote-form-input" value={statusModal.color || 'neutral'} onChange={e => setStatusModal({ ...statusModal, color: e.target.value as StatusColor })}>
                    {STATUS_COLORS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="quote-form-group">
                  <label>Sort order</label>
                  <input type="number" className="quote-form-input" value={statusModal.sort_order ?? 0} onChange={e => setStatusModal({ ...statusModal, sort_order: Number(e.target.value) })} />
                </div>
              </div>
              <div className="flex gap-5">
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                  <input type="checkbox" checked={!!statusModal.is_initial} onChange={e => setStatusModal({ ...statusModal, is_initial: e.target.checked })} />
                  Initial status (records start here)
                </label>
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                  <input type="checkbox" checked={!!statusModal.is_terminal} onChange={e => setStatusModal({ ...statusModal, is_terminal: e.target.checked })} />
                  Terminal status (process ends)
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setStatusModal(null)}>Cancel</Button>
                <Button variant="primary" size="sm" icon={Save} isLoading={saving} onClick={saveStatus}>Save status</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Transition modal ---------- */}
      {transModal && (
        <div className="quote-modal-overlay" onClick={() => setTransModal(null)}>
          <div className="quote-modal !max-w-[760px]" onClick={e => e.stopPropagation()}>
            <div className="quote-modal-header">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">{transModal.id ? 'Edit transition' : 'New transition'}</h3>
              <button onClick={() => setTransModal(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"><X size={16} /></button>
            </div>
            <div className="quote-modal-body flex flex-col gap-5">
              {/* Basic */}
              <div className="quote-form-grid">
                <div className="quote-form-group">
                  <label>From status</label>
                  <select className="quote-form-input" value={transModal.from_status_id} onChange={e => setTransModal({ ...transModal, from_status_id: e.target.value })}>
                    {graph.statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div className="quote-form-group">
                  <label>To status</label>
                  <select className="quote-form-input" value={transModal.to_status_id} onChange={e => setTransModal({ ...transModal, to_status_id: e.target.value })}>
                    {graph.statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div className="quote-form-group">
                  <label>Button label</label>
                  <input className="quote-form-input" value={transModal.label || ''} onChange={e => setTransModal({ ...transModal, label: e.target.value })} placeholder="e.g. Submit for Approval" />
                </div>
                <div className="quote-form-group">
                  <label>SLA (hours, optional)</label>
                  <input type="number" className="quote-form-input" value={transModal.sla_hours ?? ''} onChange={e => setTransModal({ ...transModal, sla_hours: e.target.value ? Number(e.target.value) : null })} placeholder="e.g. 48" />
                </div>
              </div>

              {/* Who can execute */}
              <div className="quote-form-group">
                <label>Who can execute (empty = everyone)</label>
                <div className="flex flex-wrap gap-2">
                  {roles.map(r => {
                    const active = (transModal.allowed_roles || []).includes(r.role_key);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          const cur = transModal.allowed_roles || [];
                          setTransModal({
                            ...transModal,
                            allowed_roles: active ? cur.filter(k => k !== r.role_key) : [...cur, r.role_key],
                          });
                        }}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border cursor-pointer transition-colors ${
                          active
                            ? 'bg-[var(--primary)] text-[var(--bg-card)] border-[var(--primary)]'
                            : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--text-muted)]'
                        }`}
                      >
                        {r.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Approval matrix */}
              <div className="quote-form-group">
                <label>Approval requirement</label>
                <div className="quote-form-grid">
                  <select
                    className="quote-form-input"
                    value={transModal.approval?.mode || 'NONE'}
                    onChange={e => setTransModal({
                      ...transModal,
                      approval: { ...(transModal.approval || { approvers: [], min_approvals: 1 }), mode: e.target.value as ApprovalMode },
                    })}
                  >
                    <option value="NONE">No approval needed</option>
                    <option value="SINGLE">Single approval</option>
                    <option value="SEQUENTIAL">Sequential (all, in order)</option>
                    <option value="PARALLEL">Parallel (min N of list)</option>
                  </select>
                  {transModal.approval?.mode === 'PARALLEL' && (
                    <input
                      type="number" min={1} className="quote-form-input"
                      value={transModal.approval?.min_approvals || 1}
                      onChange={e => setTransModal({
                        ...transModal,
                        approval: { ...transModal.approval!, min_approvals: Number(e.target.value) },
                      })}
                      placeholder="Minimum approvals"
                    />
                  )}
                </div>
                {transModal.approval && transModal.approval.mode !== 'NONE' && (
                  <div className="flex flex-col gap-2 mt-2 bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-lg p-3">
                    <span className="text-xs text-[var(--text-muted)]">Approvers (by role):</span>
                    <div className="flex flex-wrap gap-2">
                      {roles.map(r => {
                        const list = transModal.approval?.approvers || [];
                        const active = list.some(a => a.type === 'ROLE' && a.value === r.role_key);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setTransModal({
                              ...transModal,
                              approval: {
                                ...transModal.approval!,
                                approvers: active
                                  ? list.filter(a => !(a.type === 'ROLE' && a.value === r.role_key))
                                  : [...list, { type: 'ROLE', value: r.role_key }],
                              },
                            })}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border cursor-pointer transition-colors ${
                              active
                                ? 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]'
                                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-color)]'
                            }`}
                          >
                            {r.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Conditions */}
              <div className="quote-form-group">
                <label>Conditions (transition only shows when all pass)</label>
                <div className="flex flex-col gap-2">
                  {(transModal.conditions || []).map((c, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input className="quote-form-input flex-1" placeholder="field e.g. total" value={c.field}
                        onChange={e => {
                          const conds = [...(transModal.conditions || [])];
                          conds[idx] = { ...c, field: e.target.value };
                          setTransModal({ ...transModal, conditions: conds });
                        }} />
                      <select className="quote-form-input w-32" value={c.operator}
                        onChange={e => {
                          const conds = [...(transModal.conditions || [])];
                          conds[idx] = { ...c, operator: e.target.value as RuleCondition['operator'] };
                          setTransModal({ ...transModal, conditions: conds });
                        }}>
                        {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
                      </select>
                      <input className="quote-form-input flex-1" placeholder="value" value={String(c.value ?? '')}
                        onChange={e => {
                          const conds = [...(transModal.conditions || [])];
                          conds[idx] = { ...c, value: e.target.value };
                          setTransModal({ ...transModal, conditions: conds });
                        }} />
                      <button type="button" className="text-[var(--text-muted)] hover:text-[var(--error)] cursor-pointer"
                        onClick={() => setTransModal({ ...transModal, conditions: (transModal.conditions || []).filter((_, i) => i !== idx) })}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <Button size="sm" variant="secondary" icon={Plus}
                    onClick={() => setTransModal({ ...transModal, conditions: [...(transModal.conditions || []), { field: '', operator: '=', value: '' }] })}>
                    Add condition
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-[var(--border-color)] pt-4">
                <Button variant="secondary" size="sm" onClick={() => setTransModal(null)}>Cancel</Button>
                <Button variant="primary" size="sm" icon={Save} isLoading={saving} onClick={saveTransition}>Save transition</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
