'use client';

// ============================================================
// JEET ERP — Projects: Schedule / Gantt (over the WBS)
// Visual timeline of WBS work packages by planned dates + progress.
// Reuses project_wbs (no migration).
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import wbsService, { WbsNode } from '@/services/wbsService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { GanttChartSquare } from 'lucide-react';

const DAY = 86400000;
const fmtMonth = (d: Date) => d.toLocaleDateString('en-AE', { month: 'short', year: '2-digit' });

export default function ProjectSchedulePage() {
  const [projects, setProjects] = useState<{ id: string; label: string }[]>([]);
  const [projectId, setProjectId] = useState('');
  const [nodes, setNodes] = useState<WbsNode[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('projects').select('id, project_number, name').order('project_number', { ascending: false })
      .then(({ data }) => setProjects((data || []).map((p: any) => ({ id: p.id, label: `${p.project_number} — ${p.name}` }))));
  }, []);

  const load = useCallback(async () => {
    if (!projectId) { setNodes([]); return; }
    setLoading(true);
    try { setNodes(await wbsService.listFlat(projectId)); } finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const scheduled = nodes.filter(n => n.planned_start && n.planned_end);
  const unscheduled = nodes.filter(n => !(n.planned_start && n.planned_end));

  // Timeline bounds
  const starts = scheduled.map(n => new Date(n.planned_start!).getTime());
  const ends = scheduled.map(n => new Date(n.planned_end!).getTime());
  const min = starts.length ? Math.min(...starts) : Date.now();
  const max = ends.length ? Math.max(...ends) : Date.now() + 30 * DAY;
  const span = Math.max(DAY, max - min);
  const todayPct = ((Date.now() - min) / span) * 100;

  // Month gridlines
  const months: { label: string; leftPct: number }[] = [];
  const cur = new Date(min); cur.setDate(1);
  while (cur.getTime() <= max) {
    months.push({ label: fmtMonth(cur), leftPct: ((cur.getTime() - min) / span) * 100 });
    cur.setMonth(cur.getMonth() + 1);
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Project Schedule (Gantt)"
        subtitle="Timeline of WBS work packages by planned dates and progress"
        breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'Schedule' }]}
      />

      <Card className="p-4">
        <label className="text-xs font-medium text-[var(--text-secondary)]">Project</label>
        <select value={projectId} onChange={e => setProjectId(e.target.value)} className="w-full md:max-w-md mt-1 px-3 h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
          <option value="">Select a project…</option>{projects.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <p className="text-[11px] text-[var(--text-tertiary)] mt-2">Dates &amp; progress come from the <strong>WBS</strong> — set them on the WBS page.</p>
      </Card>

      {!projectId ? (
        <Card><EmptyState icon={GanttChartSquare} title="Select a project" description="Choose a project to see its schedule." /></Card>
      ) : loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : scheduled.length === 0 ? (
        <Card><EmptyState icon={GanttChartSquare} title="Nothing scheduled" description="Add planned start/end dates to WBS work packages to see the Gantt." /></Card>
      ) : (
        <Card className="p-4 overflow-x-auto">
          <div className="min-w-[760px]">
            {/* Month header */}
            <div className="flex">
              <div className="w-56 shrink-0" />
              <div className="relative flex-1 h-6 border-b border-[var(--border)]">
                {months.map((m, i) => (
                  <div key={i} className="absolute top-0 h-6 text-[10px] text-[var(--text-tertiary)] border-l border-[var(--border)] pl-1" style={{ left: `${m.leftPct}%` }}>{m.label}</div>
                ))}
                {todayPct >= 0 && todayPct <= 100 && (
                  <div className="absolute top-0 bottom-0 w-px bg-[var(--status-danger-text)]" style={{ left: `${todayPct}%` }} title="Today" />
                )}
              </div>
            </div>

            {/* Rows */}
            {scheduled.map(n => {
              const s = new Date(n.planned_start!).getTime();
              const e = new Date(n.planned_end!).getTime();
              const leftPct = ((s - min) / span) * 100;
              const widthPct = Math.max(1.5, ((e - s) / span) * 100);
              const overdue = e < Date.now() && n.progress_pct < 100;
              return (
                <div key={n.id} className="flex items-center h-8 border-b border-[var(--border)] last:border-0">
                  <div className="w-56 shrink-0 pr-2 truncate text-xs" style={{ paddingLeft: `${n.level * 12}px` }}>
                    <span className={n.level === 0 ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}>{n.name}</span>
                  </div>
                  <div className="relative flex-1 h-8">
                    {/* month gridlines */}
                    {months.map((m, i) => <div key={i} className="absolute top-0 bottom-0 w-px bg-[var(--border)] opacity-40" style={{ left: `${m.leftPct}%` }} />)}
                    {todayPct >= 0 && todayPct <= 100 && <div className="absolute top-0 bottom-0 w-px bg-[var(--status-danger-text)] opacity-50" style={{ left: `${todayPct}%` }} />}
                    {/* bar */}
                    <div className="absolute top-1.5 h-5 rounded" style={{ left: `${leftPct}%`, width: `${widthPct}%`, background: overdue ? 'var(--status-danger-bg)' : 'var(--surface-active)', border: `1px solid ${overdue ? 'var(--status-danger-border)' : 'var(--border)'}` }}>
                      <div className="h-full rounded-l" style={{ width: `${Math.min(100, n.progress_pct)}%`, background: n.progress_pct >= 100 ? 'var(--status-success-text)' : 'var(--accent)', opacity: 0.85 }} />
                      <span className="absolute inset-0 flex items-center justify-end pr-1 text-[9px] text-[var(--text-secondary)] tabular-nums">{Math.round(n.progress_pct)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-3 text-[10px] text-[var(--text-tertiary)]">
            <span className="inline-flex items-center gap-1"><span className="w-3 h-2 rounded" style={{ background: 'var(--accent)' }} /> progress</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-2 rounded" style={{ background: 'var(--status-success-text)' }} /> complete</span>
            <span className="inline-flex items-center gap-1"><span className="w-px h-3 bg-[var(--status-danger-text)]" /> today</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-2 rounded border border-[var(--status-danger-border)]" style={{ background: 'var(--status-danger-bg)' }} /> overdue</span>
          </div>
        </Card>
      )}

      {projectId && unscheduled.length > 0 && (
        <Card className="p-4">
          <div className="text-xs font-semibold text-[var(--text-primary)] mb-2">Unscheduled ({unscheduled.length})</div>
          <div className="flex flex-wrap gap-2">
            {unscheduled.map(n => <span key={n.id} className="text-[11px] px-2 py-1 rounded border border-[var(--border)] text-[var(--text-tertiary)]">{n.name}</span>)}
          </div>
        </Card>
      )}
    </div>
  );
}
