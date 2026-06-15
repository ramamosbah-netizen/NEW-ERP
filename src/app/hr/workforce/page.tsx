'use client';

// ============================================================
// JEET ERP — HR: Workforce Analytics
// Demographics (department / nationality / type), tenure and status.
// Read-only; plain query (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Users, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

const YEAR = 365 * 86400000;
const PIE = ['var(--accent)', 'var(--status-info-text)', 'var(--status-warning-text)', 'var(--status-success-text)', 'var(--status-danger-text)', '#8b5cf6'];

export default function WorkforceAnalyticsPage() {
  const [emps, setEmps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('employees').select('*').then(({ data }) => setEmps((data || []).filter((e: any) => e.is_active !== false && (e.status || 'ACTIVE') !== 'EXITED'))).then(() => setLoading(false), () => setLoading(false));
  }, []);

  const now = Date.now();
  const tenureYears = (e: any) => e.join_date ? (now - new Date(e.join_date).getTime()) / YEAR : null;
  const avgTenure = useMemo(() => { const ts = emps.map(tenureYears).filter((t): t is number => t !== null); return ts.length ? Math.round(ts.reduce((s, t) => s + t, 0) / ts.length * 10) / 10 : 0; }, [emps]);

  const groupBy = (key: string, top = 8) => { const m = new Map<string, number>(); emps.forEach(e => m.set(e[key] || 'Unspecified', (m.get(e[key] || 'Unspecified') || 0) + 1)); return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, top); };
  const byDept = useMemo(() => groupBy('department'), [emps]);
  const byNationality = useMemo(() => groupBy('nationality'), [emps]);
  const byType = useMemo(() => groupBy('employment_type', 6), [emps]);
  const byGender = useMemo(() => groupBy('gender', 4), [emps]);
  const tenure = useMemo(() => {
    const b = [{ name: '<1 yr', value: 0 }, { name: '1–3 yrs', value: 0 }, { name: '3–5 yrs', value: 0 }, { name: '5+ yrs', value: 0 }];
    emps.forEach(e => { const t = tenureYears(e); if (t === null) return; const i = t < 1 ? 0 : t < 3 ? 1 : t < 5 ? 2 : 3; b[i].value++; });
    return b;
  }, [emps]);

  const deptTable = useMemo(() => {
    const m = new Map<string, { count: number; tenure: number[] }>();
    emps.forEach(e => { const k = e.department || 'Unspecified'; const o = m.get(k) || { count: 0, tenure: [] }; o.count++; const t = tenureYears(e); if (t !== null) o.tenure.push(t); m.set(k, o); });
    return [...m.entries()].map(([name, v]) => ({ name, count: v.count, avgTenure: v.tenure.length ? Math.round(v.tenure.reduce((s, t) => s + t, 0) / v.tenure.length * 10) / 10 : 0 })).sort((a, b) => b.count - a.count);
  }, [emps]);

  const exportCols = ['Department', 'Headcount', 'Avg tenure (yrs)'];
  const exportRows = deptTable.map(d => [d.name, d.count, d.avgTenure]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Workforce Analytics"
        subtitle="Demographics, tenure and distribution across the workforce"
        breadcrumbs={[{ label: 'HR', href: '/hr' }, { label: 'Workforce' }]}
        actions={emps.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Workforce Analytics', columns: exportCols, rows: exportRows, fileName: 'workforce-analytics' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Workforce Analytics', columns: exportCols, rows: exportRows, fileName: 'workforce-analytics' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : emps.length === 0 ? (
        <Card><EmptyState icon={Users} title="No employees" description="Workforce demographics appear here once employees are added." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Active headcount</div><div className="text-2xl font-bold mt-1">{emps.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Departments</div><div className="text-2xl font-bold mt-1">{byDept.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Nationalities</div><div className="text-2xl font-bold mt-1">{byNationality.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Avg tenure</div><div className="text-2xl font-bold mt-1">{avgTenure}<span className="text-sm font-normal text-[var(--text-tertiary)]">yrs</span></div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By department</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={byDept} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By nationality (top 8)</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={byNationality} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="var(--status-info-text)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By employment type</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <PieChart><Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(e: any) => e.name}>{byType.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Tenure distribution</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={tenure}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="var(--status-success-text)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-0 overflow-x-auto">
            <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Headcount by department</div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Department</th><th className="p-3 text-right">Headcount</th><th className="p-3 text-right">Avg tenure</th></tr></thead>
              <tbody>
                {deptTable.map((d, i) => (
                  <tr key={i} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3 font-medium text-[var(--text-primary)]">{d.name}</td>
                    <td className="p-3 text-right tabular-nums">{d.count}</td>
                    <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{d.avgTenure} yrs</td>
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
