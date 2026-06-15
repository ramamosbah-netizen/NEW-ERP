'use client';

// ============================================================
// JEET ERP — Projects: Snag Analytics & QA Dashboard
// Read-only analytics over the existing snags table (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Camera, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';

const DAY = 86400000;
const OPEN_STATES = ['OPEN', 'IN_PROGRESS', 'READY_FOR_INSPECTION', 'DISPUTED'];
const SEV_COLOR: Record<string, string> = { CRITICAL: 'var(--status-danger-text)', MAJOR: 'var(--status-warning-text)', MINOR: 'var(--status-info-text)' };
const PIE = ['var(--accent)', 'var(--status-success-text)', 'var(--status-warning-text)', 'var(--status-info-text)', 'var(--status-danger-text)', '#8b5cf6'];

interface SnagRow { id: string; snag_number: string; project_id: string; system: string; severity: string; status: string; target_date: string | null; created_at: string; updated_at: string; project_label?: string; }

export default function SnagAnalyticsPage() {
  const [projects, setProjects] = useState<{ id: string; label: string }[]>([]);
  const [projectId, setProjectId] = useState('');
  const [severity, setSeverity] = useState('');
  const [system, setSystem] = useState('');
  const [all, setAll] = useState<SnagRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('projects').select('id, project_number, name').order('project_number', { ascending: false })
      .then(({ data }) => setProjects((data || []).map((p: any) => ({ id: p.id, label: `${p.project_number} — ${p.name}` }))));
  }, []);

  useEffect(() => {
    setLoading(true);
    supabase.from('snags').select('id, snag_number, project_id, system, severity, status, target_date, created_at, updated_at')
      .order('created_at', { ascending: false })
      .then(async ({ data }) => {
        const rows = (data || []) as SnagRow[];
        const ids = [...new Set(rows.map(r => r.project_id))];
        if (ids.length) {
          const { data: ps } = await supabase.from('projects').select('id, project_number, name').in('id', ids);
          const map = new Map((ps || []).map((p: any) => [p.id, `${p.project_number} — ${p.name}`]));
          rows.forEach(r => { r.project_label = map.get(r.project_id); });
        }
        setAll(rows);
      })
      .then(() => setLoading(false), () => setLoading(false));
  }, []);

  const systems = useMemo(() => [...new Set(all.map(s => s.system).filter(Boolean))].sort(), [all]);

  const rows = useMemo(() => all.filter(s =>
    (!projectId || s.project_id === projectId) &&
    (!severity || s.severity === severity) &&
    (!system || s.system === system)
  ), [all, projectId, severity, system]);

  const isOpen = (s: SnagRow) => OPEN_STATES.includes(s.status);
  const open = rows.filter(isOpen);
  const closed = rows.filter(s => s.status === 'CLOSED');
  const criticalOpen = open.filter(s => s.severity === 'CRITICAL').length;
  const overdue = open.filter(s => s.target_date && new Date(s.target_date).getTime() < Date.now()).length;
  const closureRate = rows.length ? Math.round(closed.length / rows.length * 100) : 0;
  const avgOpenAge = open.length ? Math.round(open.reduce((s, r) => s + (Date.now() - new Date(r.created_at).getTime()) / DAY, 0) / open.length) : 0;

  const byStatus = useMemo(() => {
    const m = new Map<string, number>(); rows.forEach(r => m.set(r.status, (m.get(r.status) || 0) + 1));
    return [...m.entries()].map(([name, value]) => ({ name, value }));
  }, [rows]);
  const bySeverity = useMemo(() => ['CRITICAL', 'MAJOR', 'MINOR'].map(sv => ({ name: sv, open: open.filter(s => s.severity === sv).length, closed: closed.filter(s => s.severity === sv).length })), [open, closed]);
  const bySystem = useMemo(() => {
    const m = new Map<string, number>(); rows.forEach(r => m.set(r.system || '—', (m.get(r.system || '—') || 0) + 1));
    return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [rows]);
  const byProject = useMemo(() => {
    const m = new Map<string, number>(); open.forEach(r => { const k = r.project_label || r.project_id; m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].map(([name, count]) => ({ name: name.split(' — ')[0], count })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [open]);
  const ageing = useMemo(() => {
    const buckets = [{ name: '0–7d', count: 0 }, { name: '8–30d', count: 0 }, { name: '31–90d', count: 0 }, { name: '90d+', count: 0 }];
    open.forEach(r => { const d = (Date.now() - new Date(r.created_at).getTime()) / DAY; if (d <= 7) buckets[0].count++; else if (d <= 30) buckets[1].count++; else if (d <= 90) buckets[2].count++; else buckets[3].count++; });
    return buckets;
  }, [open]);

  const exportCols = ['Snag', 'Project', 'System', 'Severity', 'Status', 'Target', 'Age (d)'];
  const exportRows = rows.map(r => [r.snag_number, r.project_label || '', r.system, r.severity, r.status, r.target_date || '', Math.round((Date.now() - new Date(r.created_at).getTime()) / DAY)]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Snag Analytics & QA Dashboard"
        subtitle="Quality performance across the snag register"
        breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'Snag Analytics' }]}
        actions={rows.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Snag Analytics', columns: exportCols, rows: exportRows, fileName: 'snag-analytics' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Snag Analytics', columns: exportCols, rows: exportRows, fileName: 'snag-analytics' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {/* Filters */}
      <Card className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-xs text-[var(--text-secondary)]">Project
          <select value={projectId} onChange={e => setProjectId(e.target.value)} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm"><option value="">All projects</option>{projects.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
        </label>
        <label className="text-xs text-[var(--text-secondary)]">Severity
          <select value={severity} onChange={e => setSeverity(e.target.value)} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm"><option value="">All</option>{['CRITICAL', 'MAJOR', 'MINOR'].map(s => <option key={s} value={s}>{s}</option>)}</select>
        </label>
        <label className="text-xs text-[var(--text-secondary)]">System
          <select value={system} onChange={e => setSystem(e.target.value)} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm"><option value="">All</option>{systems.map(s => <option key={s} value={s}>{s}</option>)}</select>
        </label>
      </Card>

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : all.length === 0 ? (
        <Card><EmptyState icon={Camera} title="No snags" description="Snags raised on the snag list will be analysed here." /></Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total</div><div className="text-2xl font-bold mt-1">{rows.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Open</div><div className="text-2xl font-bold mt-1">{open.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Critical open</div><div className="text-2xl font-bold mt-1" style={{ color: criticalOpen ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{criticalOpen}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Overdue</div><div className="text-2xl font-bold mt-1" style={{ color: overdue ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{overdue}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Closure rate</div><div className="text-2xl font-bold mt-1" style={{ color: closureRate >= 80 ? 'var(--status-success-text)' : 'var(--text-primary)' }}>{closureRate}%</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Avg open age</div><div className="text-2xl font-bold mt-1">{avgOpenAge}<span className="text-sm font-normal text-[var(--text-tertiary)]">d</span></div></Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By status</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <PieChart><Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(e: any) => e.name}>{byStatus.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By severity (open vs closed)</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={bySeverity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} /><YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} /><Tooltip /><Legend />
                    <Bar dataKey="open" name="Open" fill="var(--status-danger-text)" radius={[4, 4, 0, 0]} /><Bar dataKey="closed" name="Closed" fill="var(--status-success-text)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By system (top 8)</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={bySystem} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} /><YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} /><Tooltip />
                    <Bar dataKey="count" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Open snag ageing</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={ageing}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} /><YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} /><Tooltip />
                    <Bar dataKey="count" name="Open snags" fill="var(--status-warning-text)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {byProject.length > 0 && (
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Open snags by project (top 8)</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={byProject}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} /><YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} /><Tooltip />
                    <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
