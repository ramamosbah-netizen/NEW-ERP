'use client';

// ============================================================
// JEET ERP — Workflow & Approvals Analytics
// Instances by status, pending approvals, SLA breaches and cycle
// time, plus a definition inventory. Read-only; PDF + Excel export.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { GitCompare, FileDown, Sheet, Clock } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, PieChart, Pie, Legend } from 'recharts';

const PIE = ['var(--accent)', 'var(--status-info-text)', 'var(--status-success-text)', 'var(--status-warning-text)', 'var(--status-danger-text)', '#a855f7', '#64748b'];
const TERMINAL = /APPROV|CLOSE|DONE|COMPLET|REJECT|PAID|CANCEL|ARCHIV/i;
const pendingCount = (pa: any) => Array.isArray(pa) ? pa.length : pa && typeof pa === 'object' ? Object.keys(pa).length : 0;

interface Def { id: string; module_key: string; name: string; is_active: boolean; version: number; }
interface Inst { id: string; workflow_id: string; entity_type: string | null; current_status_key: string | null; pending_approvals: any; sla_due_at: string | null; created_at: string; updated_at: string; }

export default function WorkflowAnalyticsPage() {
  const [defs, setDefs] = useState<Def[]>([]);
  const [insts, setInsts] = useState<Inst[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [d, i] = await Promise.all([
          supabase.from('workflow_definitions').select('id, module_key, name, is_active, version'),
          supabase.from('workflow_instances').select('id, workflow_id, entity_type, current_status_key, pending_approvals, sla_due_at, created_at, updated_at').order('created_at', { ascending: false }),
        ]);
        setDefs((d.data || []) as Def[]);
        setInsts((i.data || []) as Inst[]);
      } finally { setLoading(false); }
    })();
  }, []);

  const defMap = useMemo(() => new Map(defs.map(d => [d.id, d])), [defs]);
  const now = Date.now();
  const open = insts.filter(i => !TERMINAL.test(i.current_status_key || ''));
  const pending = insts.filter(i => pendingCount(i.pending_approvals) > 0);
  const slaBreach = open.filter(i => i.sla_due_at && new Date(i.sla_due_at).getTime() < now);
  const completed = insts.filter(i => TERMINAL.test(i.current_status_key || ''));
  const avgCycleDays = completed.length ? (completed.reduce((a, i) => a + (new Date(i.updated_at).getTime() - new Date(i.created_at).getTime()), 0) / completed.length / 864e5).toFixed(1) : '—';

  const byStatus = useMemo(() => { const m = new Map<string, number>(); insts.forEach(i => m.set(i.current_status_key || '—', (m.get(i.current_status_key || '—') || 0) + 1)); return [...m.entries()].map(([name, value]) => ({ name: name.replace(/_/g, ' '), value })).sort((a, b) => b.value - a.value); }, [insts]);
  const byDef = useMemo(() => { const m = new Map<string, number>(); insts.forEach(i => { const n = defMap.get(i.workflow_id)?.name || '—'; m.set(n, (m.get(n) || 0) + 1); }); return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8); }, [insts, defMap]);
  const byModule = useMemo(() => { const m = new Map<string, { active: number; inactive: number }>(); defs.forEach(d => { const c = m.get(d.module_key) || { active: 0, inactive: 0 }; if (d.is_active) c.active++; else c.inactive++; m.set(d.module_key, c); }); return [...m.entries()].map(([name, v]) => ({ name, ...v })); }, [defs]);
  const instByDef = useMemo(() => { const m = new Map<string, number>(); insts.forEach(i => m.set(i.workflow_id, (m.get(i.workflow_id) || 0) + 1)); return m; }, [insts]);

  const fmt = (s: string | null) => s ? new Date(s).toLocaleString('en-AE', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  const ageDays = (s: string) => Math.floor((now - new Date(s).getTime()) / 864e5);
  const attention = [...pending, ...slaBreach.filter(b => !pending.includes(b))];

  const exportCols = ['Workflow', 'Module', 'Active', 'Version', 'Instances'];
  const exportRows = defs.map(d => [d.name, d.module_key, d.is_active ? 'Yes' : 'No', d.version, instByDef.get(d.id) || 0]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Workflow & Approvals Analytics"
        subtitle="Instances by status, pending approvals, SLA breaches and definition inventory"
        breadcrumbs={[{ label: 'Administration', href: '/admin/hub' }, { label: 'Workflows', href: '/admin/workflows' }, { label: 'Analytics' }]}
        actions={defs.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Workflow Definitions', columns: exportCols, rows: exportRows, fileName: 'workflow-definitions' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Workflow Definitions', columns: exportCols, rows: exportRows, fileName: 'workflow-definitions' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : defs.length === 0 && insts.length === 0 ? (
        <Card><EmptyState icon={GitCompare} title="No workflows" description="Workflow definitions and their running instances will be analysed here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Definitions</div><div className="text-2xl font-bold mt-1">{defs.length}</div><div className="text-[11px] text-[var(--text-tertiary)]">{defs.filter(d => d.is_active).length} active</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Instances</div><div className="text-2xl font-bold mt-1">{insts.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Open</div><div className="text-2xl font-bold mt-1">{open.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Pending approvals</div><div className="text-2xl font-bold mt-1" style={{ color: pending.length ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{pending.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">SLA breaches</div><div className="text-2xl font-bold mt-1" style={{ color: slaBreach.length ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{slaBreach.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Avg cycle</div><div className="text-2xl font-bold mt-1">{avgCycleDays}<span className="text-sm font-normal text-[var(--text-tertiary)]"> d</span></div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Instances by status</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  {insts.length ? (
                    <PieChart>
                      <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => `${e.name} (${e.value})`} labelLine={false} fontSize={10}>{byStatus.map((e, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie>
                      <Tooltip />
                    </PieChart>
                  ) : <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">No running instances</div>}
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Definitions by module (active vs inactive)</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={byModule}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="active" name="Active" stackId="a" fill="var(--status-success-text)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="inactive" name="Inactive" stackId="a" fill="var(--text-tertiary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {attention.length > 0 && (
            <Card className="p-0 overflow-x-auto">
              <div className="p-3 text-sm font-semibold border-b border-[var(--border)] flex items-center gap-2" style={{ color: 'var(--status-warning-text)' }}><Clock size={15} /> Needs action — pending or SLA breached ({attention.length})</div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Workflow</th><th className="p-3">Entity</th><th className="p-3">Status</th><th className="p-3">Pending</th><th className="p-3">SLA due</th><th className="p-3">Age</th></tr></thead>
                <tbody>
                  {attention.map(i => { const breach = i.sla_due_at && new Date(i.sla_due_at).getTime() < now; return (
                    <tr key={i.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]">
                      <td className="p-3 font-medium text-[var(--text-primary)]">{defMap.get(i.workflow_id)?.name || '—'}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{i.entity_type || '—'}</td>
                      <td className="p-3"><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-active)', color: 'var(--text-secondary)' }}>{(i.current_status_key || '—').replace(/_/g, ' ')}</span></td>
                      <td className="p-3 text-xs font-medium" style={{ color: pendingCount(i.pending_approvals) ? 'var(--status-warning-text)' : 'var(--text-tertiary)' }}>{pendingCount(i.pending_approvals) || '—'}</td>
                      <td className="p-3 text-xs" style={{ color: breach ? 'var(--status-danger-text)' : 'var(--text-secondary)' }}>{fmt(i.sla_due_at)}{breach ? ' ⚠' : ''}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{ageDays(i.created_at)}d</td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            </Card>
          )}

          <Card className="p-0 overflow-x-auto">
            <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Definition inventory ({defs.length})</div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Workflow</th><th className="p-3">Module</th><th className="p-3">Version</th><th className="p-3 text-right">Instances</th><th className="p-3">Status</th></tr></thead>
              <tbody>
                {defs.map(d => (
                  <tr key={d.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]">
                    <td className="p-3 font-medium text-[var(--text-primary)]">{d.name}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{d.module_key}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">v{d.version}</td>
                    <td className="p-3 text-right text-xs text-[var(--text-secondary)]">{instByDef.get(d.id) || 0}</td>
                    <td className="p-3"><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: d.is_active ? 'var(--status-success-bg)' : 'var(--surface-active)', color: d.is_active ? 'var(--status-success-text)' : 'var(--text-tertiary)' }}>{d.is_active ? 'Active' : 'Inactive'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
