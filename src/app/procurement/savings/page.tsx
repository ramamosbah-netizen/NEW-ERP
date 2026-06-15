'use client';

// ============================================================
// JEET ERP — Procurement: Savings & Comparison Analysis
// Quote comparisons: savings vs BOQ, selected vs lowest (money left
// on the table), margin and overrides. Read-only (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { PiggyBank, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const N = (v: any) => Number(v || 0);

interface Cmp {
  id: string; comparison_number: string; project_name: string | null; client_name: string | null; status: string; comparison_date: string | null;
  total_boq_material_cost: number; total_selected_supplier_cost: number; total_lowest_supplier_cost: number;
  total_savings_vs_boq: number; total_savings_pct: number; overall_margin_pct: number; potential_extra_savings: number; override_count: number; exception_count: number;
}

export default function SavingsAnalysisPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Cmp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('supplier_comparisons').select('id, comparison_number, project_name, client_name, status, comparison_date, total_boq_material_cost, total_selected_supplier_cost, total_lowest_supplier_cost, total_savings_vs_boq, total_savings_pct, overall_margin_pct, potential_extra_savings, override_count, exception_count').order('comparison_date', { ascending: false })
      .then(({ data }) => setRows((data || []) as Cmp[])).then(() => setLoading(false), () => setLoading(false));
  }, []);

  const savingsVsBoq = rows.reduce((s, r) => s + N(r.total_savings_vs_boq), 0);
  const potentialExtra = rows.reduce((s, r) => s + N(r.potential_extra_savings), 0);
  const selectedCost = rows.reduce((s, r) => s + N(r.total_selected_supplier_cost), 0);
  const lowestCost = rows.reduce((s, r) => s + N(r.total_lowest_supplier_cost), 0);
  const overrides = rows.reduce((s, r) => s + N(r.override_count), 0);
  const avgMargin = rows.length ? Math.round(rows.reduce((s, r) => s + N(r.overall_margin_pct), 0) / rows.length) : 0;

  const savingsChart = useMemo(() => rows.slice(0, 10).map(r => ({ name: r.comparison_number, Savings: Math.round(N(r.total_savings_vs_boq)), Potential: Math.round(N(r.potential_extra_savings)) })), [rows]);
  const costChart = useMemo(() => rows.slice(0, 8).map(r => ({ name: r.comparison_number, Selected: Math.round(N(r.total_selected_supplier_cost)), Lowest: Math.round(N(r.total_lowest_supplier_cost)) })), [rows]);

  const exportCols = ['Comparison', 'Project', 'BOQ cost', 'Selected', 'Lowest', 'Savings vs BOQ', 'Potential extra', 'Margin %', 'Overrides'];
  const exportRows = rows.map(r => [r.comparison_number, r.project_name || '', Math.round(N(r.total_boq_material_cost)), Math.round(N(r.total_selected_supplier_cost)), Math.round(N(r.total_lowest_supplier_cost)), Math.round(N(r.total_savings_vs_boq)), Math.round(N(r.potential_extra_savings)), `${Math.round(N(r.overall_margin_pct))}%`, N(r.override_count)]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Savings & Comparison Analysis"
        subtitle="Quote comparisons — savings vs BOQ, selected vs lowest, and margin"
        breadcrumbs={[{ label: 'Procurement', href: '/procurement/dashboard' }, { label: 'Savings' }]}
        actions={rows.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Procurement Savings', columns: exportCols, rows: exportRows, fileName: 'procurement-savings' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Procurement Savings', columns: exportCols, rows: exportRows, fileName: 'procurement-savings' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={PiggyBank} title="No comparisons" description="Quote comparisons and the savings they capture appear here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Comparisons</div><div className="text-2xl font-bold mt-1">{rows.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Savings vs BOQ</div><div className="text-lg font-bold mt-1" style={{ color: 'var(--status-success-text)' }}>{aed(savingsVsBoq)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Left on table</div><div className="text-lg font-bold mt-1" style={{ color: potentialExtra ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{aed(potentialExtra)}</div><div className="text-[11px] text-[var(--text-tertiary)]">selected − lowest</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Avg margin</div><div className="text-2xl font-bold mt-1">{avgMargin}%</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Overrides</div><div className="text-2xl font-bold mt-1" style={{ color: overrides ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{overrides}</div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Savings vs BOQ &amp; money left on the table</div>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={savingsChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => aed(v)} />
                    <Legend />
                    <Bar dataKey="Savings" fill="var(--status-success-text)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Potential" fill="var(--status-warning-text)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Selected vs lowest cost</div>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={costChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => aed(v)} />
                    <Legend />
                    <Bar dataKey="Selected" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Lowest" fill="var(--status-info-text)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Comparison</th><th className="p-3">Project</th><th className="p-3 text-right">BOQ cost</th><th className="p-3 text-right">Selected</th>
                <th className="p-3 text-right">Lowest</th><th className="p-3 text-right">Savings</th><th className="p-3 text-right">Left on table</th><th className="p-3 text-right">Margin</th><th className="p-3 text-right">Overrides</th>
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/procurement/comparisons/${r.id}`)}>
                    <td className="p-3"><div className="font-medium text-[var(--text-primary)]">{r.comparison_number}</div><div className="text-[11px] text-[var(--text-tertiary)]">{r.client_name}</div></td>
                    <td className="p-3 text-xs text-[var(--text-secondary)] line-clamp-1">{r.project_name || '—'}</td>
                    <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{aed(N(r.total_boq_material_cost))}</td>
                    <td className="p-3 text-right tabular-nums">{aed(N(r.total_selected_supplier_cost))}</td>
                    <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{aed(N(r.total_lowest_supplier_cost))}</td>
                    <td className="p-3 text-right tabular-nums font-medium" style={{ color: N(r.total_savings_vs_boq) >= 0 ? 'var(--status-success-text)' : 'var(--status-danger-text)' }}>{aed(N(r.total_savings_vs_boq))}</td>
                    <td className="p-3 text-right tabular-nums" style={{ color: N(r.potential_extra_savings) ? 'var(--status-warning-text)' : 'var(--text-tertiary)' }}>{N(r.potential_extra_savings) ? aed(N(r.potential_extra_savings)) : '—'}</td>
                    <td className="p-3 text-right tabular-nums">{Math.round(N(r.overall_margin_pct))}%</td>
                    <td className="p-3 text-right tabular-nums" style={{ color: N(r.override_count) ? 'var(--status-warning-text)' : 'var(--text-tertiary)' }}>{N(r.override_count) || '—'}</td>
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
