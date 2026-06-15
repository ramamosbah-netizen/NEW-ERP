'use client';

// ============================================================
// JEET ERP — HR: Manpower Dashboard
// Headcount & cost by assigned project, deployed vs bench.
// Read-only; plain query + batched project lookup (no migration).
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
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const N = (v: any) => Number(v || 0);
const HOURS_MONTH = 195;

export default function ManpowerPage() {
  const router = useRouter();
  const [emps, setEmps] = useState<any[]>([]);
  const [projMap, setProjMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('employees').select('id, full_name_en, department, designation, assigned_project_id, current_hourly_cost_rate, is_active, status');
        const active = (data || []).filter((e: any) => e.is_active !== false && (e.status || 'ACTIVE') !== 'EXITED');
        setEmps(active);
        const pids = [...new Set(active.map((e: any) => e.assigned_project_id).filter(Boolean))] as string[];
        if (pids.length) { const { data: ps } = await supabase.from('projects').select('id, project_number, name').in('id', pids); setProjMap(new Map((ps || []).map((p: any) => [p.id, `${p.project_number} — ${p.name}`]))); }
      } finally { setLoading(false); }
    })();
  }, []);

  const monthlyCost = (e: any) => Math.round(N(e.current_hourly_cost_rate) * HOURS_MONTH);
  const deployed = emps.filter(e => e.assigned_project_id);
  const bench = emps.filter(e => !e.assigned_project_id);
  const utilisation = emps.length ? Math.round(deployed.length / emps.length * 100) : 0;
  const benchCost = bench.reduce((s, e) => s + monthlyCost(e), 0);

  const byProject = useMemo(() => {
    const m = new Map<string, { count: number; cost: number }>();
    deployed.forEach(e => { const k = projMap.get(e.assigned_project_id)?.split(' — ')[0] || 'Project'; const o = m.get(k) || { count: 0, cost: 0 }; o.count++; o.cost += monthlyCost(e); m.set(k, o); });
    return [...m.entries()].map(([name, v]) => ({ name, count: v.count, cost: v.cost })).sort((a, b) => b.count - a.count);
  }, [deployed, projMap]);
  const split = [{ name: 'Deployed', value: deployed.length }, { name: 'Bench', value: bench.length }].filter(d => d.value > 0);

  const exportCols = ['Project', 'Headcount', 'Est. monthly cost'];
  const exportRows = byProject.map(p => [p.name, p.count, p.cost]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Manpower Dashboard"
        subtitle="Headcount and cost by assigned project — deployed vs bench"
        breadcrumbs={[{ label: 'HR', href: '/hr' }, { label: 'Manpower' }]}
        actions={emps.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Manpower by Project', columns: exportCols, rows: exportRows, fileName: 'manpower' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Manpower by Project', columns: exportCols, rows: exportRows, fileName: 'manpower' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : emps.length === 0 ? (
        <Card><EmptyState icon={HardHat} title="No workforce" description="Active employees and their project assignment appear here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Workforce</div><div className="text-2xl font-bold mt-1">{emps.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Deployed</div><div className="text-2xl font-bold mt-1" style={{ color: 'var(--status-success-text)' }}>{deployed.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">On bench</div><div className="text-2xl font-bold mt-1" style={{ color: bench.length ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{bench.length}</div><div className="text-[11px] text-[var(--text-tertiary)]">{aed(benchCost)}/mo</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Utilisation</div><div className="text-2xl font-bold mt-1" style={{ color: utilisation >= 80 ? 'var(--status-success-text)' : 'var(--status-warning-text)' }}>{utilisation}%</div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Deployed vs bench</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <PieChart><Pie data={split} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(e: any) => `${e.name}: ${e.value}`}><Cell fill="var(--status-success-text)" /><Cell fill="var(--status-warning-text)" /></Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4 lg:col-span-2">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Headcount by project</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={byProject.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-0 overflow-x-auto">
              <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Manpower by project</div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Project</th><th className="p-3 text-right">Headcount</th><th className="p-3 text-right">Est. cost/mo</th></tr></thead>
                <tbody>
                  {byProject.map((p, i) => (
                    <tr key={i} className="border-b border-[var(--border)] last:border-0">
                      <td className="p-3 font-medium text-[var(--text-primary)]">{p.name}</td>
                      <td className="p-3 text-right tabular-nums">{p.count}</td>
                      <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{aed(p.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card className="p-0 overflow-x-auto">
              <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">On bench ({bench.length})</div>
              {bench.length === 0 ? <div className="p-5 text-center text-sm text-[var(--text-tertiary)]">Everyone is deployed.</div> : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Employee</th><th className="p-3">Designation</th><th className="p-3 text-right">Cost/mo</th></tr></thead>
                  <tbody>
                    {bench.map(e => (
                      <tr key={e.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/hr/${e.id}`)}>
                        <td className="p-3 text-[var(--text-primary)]">{e.full_name_en}</td>
                        <td className="p-3 text-xs text-[var(--text-secondary)]">{e.designation || '—'}</td>
                        <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{aed(monthlyCost(e))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
