'use client';

// ============================================================
// JEET ERP — Timesheets: Utilization Analytics
// Hours & OT logged, by allocation/project/employee, approval state.
// Read-only; plain queries (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Clock, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';

const N = (v: any) => Number(v || 0);
const h = (n: number) => `${Math.round(Number(n || 0) * 10) / 10}h`;
const PIE = ['var(--accent)', 'var(--status-info-text)', 'var(--status-warning-text)', 'var(--status-success-text)', 'var(--status-danger-text)'];

interface Ts { id: string; employee_id: string; week_start: string; status: string; total_regular_hours: number; total_ot_hours: number; }
interface Te { project_id: string | null; allocation_type: string | null; hours: number; }

export default function TimesheetAnalyticsPage() {
  const [sheets, setSheets] = useState<Ts[]>([]);
  const [entries, setEntries] = useState<Te[]>([]);
  const [empMap, setEmpMap] = useState<Map<string, string>>(new Map());
  const [projMap, setProjMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [ts, te] = await Promise.all([
          supabase.from('timesheets').select('id, employee_id, week_start, status, total_regular_hours, total_ot_hours').order('week_start', { ascending: false }),
          supabase.from('timesheet_entries').select('project_id, allocation_type, hours'),
        ]);
        const tsRows = (ts.data || []) as Ts[];
        const teRows = (te.data || []) as Te[];
        setSheets(tsRows); setEntries(teRows);
        const eids = [...new Set(tsRows.map(r => r.employee_id).filter(Boolean))] as string[];
        const pids = [...new Set(teRows.map(r => r.project_id).filter(Boolean))] as string[];
        const [em, pj] = await Promise.all([
          eids.length ? supabase.from('employees').select('id, full_name_en').in('id', eids) : Promise.resolve({ data: [] as any[] }),
          pids.length ? supabase.from('projects').select('id, project_number').in('id', pids) : Promise.resolve({ data: [] as any[] }),
        ]);
        setEmpMap(new Map((em.data || []).map((e: any) => [e.id, e.full_name_en])));
        setProjMap(new Map((pj.data || []).map((p: any) => [p.id, p.project_number])));
      } finally { setLoading(false); }
    })();
  }, []);

  const regular = sheets.reduce((s, t) => s + N(t.total_regular_hours), 0);
  const ot = sheets.reduce((s, t) => s + N(t.total_ot_hours), 0);
  const totalHours = regular + ot;
  const otPct = totalHours ? Math.round(ot / totalHours * 100) : 0;
  const pending = sheets.filter(t => t.status === 'SUBMITTED').length;

  const trend = useMemo(() => [...sheets].sort((a, b) => (a.week_start || '').localeCompare(b.week_start || '')).slice(-8).reduce((acc: any[], t) => {
    const k = (t.week_start || '').slice(5);
    let row = acc.find(r => r.week === k); if (!row) { row = { week: k, Regular: 0, OT: 0 }; acc.push(row); }
    row.Regular += N(t.total_regular_hours); row.OT += N(t.total_ot_hours); return acc;
  }, []), [sheets]);

  const byAllocation = useMemo(() => { const m = new Map<string, number>(); entries.forEach(e => m.set(e.allocation_type || 'Unspecified', (m.get(e.allocation_type || 'Unspecified') || 0) + N(e.hours))); return [...m.entries()].map(([name, value]) => ({ name, value: Math.round(value) })).filter(d => d.value > 0); }, [entries]);
  const byProject = useMemo(() => { const m = new Map<string, number>(); entries.forEach(e => { if (!e.project_id) return; const k = projMap.get(e.project_id) || 'Project'; m.set(k, (m.get(k) || 0) + N(e.hours)); }); return [...m.entries()].map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value).slice(0, 8); }, [entries, projMap]);
  const byEmployee = useMemo(() => { const m = new Map<string, number>(); sheets.forEach(t => { const k = empMap.get(t.employee_id) || '—'; m.set(k, (m.get(k) || 0) + N(t.total_regular_hours) + N(t.total_ot_hours)); }); return [...m.entries()].map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value).slice(0, 8); }, [sheets, empMap]);

  const exportCols = ['Employee', 'Week', 'Status', 'Regular', 'OT', 'Total'];
  const exportRows = sheets.map(t => [empMap.get(t.employee_id) || '', t.week_start, t.status, N(t.total_regular_hours), N(t.total_ot_hours), N(t.total_regular_hours) + N(t.total_ot_hours)]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Timesheet & Utilization"
        subtitle="Hours and overtime logged, by allocation, project and employee"
        breadcrumbs={[{ label: 'Timesheets', href: '/timesheets' }, { label: 'Analytics' }]}
        actions={sheets.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Timesheet Utilization', columns: exportCols, rows: exportRows, fileName: 'timesheet-utilization' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Timesheet Utilization', columns: exportCols, rows: exportRows, fileName: 'timesheet-utilization' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : sheets.length === 0 ? (
        <Card><EmptyState icon={Clock} title="No timesheets" description="Weekly timesheets will be analysed here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total hours</div><div className="text-2xl font-bold mt-1">{h(totalHours)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Overtime</div><div className="text-2xl font-bold mt-1">{h(ot)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">OT %</div><div className="text-2xl font-bold mt-1" style={{ color: otPct > 20 ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{otPct}%</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Pending approval</div><div className="text-2xl font-bold mt-1" style={{ color: pending ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{pending}</div></Card>
          </div>

          <Card className="p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Hours by week (regular vs OT)</div>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                  <Tooltip /><Legend />
                  <Bar dataKey="Regular" stackId="a" fill="var(--accent)" />
                  <Bar dataKey="OT" stackId="a" fill="var(--status-warning-text)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By allocation</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  {byAllocation.length ? <PieChart><Pie data={byAllocation} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => e.name}>{byAllocation.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip formatter={(v: any) => h(v)} /></PieChart> : <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">No entries</div>}
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Hours by project</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={byProject} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <Tooltip formatter={(v: any) => h(v)} />
                    <Bar dataKey="value" fill="var(--status-info-text)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Hours by employee</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={byEmployee} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} />
                    <Tooltip formatter={(v: any) => h(v)} />
                    <Bar dataKey="value" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
