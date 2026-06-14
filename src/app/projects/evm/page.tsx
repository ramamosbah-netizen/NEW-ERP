'use client';

// ============================================================
// JEET ERP — Projects: Progress & Earned Value (EVM)
// PV / EV / AC + SPI / CPI / EAC over the WBS and project actuals.
// Read-only; reuses evmService (no migration).
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import evmService, { EvmResult } from '@/services/evmService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { TrendingUp, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;

function indexBadge(v: number) {
  const ok = v >= 1, warn = v >= 0.9 && v < 1;
  const bg = ok ? 'var(--status-success-bg)' : warn ? 'var(--status-warning-bg)' : 'var(--status-danger-bg)';
  const tx = ok ? 'var(--status-success-text)' : warn ? 'var(--status-warning-text)' : 'var(--status-danger-text)';
  return { bg, tx };
}

export default function ProjectEvmPage() {
  const [projects, setProjects] = useState<{ id: string; label: string }[]>([]);
  const [projectId, setProjectId] = useState('');
  const [data, setData] = useState<EvmResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('projects').select('id, project_number, name').order('project_number', { ascending: false })
      .then(({ data }) => setProjects((data || []).map((p: any) => ({ id: p.id, label: `${p.project_number} — ${p.name}` }))));
  }, []);

  const load = useCallback(async () => {
    if (!projectId) { setData(null); return; }
    setLoading(true);
    try { setData(await evmService.compute(projectId)); } finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const projLabel = projects.find(p => p.id === projectId)?.label || '';
  const exportCols = ['Work package', 'Budget (BAC)', 'Planned %', 'Actual %', 'PV', 'EV'];
  const exportRows = (data?.lines || []).map(l => [l.name, l.budget, `${l.plannedPct}%`, `${l.progressPct}%`, l.pv, l.ev]);

  const kpis = data ? [
    { label: 'Budget at Completion (BAC)', value: aed(data.bac) },
    { label: 'Planned Value (PV)', value: aed(data.pv) },
    { label: 'Earned Value (EV)', value: aed(data.ev) },
    { label: 'Actual Cost (AC)', value: aed(data.ac) },
    { label: 'Estimate at Completion (EAC)', value: aed(data.eac) },
    { label: 'Variance at Completion (VAC)', value: aed(data.vac), neg: data.vac < 0 },
  ] : [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Progress & Earned Value (EVM)"
        subtitle="Schedule and cost performance from WBS progress and project actuals"
        breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'EVM' }]}
        actions={data ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Earned Value Report', subtitle: projLabel, columns: exportCols, rows: exportRows, fileName: 'evm-report' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Earned Value Report', subtitle: projLabel, columns: exportCols, rows: exportRows, fileName: 'evm-report' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      <Card className="p-4">
        <label className="text-xs font-medium text-[var(--text-secondary)]">Project</label>
        <select value={projectId} onChange={e => setProjectId(e.target.value)} className="w-full md:max-w-md mt-1 px-3 h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
          <option value="">Select a project…</option>{projects.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <p className="text-[11px] text-[var(--text-tertiary)] mt-2">EV uses WBS <strong>progress</strong>; PV uses WBS <strong>planned dates</strong>; AC is the project&apos;s actual cost to date.</p>
      </Card>

      {!projectId ? (
        <Card><EmptyState icon={TrendingUp} title="Select a project" description="Choose a project to compute earned value." /></Card>
      ) : loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Computing…</div></Card>
      ) : !data || data.bac === 0 ? (
        <Card><EmptyState icon={TrendingUp} title="No budget yet" description="Add budgets to WBS work packages (or a project budget) to compute EVM." /></Card>
      ) : (
        <>
          {/* Performance indices */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'Schedule Performance (SPI)', v: data.spi, hint: data.spi >= 1 ? 'Ahead / on schedule' : 'Behind schedule' },
              { label: 'Cost Performance (CPI)', v: data.cpi, hint: data.cpi >= 1 ? 'Under / on budget' : 'Over budget' },
              { label: 'Overall % Complete', v: data.percentComplete, pct: true, hint: 'Earned value ÷ BAC' },
            ].map((k, i) => {
              const c = k.pct ? { bg: 'var(--surface-active)', tx: 'var(--text-primary)' } : indexBadge(k.v);
              return (
                <Card key={i} className="p-4">
                  <div className="text-xs text-[var(--text-secondary)]">{k.label}</div>
                  <div className="text-2xl font-bold mt-1" style={{ color: c.tx }}>{k.pct ? `${k.v}%` : k.v.toFixed(2)}</div>
                  <div className="text-[11px] text-[var(--text-tertiary)] mt-1">{k.hint}</div>
                </Card>
              );
            })}
          </div>

          {/* Money KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {kpis.map((k, i) => (
              <Card key={i} className="p-4">
                <div className="text-xs text-[var(--text-secondary)]">{k.label}</div>
                <div className="text-lg font-semibold mt-1" style={{ color: (k as any).neg ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{k.value}</div>
              </Card>
            ))}
          </div>

          {/* PV / EV / AC chart */}
          <Card className="p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Planned vs Earned vs Actual</div>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={[{ name: 'Project', PV: data.pv, EV: data.ev, AC: data.ac }]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => aed(v)} />
                  <Legend />
                  <Bar dataKey="PV" fill="var(--accent)" name="Planned Value" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="EV" fill="var(--status-success-text)" name="Earned Value" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="AC" fill="var(--status-warning-text)" name="Actual Cost" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Per-WBS breakdown */}
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Work package</th>
                <th className="p-3 text-right">Budget</th>
                <th className="p-3 text-right">Planned %</th>
                <th className="p-3 text-right">Actual %</th>
                <th className="p-3 text-right">PV</th>
                <th className="p-3 text-right">EV</th>
              </tr></thead>
              <tbody>
                {data.lines.map((l, i) => (
                  <tr key={i} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3 text-[var(--text-primary)]">{l.name}</td>
                    <td className="p-3 text-right tabular-nums">{aed(l.budget)}</td>
                    <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{l.plannedPct}%</td>
                    <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{l.progressPct}%</td>
                    <td className="p-3 text-right tabular-nums">{aed(l.pv)}</td>
                    <td className="p-3 text-right tabular-nums">{aed(l.ev)}</td>
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
