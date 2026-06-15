'use client';

// ============================================================
// JEET ERP — Finance: Project Profitability (Page 3, list)
// Portfolio profitability over the existing projectFinancialsService.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { projectFinancialsService } from '@/services/projectFinancialsService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TrendingUp, Search, AlertTriangle } from 'lucide-react';

const money = (v: number) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(v || 0);

export default function ProjectProfitabilityPage() {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: projects } = await supabase.from('projects')
        .select('id, status').not('status', 'in', '("CANCELLED")').limit(200);
      const summaries = await Promise.all((projects || []).map(p =>
        projectFinancialsService.computeProjectFinancials(p.id).catch(() => null)));
      setRows(summaries.filter(Boolean));
      setError(null);
    } catch (e: any) { setError(e.message || 'Failed to load profitability'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter(r => !search || (r.projectNumber || '').toLowerCase().includes(search.toLowerCase()) || (r.projectName || '').toLowerCase().includes(search.toLowerCase()));

  const agg = filtered.reduce((a, r) => ({
    contract: a.contract + (r.contractValue || 0), billed: a.billed + (r.revenueBilled || 0),
    collected: a.collected + (r.revenueCollected || 0), cost: a.cost + (r.actualCost || 0),
    projMargin: a.projMargin + (r.projectedMargin || 0), atRisk: a.atRisk + (r.isMarginEroded ? 1 : 0),
  }), { contract: 0, billed: 0, collected: 0, cost: 0, projMargin: 0, atRisk: 0 });
  const portfolioMarginPct = agg.contract ? Math.round(agg.projMargin / agg.contract * 100) : 0;

  const kpis = [
    { label: 'Contract value', value: `${money(agg.contract)} AED` },
    { label: 'Billed / Collected', value: `${money(agg.billed)} / ${money(agg.collected)}` },
    { label: 'Forecast margin', value: `${money(agg.projMargin)} AED (${portfolioMarginPct}%)`, warn: agg.projMargin < 0 },
    { label: 'Projects at risk', value: String(agg.atRisk), warn: agg.atRisk > 0 },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Project Profitability"
        subtitle="Contract, revenue, cost, margin and forecast per project"
        breadcrumbs={[{ label: 'Finance', href: '/finance' }, { label: 'Project Profitability' }]}
      />

      {error && (
        <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]"><span>{error}</span></div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map(k => (
          <Card key={k.label} className="p-3.5">
            <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">{k.label}</div>
            <div className="text-base font-semibold mt-1 tabular-nums" style={{ color: (k as any).warn ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{k.value}</div>
          </Card>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search project…" className="w-full pl-9 pr-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
      </div>

      <Card className="overflow-hidden">
        {loading ? <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Computing profitability…</div>
          : filtered.length === 0 ? <EmptyState icon={TrendingUp} title="No projects" description="Active projects with a contract value appear here." />
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)]">
                  <th className="px-4 py-2.5 font-medium">Project</th>
                  <th className="px-4 py-2.5 font-medium text-right">Contract</th>
                  <th className="px-4 py-2.5 font-medium text-right">Billed</th>
                  <th className="px-4 py-2.5 font-medium text-right">Actual cost</th>
                  <th className="px-4 py-2.5 font-medium text-right">Committed</th>
                  <th className="px-4 py-2.5 font-medium text-right">Forecast margin</th>
                  <th className="px-4 py-2.5 font-medium text-right">%</th>
                </tr></thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.projectId} onClick={() => router.push(`/finance/project-profitability/${r.projectId}`)}
                      className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-[var(--text-primary)] flex items-center gap-1.5">{r.isMarginEroded && <AlertTriangle size={11} className="text-[var(--status-danger-text)]" />}{r.projectNumber}</div>
                        <div className="text-[var(--text-tertiary)]">{r.projectName}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{money(r.contractValue)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{money(r.revenueBilled)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{money(r.actualCost)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{money(r.committedCost)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: r.projectedMargin < 0 ? 'var(--status-danger-text)' : 'var(--status-success-text)' }}>{money(r.projectedMargin)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: r.projectedMargin < 0 ? 'var(--status-danger-text)' : 'var(--text-secondary)' }}>{Math.round(r.projectedMarginPercent || 0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>
    </div>
  );
}
