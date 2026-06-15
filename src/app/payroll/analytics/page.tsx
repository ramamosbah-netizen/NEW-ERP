'use client';

// ============================================================
// JEET ERP — Payroll Analytics
// Run history, cost trend, pay-component breakdown and by-department.
// Read-only; plain queries (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Wallet, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const N = (v: any) => Number(v || 0);
const PIE = ['var(--accent)', 'var(--status-info-text)', 'var(--status-warning-text)', 'var(--status-success-text)', 'var(--status-danger-text)'];

export default function PayrollAnalyticsPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [deptMap, setDeptMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [rn, ln, em] = await Promise.all([
          supabase.from('payroll_runs').select('id, period_month, status, gross_total, net_total').order('period_month', { ascending: false }),
          supabase.from('payroll_lines').select('run_id, employee_id, basic_salary, housing_allowance, transport_allowance, other_allowance, ot_amount, ot_hours, leave_deductions, gross_pay, net_pay'),
          supabase.from('employees').select('id, department'),
        ]);
        setRuns(rn.data || []); setLines(ln.data || []);
        setDeptMap(new Map((em.data || []).map((e: any) => [e.id, e.department || '—'])));
      } finally { setLoading(false); }
    })();
  }, []);

  const latest = runs[0];
  const totalOt = lines.reduce((s, l) => s + N(l.ot_amount), 0);
  const avgNet = lines.length ? lines.reduce((s, l) => s + N(l.net_pay), 0) / lines.length : 0;

  const trend = useMemo(() => [...runs].sort((a, b) => (a.period_month || '').localeCompare(b.period_month || '')).slice(-6).map(r => ({ month: (r.period_month || '').slice(2, 7), Gross: Math.round(N(r.gross_total)), Net: Math.round(N(r.net_total)) })), [runs]);
  const components = useMemo(() => {
    const c = { Basic: 0, Housing: 0, Transport: 0, Other: 0, OT: 0 };
    lines.forEach(l => { c.Basic += N(l.basic_salary); c.Housing += N(l.housing_allowance); c.Transport += N(l.transport_allowance); c.Other += N(l.other_allowance); c.OT += N(l.ot_amount); });
    return Object.entries(c).map(([name, value]) => ({ name, value: Math.round(value) })).filter(d => d.value > 0);
  }, [lines]);
  const byDept = useMemo(() => {
    const m = new Map<string, number>();
    lines.forEach(l => { const k = deptMap.get(l.employee_id) || '—'; m.set(k, (m.get(k) || 0) + N(l.net_pay)); });
    return [...m.entries()].map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [lines, deptMap]);

  const exportCols = ['Period', 'Status', 'Gross', 'Net'];
  const exportRows = runs.map(r => [r.period_month?.slice(0, 7) || '', r.status, Math.round(N(r.gross_total)), Math.round(N(r.net_total))]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Payroll Analytics"
        subtitle="Run history, cost trend and pay-component breakdown"
        breadcrumbs={[{ label: 'Payroll', href: '/payroll' }, { label: 'Analytics' }]}
        actions={runs.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Payroll Analytics', columns: exportCols, rows: exportRows, fileName: 'payroll-analytics' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Payroll Analytics', columns: exportCols, rows: exportRows, fileName: 'payroll-analytics' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : runs.length === 0 ? (
        <Card><EmptyState icon={Wallet} title="No payroll runs" description="Run monthly payroll to see cost analytics here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Latest gross</div><div className="text-lg font-bold mt-1">{aed(N(latest?.gross_total))}</div><div className="text-[11px] text-[var(--text-tertiary)]">{latest?.period_month?.slice(0, 7)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Latest net</div><div className="text-lg font-bold mt-1">{aed(N(latest?.net_total))}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total OT</div><div className="text-lg font-bold mt-1">{aed(totalOt)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Avg net / employee</div><div className="text-lg font-bold mt-1">{aed(avgNet)}</div></Card>
          </div>

          <Card className="p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Payroll cost trend</div>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => aed(v)} /><Legend />
                  <Bar dataKey="Gross" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Net" fill="var(--status-success-text)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {(components.length > 0 || byDept.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {components.length > 0 && (
                <Card className="p-4">
                  <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Pay components</div>
                  <div style={{ width: '100%', height: 240 }}>
                    <ResponsiveContainer>
                      <PieChart><Pie data={components} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(e: any) => e.name}>{components.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip formatter={(v: any) => aed(v)} /></PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}
              {byDept.length > 0 && (
                <Card className="p-4">
                  <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Net pay by department</div>
                  <div style={{ width: '100%', height: 240 }}>
                    <ResponsiveContainer>
                      <BarChart data={byDept} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                        <Tooltip formatter={(v: any) => aed(v)} />
                        <Bar dataKey="value" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}
            </div>
          )}

          <Card className="p-0 overflow-x-auto">
            <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Run history</div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Period</th><th className="p-3">Status</th><th className="p-3 text-right">Gross</th><th className="p-3 text-right">Net</th></tr></thead>
              <tbody>
                {runs.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3 font-medium text-[var(--text-primary)]">{r.period_month?.slice(0, 7)}</td>
                    <td className="p-3 text-xs">{r.status}</td>
                    <td className="p-3 text-right tabular-nums">{aed(N(r.gross_total))}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{aed(N(r.net_total))}</td>
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
