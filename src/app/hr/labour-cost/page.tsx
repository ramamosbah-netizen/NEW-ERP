'use client';

// ============================================================
// JEET ERP — HR: Project Labour Cost
// Labour cost charged to projects (from project_labour_costs).
// Read-only; plain query + batched lookups (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { HardHat, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from 'recharts';

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const N = (v: any) => Number(v || 0);
const dateOf = (r: any) => r.period_month || r.entry_date || r.work_date || r.date || r.created_at || null;
const hoursOf = (r: any) => N(r.hours ?? r.total_hours ?? r.qty);

export default function LabourCostPage() {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [projMap, setProjMap] = useState<Map<string, string>>(new Map());
  const [empMap, setEmpMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('project_labour_costs').select('*');
        const list = (data || []) as any[];
        setRows(list);
        const pids = [...new Set(list.map(r => r.project_id).filter(Boolean))] as string[];
        const eids = [...new Set(list.map(r => r.employee_id).filter(Boolean))] as string[];
        const [pj, em] = await Promise.all([
          pids.length ? supabase.from('projects').select('id, project_number, name').in('id', pids) : Promise.resolve({ data: [] as any[] }),
          eids.length ? supabase.from('employees').select('id, full_name_en').in('id', eids) : Promise.resolve({ data: [] as any[] }),
        ]);
        setProjMap(new Map((pj.data || []).map((p: any) => [p.id, `${p.project_number} — ${p.name}`])));
        setEmpMap(new Map((em.data || []).map((e: any) => [e.id, e.full_name_en])));
      } finally { setLoading(false); }
    })();
  }, []);

  const totalCost = rows.reduce((s, r) => s + N(r.cost_amount), 0);
  const totalHours = rows.reduce((s, r) => s + hoursOf(r), 0);
  const projectsCharged = new Set(rows.map(r => r.project_id).filter(Boolean)).size;
  const employeesCharged = new Set(rows.map(r => r.employee_id).filter(Boolean)).size;

  const byProject = useMemo(() => {
    const m = new Map<string, { cost: number; hours: number }>();
    rows.forEach(r => { const k = r.project_id ? (projMap.get(r.project_id)?.split(' — ')[0] || 'Project') : 'Unassigned'; const e = m.get(k) || { cost: 0, hours: 0 }; e.cost += N(r.cost_amount); e.hours += hoursOf(r); m.set(k, e); });
    return [...m.entries()].map(([name, v]) => ({ name, cost: Math.round(v.cost), hours: Math.round(v.hours) })).sort((a, b) => b.cost - a.cost);
  }, [rows, projMap]);
  const byEmployee = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach(r => { if (!r.employee_id) return; const k = empMap.get(r.employee_id) || '—'; m.set(k, (m.get(k) || 0) + N(r.cost_amount)); });
    return [...m.entries()].map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [rows, empMap]);
  const trend = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach(r => { const d = dateOf(r); if (!d) return; const k = String(d).slice(0, 7); m.set(k, (m.get(k) || 0) + N(r.cost_amount)); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([k, v]) => ({ month: k.slice(2), value: Math.round(v) }));
  }, [rows]);

  const exportCols = ['Project', 'Hours', 'Cost'];
  const exportRows = byProject.map(p => [p.name, p.hours, p.cost]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Project Labour Cost"
        subtitle="Labour cost charged to projects from approved timesheets"
        breadcrumbs={[{ label: 'HR', href: '/hr' }, { label: 'Labour Cost' }]}
        actions={rows.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Project Labour Cost', columns: exportCols, rows: exportRows, fileName: 'project-labour-cost' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Project Labour Cost', columns: exportCols, rows: exportRows, fileName: 'project-labour-cost' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={HardHat} title="No labour cost yet" description="Approved timesheet hours costed to projects appear here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total labour cost</div><div className="text-xl font-bold mt-1">{aed(totalCost)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total hours</div><div className="text-2xl font-bold mt-1">{Math.round(totalHours)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Projects charged</div><div className="text-2xl font-bold mt-1">{projectsCharged}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Employees charged</div><div className="text-2xl font-bold mt-1">{employeesCharged}</div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Labour cost by project</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={byProject.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <Tooltip formatter={(v: any) => aed(v)} />
                    <Bar dataKey="cost" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Labour cost trend</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  {trend.length ? (
                    <LineChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: any) => aed(v)} />
                      <Line dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  ) : <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">No dated entries</div>}
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-0 overflow-x-auto">
            <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Labour cost by project</div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Project</th><th className="p-3 text-right">Hours</th><th className="p-3 text-right">Cost</th></tr></thead>
              <tbody>
                {byProject.map((p, i) => (
                  <tr key={i} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3 font-medium text-[var(--text-primary)]">{p.name}</td>
                    <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{p.hours || '—'}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{aed(p.cost)}</td>
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
