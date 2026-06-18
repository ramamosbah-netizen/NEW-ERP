'use client';

// ============================================================
// Aura ERP — Workflow Administration (break-glass override)
// Lists in-flight workflow instances and lets an authorised admin unstick them:
// force a status, restart, or reassign an approver. Every action requires a
// reason and is enforced + audited by the admin_workflow_override RPC.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { workflowService, type OpenWorkflowInstance } from '@/services/workflowService';
import type { WorkflowStatus } from '@/types/platform.types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { AlertTriangle, Clock, ShieldAlert, Wrench } from 'lucide-react';

type Action = 'FORCE_STATUS' | 'RESTART' | 'REASSIGN';
const inputCls = 'w-full px-3 py-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-dark)] text-sm text-[var(--text-primary)]';

export default function WorkflowAdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<OpenWorkflowInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [target, setTarget] = useState<OpenWorkflowInstance | null>(null);
  const [statuses, setStatuses] = useState<WorkflowStatus[]>([]);
  const [action, setAction] = useState<Action>('FORCE_STATUS');
  const [reason, setReason] = useState('');
  const [toStatus, setToStatus] = useState('');
  const [oldValue, setOldValue] = useState('');
  const [napType, setNapType] = useState<'ROLE' | 'USER'>('ROLE');
  const [napValue, setNapValue] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await workflowService.getOpenInstances()); setError(null); }
    catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { (async () => { setAllowed(await workflowService.canOverride()); load(); })(); }, [load]);

  const openModal = async (inst: OpenWorkflowInstance) => {
    setTarget(inst); setAction('FORCE_STATUS'); setReason(''); setToStatus('');
    setOldValue(inst.pending[0]?.value || ''); setNapType('ROLE'); setNapValue(''); setError(null);
    try { const g = await workflowService.getWorkflowGraph(inst.workflow_id); setStatuses(g.statuses || []); }
    catch { setStatuses([]); }
  };

  const submit = async () => {
    if (!target) return;
    setBusy(true); setError(null);
    try {
      if (action === 'REASSIGN') {
        if (!oldValue || !napValue) throw new Error('Choose the approver to replace and the new approver.');
        await workflowService.overrideInstance(target.id, 'REASSIGN', reason, { oldValue, newApprover: { type: napType, value: napValue } });
      } else if (action === 'RESTART') {
        const init = statuses.find(s => s.is_initial)?.status_key || toStatus;
        if (!init) throw new Error('No initial status found for this workflow.');
        await workflowService.overrideInstance(target.id, 'RESTART', reason, { toStatus: init });
      } else {
        if (!toStatus) throw new Error('Select a target status.');
        await workflowService.overrideInstance(target.id, 'FORCE_STATUS', reason, { toStatus });
      }
      setTarget(null);
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  if (allowed === false) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Workflow Administration" breadcrumbs={[{ label: 'Administration', href: '/admin/hub' }, { label: 'Workflow Admin' }]} />
        <Card className="p-8 text-center">
          <ShieldAlert className="mx-auto mb-3 text-[var(--status-warning-text)]" size={32} />
          <div className="text-sm font-semibold text-[var(--text-primary)]">Override access required</div>
          <div className="text-xs text-[var(--text-secondary)] mt-1">You need the <code>workflow.override</code> capability to administer workflows.</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Workflow Administration"
        subtitle="Unstick in-flight workflows — force a status, restart, or reassign. Every action is reason-required and audited."
        breadcrumbs={[{ label: 'Administration', href: '/admin/hub' }, { label: 'Workflow Admin' }]}
      />

      {error && <div className="flex items-center gap-2 rounded-md border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-3 text-sm text-[var(--status-danger-text)]"><AlertTriangle size={16} /> {error}</div>}

      <Card className="p-0 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">No in-flight workflow instances.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] text-left text-xs text-[var(--text-tertiary)]">
                <th className="p-3">Module</th><th className="p-3">Entity</th><th className="p-3">Status</th>
                <th className="p-3">Pending</th><th className="p-3 text-right">Age</th><th className="p-3">SLA</th><th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-[var(--border-color)] last:border-0 hover:bg-[var(--surface-hover)]">
                  <td className="p-3"><div className="font-medium text-[var(--text-primary)]">{r.module}</div><div className="text-[10px] text-[var(--text-tertiary)]">{r.workflowName}</div></td>
                  <td className="p-3 text-xs font-mono text-[var(--text-secondary)]">{r.entity_type}/{(r.entity_id || '').slice(0, 8)}</td>
                  <td className="p-3 text-xs">{r.status_label}</td>
                  <td className="p-3 text-xs text-[var(--text-secondary)]">{r.pending.filter(p => !p.approved_by).map(p => `${p.type}:${p.value}`).join(', ') || '—'}</td>
                  <td className="p-3 text-right text-xs">{r.ageDays}d</td>
                  <td className="p-3">{r.overdue ? <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--status-danger-bg)', color: 'var(--status-danger-text)' }}><Clock size={11} />Overdue</span> : <span className="text-xs text-[var(--text-tertiary)]">{r.sla_due_at ? 'On track' : '—'}</span>}</td>
                  <td className="p-3 text-right"><Button size="sm" variant="secondary" icon={Wrench} onClick={() => openModal(r)}>Override</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        isOpen={!!target}
        onClose={() => setTarget(null)}
        title={`Override — ${target?.module} ${(target?.entity_id || '').slice(0, 8)}`}
        footer={<>
          <Button variant="secondary" onClick={() => setTarget(null)}>Cancel</Button>
          <Button disabled={busy || reason.trim().length < 3} onClick={submit}>{busy ? 'Applying…' : 'Apply override'}</Button>
        </>}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2 rounded-md border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-2.5 text-[11px] text-[var(--status-warning-text)]">
            <ShieldAlert size={14} className="mt-0.5" /> This bypasses approvals / maker-checker. It is recorded in the instance history and the audit log.
          </div>

          <label className="text-xs font-medium text-[var(--text-secondary)]">Action
            <select className={inputCls + ' mt-1'} value={action} onChange={e => setAction(e.target.value as Action)}>
              <option value="FORCE_STATUS">Force status (advance / close / cancel)</option>
              <option value="RESTART">Restart (back to initial status)</option>
              <option value="REASSIGN">Reassign pending approver</option>
            </select>
          </label>

          {action === 'FORCE_STATUS' && (
            <label className="text-xs font-medium text-[var(--text-secondary)]">Target status
              <select className={inputCls + ' mt-1'} value={toStatus} onChange={e => setToStatus(e.target.value)}>
                <option value="">Select…</option>
                {statuses.map(s => <option key={s.status_key} value={s.status_key}>{s.label}{s.is_terminal ? ' (terminal)' : ''}</option>)}
              </select>
            </label>
          )}

          {action === 'REASSIGN' && (
            <>
              <label className="text-xs font-medium text-[var(--text-secondary)]">Replace approver
                <select className={inputCls + ' mt-1'} value={oldValue} onChange={e => setOldValue(e.target.value)}>
                  <option value="">Select…</option>
                  {(target?.pending || []).filter(p => !p.approved_by).map((p, i) => <option key={i} value={p.value}>{p.type}:{p.value}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <label className="text-xs font-medium text-[var(--text-secondary)] col-span-1">Type
                  <select className={inputCls + ' mt-1'} value={napType} onChange={e => setNapType(e.target.value as 'ROLE' | 'USER')}>
                    <option value="ROLE">ROLE</option><option value="USER">USER</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-[var(--text-secondary)] col-span-2">New approver (role key or user id)
                  <input className={inputCls + ' mt-1'} value={napValue} onChange={e => setNapValue(e.target.value)} placeholder="e.g. gm" />
                </label>
              </div>
            </>
          )}

          <label className="text-xs font-medium text-[var(--text-secondary)]">Reason (required)
            <textarea className={inputCls + ' mt-1'} rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this override necessary?" />
          </label>
        </div>
      </Modal>
    </div>
  );
}
