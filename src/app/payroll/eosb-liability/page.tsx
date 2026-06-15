'use client';

// ============================================================
// JEET ERP — Payroll: End-of-Service (EOSB) Liability
// Accrued UAE gratuity across the active workforce (as if each
// employee exited today). Read-only; reuses gratuityService.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import gratuityService from '@/services/gratuityService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Landmark, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const YEAR = 365 * 86400000;
const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const N = (v: any) => Number(v || 0);
const today = () => new Date().toISOString().slice(0, 10);

interface Row { id: string; name: string; dept: string; join_date: string | null; years: number; basic: number; estimated: boolean; gratuity: number; }

export default function EosbLiabilityPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [em, pl] = await Promise.all([
          supabase.from('employees').select('id, full_name_en, department, join_date, current_hourly_cost_rate, is_active, status'),
          supabase.from('payroll_lines').select('employee_id, basic_salary'),
        ]);
        const basicMap = new Map<string, number>();
        (pl.data || []).forEach((l: any) => { if (l.employee_id && N(l.basic_salary) > 0 && !basicMap.has(l.employee_id)) basicMap.set(l.employee_id, N(l.basic_salary)); });
        const active = (em.data || []).filter((e: any) => e.is_active !== false && (e.status || 'ACTIVE') !== 'EXITED');
        const now = Date.now();
        const out: Row[] = active.map((e: any) => {
          const payrollBasic = basicMap.get(e.id);
          const estimated = payrollBasic === undefined;
          // fallback estimate: hourly cost rate × ~195 hours/month
          const basic = payrollBasic ?? Math.round(N(e.current_hourly_cost_rate) * 195);
          const years = e.join_date ? (now - new Date(e.join_date).getTime()) / YEAR : 0;
          let gratuity = 0;
          if (e.join_date && basic > 0) {
            const calc = gratuityService.calculateEOSB({ joinDate: e.join_date, exitDate: today(), basicSalary: basic, totalSalary: basic, unpaidLeaveDays: 0, leaveBalanceDays: 0, pendingSalaryDays: 0, outstandingAdvances: 0 });
            gratuity = calc.gratuityAmount;
          }
          return { id: e.id, name: e.full_name_en, dept: e.department || '—', join_date: e.join_date, years: Math.round(years * 10) / 10, basic, estimated, gratuity };
        });
        setRows(out.sort((a, b) => b.gratuity - a.gratuity));
      } finally { setLoading(false); }
    })();
  }, []);

  const totalLiability = rows.reduce((s, r) => s + r.gratuity, 0);
  const eligible = rows.filter(r => r.years >= 1).length;
  const avg = rows.length ? totalLiability / rows.length : 0;
  const anyEstimated = rows.some(r => r.estimated && r.gratuity > 0);

  const byDept = useMemo(() => { const m = new Map<string, number>(); rows.forEach(r => m.set(r.dept, (m.get(r.dept) || 0) + r.gratuity)); return [...m.entries()].map(([name, value]) => ({ name, value: Math.round(value) })).filter(d => d.value > 0).sort((a, b) => b.value - a.value).slice(0, 8); }, [rows]);
  const byTenure = useMemo(() => {
    const b = [{ name: '<1 yr', value: 0 }, { name: '1–3 yrs', value: 0 }, { name: '3–5 yrs', value: 0 }, { name: '5+ yrs', value: 0 }];
    rows.forEach(r => { const i = r.years < 1 ? 0 : r.years < 3 ? 1 : r.years < 5 ? 2 : 3; b[i].value += r.gratuity; });
    return b.map(x => ({ ...x, value: Math.round(x.value) }));
  }, [rows]);

  const exportCols = ['Employee', 'Department', 'Join date', 'Years', 'Basic', 'Accrued gratuity'];
  const exportRows = rows.map(r => [r.name, r.dept, r.join_date || '', r.years, r.basic, Math.round(r.gratuity)]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="End-of-Service Liability"
        subtitle="Accrued UAE gratuity across the workforce (as if exiting today)"
        breadcrumbs={[{ label: 'Payroll', href: '/payroll' }, { label: 'EOSB Liability' }]}
        actions={rows.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'EOSB Liability', columns: exportCols, rows: exportRows, fileName: 'eosb-liability' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'EOSB Liability', columns: exportCols, rows: exportRows, fileName: 'eosb-liability' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={Landmark} title="No employees" description="Active employees with a join date and basic salary are accrued here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total EOSB liability</div><div className="text-xl font-bold mt-1" style={{ color: 'var(--status-warning-text)' }}>{aed(totalLiability)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Employees</div><div className="text-2xl font-bold mt-1">{rows.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Gratuity-eligible (≥1 yr)</div><div className="text-2xl font-bold mt-1">{eligible}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Avg per employee</div><div className="text-lg font-bold mt-1">{aed(avg)}</div></Card>
          </div>

          {anyEstimated && <Card className="p-3" style={{ background: 'var(--status-info-bg)' }}><div className="text-[11px]" style={{ color: 'var(--status-info-text)' }}>Some employees have no payroll basic salary recorded — their gratuity is <strong>estimated</strong> from the hourly cost rate (≈195 hrs/month). Run payroll to use actual basic salary.</div></Card>}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Liability by department</div>
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
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Liability by tenure</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={byTenure}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => aed(v)} />
                    <Bar dataKey="value" fill="var(--status-warning-text)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Employee</th><th className="p-3">Department</th><th className="p-3">Joined</th><th className="p-3 text-right">Years</th><th className="p-3 text-right">Basic</th><th className="p-3 text-right">Accrued gratuity</th>
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/hr/${r.id}`)}>
                    <td className="p-3 font-medium text-[var(--text-primary)]">{r.name}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{r.dept}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{r.join_date || '—'}</td>
                    <td className="p-3 text-right tabular-nums">{r.years}</td>
                    <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{aed(r.basic)}{r.estimated ? <span className="text-[10px] text-[var(--text-tertiary)]"> est</span> : ''}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{aed(r.gratuity)}</td>
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
