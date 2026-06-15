'use client';

// ============================================================
// JEET ERP — Workspace: Task Analytics
// Tasks by status/priority/origin, overdue, completion and
// throughput. Read-only; plain query (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { CheckSquare, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';

const OPEN = ['TODO', 'IN_PROGRESS', 'BLOCKED'];
const DONE = ['DONE', 'DONE_AUTO'];
const PRIORITIES = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];
const PIE = ['var(--status-danger-text)', 'var(--status-warning-text)', 'var(--status-info-text)', 'var(--accent)', 'var(--status-success-text)', '#8b5cf6'];

interface Tk { status: string; priority: string; origin: string; due_date: string | null; completed_at: string | null; created_at: string; assignee_id: string | null; }

export default function TaskAnalyticsPage() {
  const [allTasks, setAllTasks] = useState<Tk[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [scope, setScope] = useState<'mine' | 'all'>('mine');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
    supabase.from('tasks').select('status, priority, origin, due_date, completed_at, created_at, assignee_id').eq('is_active', true)
      .then(({ data }) => setAllTasks((data || []) as Tk[])).then(() => setLoading(false), () => setLoading(false));
  }, []);

  const tasks = useMemo(() => scope === 'mine' && userId ? allTasks.filter(t => t.assignee_id === userId) : allTasks, [allTasks, scope, userId]);
  const now = Date.now();
  const open = tasks.filter(t => OPEN.includes(t.status));
  const done = tasks.filter(t => DONE.includes(t.status));
  const overdue = open.filter(t => t.due_date && new Date(t.due_date).getTime() < now);
  const blocked = tasks.filter(t => t.status === 'BLOCKED');
  const completionRate = tasks.length ? Math.round(done.length / Math.max(1, tasks.filter(t => t.status !== 'CANCELLED').length) * 100) : 0;

  const byStatus = useMemo(() => [...new Set(tasks.map(t => t.status))].map(s => ({ name: s.replace(/_/g, ' '), value: tasks.filter(t => t.status === s).length })), [tasks]);
  const byPriority = useMemo(() => PRIORITIES.map(p => ({ name: p, value: open.filter(t => t.priority === p).length })).filter(d => d.value > 0), [open]);
  const byOrigin = useMemo(() => [...new Set(tasks.map(t => t.origin))].map(o => ({ name: o.replace(/_/g, ' '), value: tasks.filter(t => t.origin === o).length })).filter(d => d.value > 0), [tasks]);
  const throughput = useMemo(() => {
    const m = new Map<string, { created: number; done: number }>();
    tasks.forEach(t => { if (t.created_at) { const k = t.created_at.slice(0, 7); const e = m.get(k) || { created: 0, done: 0 }; e.created++; m.set(k, e); } if (t.completed_at) { const k = t.completed_at.slice(0, 7); const e = m.get(k) || { created: 0, done: 0 }; e.done++; m.set(k, e); } });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([k, v]) => ({ month: k.slice(2), Created: v.created, Done: v.done }));
  }, [tasks]);

  const exportCols = ['Status', 'Count'];
  const exportRows = byStatus.map(s => [s.name, s.value]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Task Analytics"
        subtitle="Tasks by status, priority and origin with throughput and overdue"
        breadcrumbs={[{ label: 'Tasks', href: '/tasks' }, { label: 'Analytics' }]}
        actions={tasks.length > 0 ? (
          <div className="flex gap-2">
            <button
              onClick={() => exportTablePdf({ title: 'Task Analytics', columns: exportCols, rows: exportRows, fileName: 'task-analytics' })}
              className="quote-btn quote-btn-secondary text-xs flex items-center gap-1.5"
            >
              <FileDown size={14} />
              PDF
            </button>
            <button
              onClick={() => exportTableExcel({ title: 'Task Analytics', columns: exportCols, rows: exportRows, fileName: 'task-analytics' })}
              className="quote-btn quote-btn-secondary text-xs flex items-center gap-1.5"
            >
              <Sheet size={14} />
              Excel
            </button>
          </div>
        ) : undefined}
      />

      <div className="quote-card flex items-center gap-3 py-3 px-4">
        <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Scope view:</span>
        <div className="flex bg-[var(--bg-card)] border border-[var(--border-color)] p-0.5 rounded-lg">
          {(['mine', 'all'] as const).map(s => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                scope === s
                  ? 'bg-[var(--accent)] text-[var(--bg-card)] font-bold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {s === 'mine' ? 'My tasks' : 'Everyone'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : tasks.length === 0 ? (
        <Card><EmptyState icon={CheckSquare} title="No tasks" description={scope === 'mine' ? 'You have no tasks.' : 'Tasks will be analysed here.'} /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total</div><div className="text-2xl font-bold mt-1">{tasks.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Open</div><div className="text-2xl font-bold mt-1">{open.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Overdue</div><div className="text-2xl font-bold mt-1" style={{ color: overdue.length ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{overdue.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Blocked</div><div className="text-2xl font-bold mt-1" style={{ color: blocked.length ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{blocked.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Completion</div><div className="text-2xl font-bold mt-1" style={{ color: completionRate >= 70 ? 'var(--status-success-text)' : 'var(--status-warning-text)' }}>{completionRate}%</div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By status</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <PieChart><Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(e: any) => e.name}>{byStatus.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Open by priority</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={byPriority}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>{byPriority.map((p, i) => <Cell key={i} fill={p.name === 'URGENT' ? 'var(--status-danger-text)' : p.name === 'HIGH' ? 'var(--status-warning-text)' : 'var(--accent)'} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By origin</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={byOrigin} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="var(--status-info-text)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Throughput (created vs done)</div>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={throughput}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                  <Tooltip /><Legend />
                  <Bar dataKey="Created" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Done" fill="var(--status-success-text)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
