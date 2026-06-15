'use client';

// ============================================================
// JEET ERP — Workspace: Team Workload
// Open task load, overdue and priority mix per assignee.
// Read-only; plain query + batched profile lookup (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Users, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

const OPEN = ['TODO', 'IN_PROGRESS', 'BLOCKED'];

interface Tk { assignee_id: string | null; status: string; priority: string; due_date: string | null; }
interface Row { id: string; name: string; open: number; inProgress: number; blocked: number; overdue: number; urgent: number; }

export default function TeamWorkloadPage() {
  const [tasks, setTasks] = useState<Tk[]>([]);
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('tasks').select('assignee_id, status, priority, due_date').eq('is_active', true);
        const rows = (data || []) as Tk[];
        setTasks(rows);
        const ids = [...new Set(rows.map(r => r.assignee_id).filter(Boolean))] as string[];
        if (ids.length) { const { data: p } = await supabase.from('profiles').select('id, full_name').in('id', ids); setNameMap(new Map((p || []).map((x: any) => [x.id, x.full_name]))); }
      } finally { setLoading(false); }
    })();
  }, []);

  const now = Date.now();
  const rows = useMemo<Row[]>(() => {
    const m = new Map<string, Row>();
    tasks.forEach(t => {
      if (!t.assignee_id || !OPEN.includes(t.status)) return;
      if (!m.has(t.assignee_id)) m.set(t.assignee_id, { id: t.assignee_id, name: nameMap.get(t.assignee_id) || 'Unknown', open: 0, inProgress: 0, blocked: 0, overdue: 0, urgent: 0 });
      const r = m.get(t.assignee_id)!;
      r.open++;
      if (t.status === 'IN_PROGRESS') r.inProgress++;
      if (t.status === 'BLOCKED') r.blocked++;
      if (t.due_date && new Date(t.due_date).getTime() < now) r.overdue++;
      if (t.priority === 'URGENT' || t.priority === 'HIGH') r.urgent++;
    });
    return [...m.values()].sort((a, b) => b.open - a.open);
  }, [tasks, nameMap]);

  const unassigned = tasks.filter(t => !t.assignee_id && OPEN.includes(t.status)).length;
  const totalOpen = rows.reduce((s, r) => s + r.open, 0);
  const avgLoad = rows.length ? Math.round(totalOpen / rows.length * 10) / 10 : 0;

  const chart = rows.slice(0, 10).map(r => ({ name: r.name.split(' ')[0], 'In progress': r.inProgress, Blocked: r.blocked, Other: r.open - r.inProgress - r.blocked }));

  const exportCols = ['Assignee', 'Open', 'In progress', 'Blocked', 'Overdue', 'High/Urgent'];
  const exportRows = rows.map(r => [r.name, r.open, r.inProgress, r.blocked, r.overdue, r.urgent]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Team Workload"
        subtitle="Open task load, overdue and priority mix per assignee"
        breadcrumbs={[{ label: 'Tasks', href: '/tasks' }, { label: 'Team Workload' }]}
        actions={rows.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Team Workload', columns: exportCols, rows: exportRows, fileName: 'team-workload' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Team Workload', columns: exportCols, rows: exportRows, fileName: 'team-workload' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={Users} title="No assigned tasks" description="Open tasks assigned to team members appear here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Team members loaded</div><div className="text-2xl font-bold mt-1">{rows.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Open tasks</div><div className="text-2xl font-bold mt-1">{totalOpen}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Avg load</div><div className="text-2xl font-bold mt-1">{avgLoad}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Unassigned open</div><div className="text-2xl font-bold mt-1" style={{ color: unassigned ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{unassigned}</div></Card>
          </div>

          <Card className="p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Open workload by assignee</div>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                  <Tooltip /><Legend />
                  <Bar dataKey="In progress" stackId="a" fill="var(--accent)" />
                  <Bar dataKey="Blocked" stackId="a" fill="var(--status-danger-text)" />
                  <Bar dataKey="Other" stackId="a" fill="var(--status-info-text)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Assignee</th><th className="p-3 text-right">Open</th><th className="p-3 text-right">In progress</th><th className="p-3 text-right">Blocked</th><th className="p-3 text-right">Overdue</th><th className="p-3 text-right">High/Urgent</th>
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3 font-medium text-[var(--text-primary)]">{r.name}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{r.open}</td>
                    <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{r.inProgress}</td>
                    <td className="p-3 text-right tabular-nums" style={{ color: r.blocked ? 'var(--status-danger-text)' : 'var(--text-tertiary)' }}>{r.blocked || '—'}</td>
                    <td className="p-3 text-right tabular-nums" style={{ color: r.overdue ? 'var(--status-danger-text)' : 'var(--text-tertiary)' }}>{r.overdue || '—'}</td>
                    <td className="p-3 text-right tabular-nums" style={{ color: r.urgent ? 'var(--status-warning-text)' : 'var(--text-tertiary)' }}>{r.urgent || '—'}</td>
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
