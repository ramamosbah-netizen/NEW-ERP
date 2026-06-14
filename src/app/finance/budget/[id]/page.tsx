'use client';

// ============================================================
// JEET ERP — Finance: Budget detail (lines, variance, freeze)
// ============================================================

import React, { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import budgetService, { BudgetLine, BudgetTotals, ProjectBudget } from '@/services/budgetService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Lock, X, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';

const money = (v: number) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(v || 0);

export default function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<{ budget: ProjectBudget; project: any; lines: BudgetLine[]; totals: BudgetTotals } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setLoading(true); setData(await budgetService.get(id)); setError(null); }
    catch (e: any) { setError(e.message || 'Failed to load budget'); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const approve = async () => {
    if (!window.confirm('Approve and freeze this budget revision? It becomes the baseline.')) return;
    setBusy(true);
    try { await budgetService.approve(id); await load(); }
    catch (e: any) { setError(e.message || 'Approve failed'); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="p-8 text-sm text-[var(--text-tertiary)]">Loading…</div>;
  if (!data) return <div className="p-8 text-sm text-[var(--text-tertiary)]">Budget not found.</div>;

  const { budget, project, lines, totals } = data;

  // by-system aggregation for the chart
  const bySystem = Array.from(lines.reduce((m, l) => {
    const k = l.system_name || 'General';
    const e = m.get(k) || { system: k, planned: 0, committed: 0, forecast: 0 };
    e.planned += l.planned_cost; e.committed += l.committed_cost; e.forecast += l.forecast_cost;
    m.set(k, e); return m;
  }, new Map<string, any>()).values()).map(e => ({ ...e, planned: Math.round(e.planned), committed: Math.round(e.committed), forecast: Math.round(e.forecast) }));

  const kpis = [
    { label: 'Planned', value: totals.planned },
    { label: 'Committed', value: totals.committed },
    { label: 'Actual', value: totals.actual },
    { label: 'Forecast (FAC)', value: totals.forecast },
    { label: 'Variance', value: totals.variance, warn: totals.variance < 0 },
    { label: 'Forecast profit', value: totals.forecastProfit, warn: totals.forecastProfit < 0 },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Budget — ${project?.project_number || ''} (rev ${budget.revision_no})`}
        subtitle={`${project?.project_name || project?.name || ''} · Contract ${money(totals.contractValue)} AED · ${budget.status}`}
        breadcrumbs={[{ label: 'Finance', href: '/finance' }, { label: 'Budgets', href: '/finance/budget' }, { label: `Rev ${budget.revision_no}` }]}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => router.push('/finance/budget')}>Back</Button>
            {budget.status === 'DRAFT' && <Button size="sm" variant="primary" icon={Lock} isLoading={busy} onClick={approve}>Approve &amp; freeze</Button>}
          </div>
        }
      />

      {error && (
        <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]">
          <span>{error}</span><button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button>
        </div>
      )}

      {totals.overruns > 0 && (
        <div className="flex items-center gap-2 bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] rounded-lg p-3 text-xs text-[var(--status-warning-text)]">
          <AlertTriangle size={14} /> {totals.overruns} line(s) over budget — committed cost exceeds planned.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {kpis.map(k => (
          <Card key={k.label} className="p-3">
            <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">{k.label}</div>
            <div className="text-base font-semibold mt-1 tabular-nums" style={{ color: (k as any).warn ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{money(k.value)}</div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Cost by system — planned vs committed vs forecast</div>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={bySystem} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="system" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => money(v)} width={70} />
              <Tooltip formatter={(v: any) => `${money(v)} AED`} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="planned" fill="#64748b" name="Planned" radius={[3, 3, 0, 0]} />
              <Bar dataKey="committed" fill="#2563eb" name="Committed" radius={[3, 3, 0, 0]} />
              <Bar dataKey="forecast" fill="#f59e0b" name="Forecast" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] text-sm font-semibold text-[var(--text-primary)]">Budget lines ({lines.length})</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)]">
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">System</th>
                <th className="px-4 py-2.5 font-medium text-right">Planned</th>
                <th className="px-4 py-2.5 font-medium text-right">Committed</th>
                <th className="px-4 py-2.5 font-medium text-right">Actual</th>
                <th className="px-4 py-2.5 font-medium text-right">Forecast</th>
                <th className="px-4 py-2.5 font-medium text-right">Variance</th>
                <th className="px-4 py-2.5 font-medium text-right">Var %</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(l => (
                <tr key={l.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-2">{l.cost_category}</td>
                  <td className="px-4 py-2 text-[var(--text-secondary)]">{l.system_name || 'General'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(l.planned_cost)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(l.committed_cost)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(l.actual_cost)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(l.forecast_cost)}</td>
                  <td className="px-4 py-2 text-right tabular-nums" style={{ color: l.variance_amount < 0 ? 'var(--status-danger-text)' : 'var(--text-secondary)' }}>{money(l.variance_amount)}</td>
                  <td className="px-4 py-2 text-right tabular-nums" style={{ color: l.variance_amount < 0 ? 'var(--status-danger-text)' : 'var(--text-tertiary)' }}>{l.variance_percent}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--border)] font-semibold">
                <td className="px-4 py-2.5" colSpan={2}>Total</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{money(totals.planned)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{money(totals.committed)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{money(totals.actual)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{money(totals.forecast)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{money(totals.variance)}</td>
                <td className="px-4 py-2.5"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
