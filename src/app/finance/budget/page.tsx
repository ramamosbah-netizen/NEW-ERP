'use client';

// ============================================================
// JEET ERP — Finance: Budget & Cost Control (list + dashboard)
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import budgetService, { BudgetSummary } from '@/services/budgetService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Wallet, Plus, X, AlertTriangle, TrendingUp, Search } from 'lucide-react';

const money = (v: number) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(v || 0);
const STATUS: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: 'var(--status-neutral-bg)', text: 'var(--status-neutral-text)' },
  APPROVED: { bg: 'var(--status-success-bg)', text: 'var(--status-success-text)' },
  SUPERSEDED: { bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)' },
};

export default function BudgetListPage() {
  const router = useRouter();
  const [rows, setRows] = useState<BudgetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [projects, setProjects] = useState<{ id: string; label: string }[]>([]);
  const [projId, setProjId] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setLoading(true); setRows(await budgetService.list()); setError(null); }
    catch (e: any) { setError(e.message || 'Failed to load budgets'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    supabase.from('projects').select('id, project_number, name').order('project_number', { ascending: false })
      .then(({ data }) => setProjects((data || []).map((p: any) => ({ id: p.id, label: `${p.project_number} — ${p.name}` }))));
  }, []);

  // KPIs from the latest revision per project (avoid double-counting revisions)
  const latestPerProject = Array.from(rows.reduce((m, r) => { if (!m.has(r.project_id)) m.set(r.project_id, r); return m; }, new Map<string, BudgetSummary>()).values());
  const agg = latestPerProject.reduce((a, r) => ({
    planned: a.planned + r.totals.planned, committed: a.committed + r.totals.committed,
    forecast: a.forecast + r.totals.forecast, forecastProfit: a.forecastProfit + r.totals.forecastProfit,
    overruns: a.overruns + r.totals.overruns,
  }), { planned: 0, committed: 0, forecast: 0, forecastProfit: 0, overruns: 0 });
  const utilization = agg.planned ? Math.round(agg.committed / agg.planned * 100) : 0;
  const costVariance = agg.planned - agg.forecast;

  const create = async () => {
    if (!projId) return;
    setBusy(true);
    try { const id = await budgetService.createFromBoq(projId); router.push(`/finance/budget/${id}`); }
    catch (e: any) { setError(e.message || 'Failed to create budget'); setBusy(false); }
  };

  const filtered = rows.filter(r => !search || r.project_number.toLowerCase().includes(search.toLowerCase()) || r.project_name.toLowerCase().includes(search.toLowerCase()));

  const kpis = [
    { label: 'Budget utilization', value: `${utilization}%`, hint: 'Committed ÷ planned', warn: utilization > 100 },
    { label: 'Cost variance', value: `${money(costVariance)} AED`, hint: 'Planned − forecast', warn: costVariance < 0 },
    { label: 'Forecast profit', value: `${money(agg.forecastProfit)} AED`, hint: 'Contract − forecast cost', warn: agg.forecastProfit < 0 },
    { label: 'Cost overrun alerts', value: String(agg.overruns), hint: 'Lines over budget', warn: agg.overruns > 0 },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Budget & Cost Control"
        subtitle="Project budgets from BOQ — planned vs committed vs forecast, variance and overrun alerts"
        breadcrumbs={[{ label: 'Finance', href: '/finance' }, { label: 'Budgets' }]}
        actions={<Button size="sm" variant="primary" icon={Plus} onClick={() => setShowCreate(true)}>New budget from BOQ</Button>}
      />

      {error && (
        <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]">
          <span>{error}</span><button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map(k => (
          <Card key={k.label} className="p-3.5">
            <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">{k.label}</div>
            <div className="text-lg font-semibold mt-1 tabular-nums" style={{ color: k.warn ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{k.value}</div>
            <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{k.hint}</div>
          </Card>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search project…"
          className="w-full pl-9 pr-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
      </div>

      <Card className="overflow-hidden">
        {loading ? <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div>
          : filtered.length === 0 ? <EmptyState icon={Wallet} title="No budgets yet" description="Create a project budget from its BOQ to start cost control." />
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)]">
                    <th className="px-4 py-2.5 font-medium">Project</th>
                    <th className="px-4 py-2.5 font-medium">Rev</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium text-right">Planned</th>
                    <th className="px-4 py-2.5 font-medium text-right">Committed</th>
                    <th className="px-4 py-2.5 font-medium text-right">Forecast</th>
                    <th className="px-4 py-2.5 font-medium text-right">Util %</th>
                    <th className="px-4 py-2.5 font-medium text-right">Fcst profit</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const st = STATUS[r.status] || STATUS.DRAFT;
                    return (
                      <tr key={r.id} onClick={() => router.push(`/finance/budget/${r.id}`)}
                        className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer">
                        <td className="px-4 py-2.5"><div className="font-medium text-[var(--text-primary)]">{r.project_number}</div><div className="text-[var(--text-tertiary)]">{r.project_name}</div></td>
                        <td className="px-4 py-2.5">v{r.revision_no}</td>
                        <td className="px-4 py-2.5"><span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.text }}>{r.status}</span></td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{money(r.totals.planned)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{money(r.totals.committed)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{money(r.totals.forecast)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: r.totals.utilizationPct > 100 ? 'var(--status-danger-text)' : 'var(--text-secondary)' }}>{r.totals.utilizationPct}%</td>
                        <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: r.totals.forecastProfit < 0 ? 'var(--status-danger-text)' : 'var(--status-success-text)' }}>{money(r.totals.forecastProfit)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </Card>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <Card className="w-full max-w-md p-5" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">New budget from BOQ</h3>
              <button onClick={() => setShowCreate(false)} className="cursor-pointer text-[var(--text-tertiary)]"><X size={16} /></button>
            </div>
            <label className="text-xs font-medium text-[var(--text-secondary)]">Project</label>
            <select value={projId} onChange={e => setProjId(e.target.value)}
              className="w-full mt-1 px-3 h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
              <option value="">Select project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-2">Imports the project's BOQ items as planned-cost lines (a new revision each time).</p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button variant="primary" size="sm" icon={Plus} isLoading={busy} disabled={!projId} onClick={create}>Create</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
