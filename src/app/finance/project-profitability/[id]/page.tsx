'use client';

// ============================================================
// JEET ERP — Finance: Project Profitability (Page 3, detail)
// ============================================================

import React, { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { projectFinancialsService } from '@/services/projectFinancialsService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, Cell } from 'recharts';

const money = (v: number) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(v || 0);

export default function ProjectProfitabilityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [s, setS] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setLoading(true); setS(await projectFinancialsService.computeProjectFinancials(id)); setError(null); }
    catch (e: any) { setError(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="p-8 text-sm text-[var(--text-tertiary)]">Computing…</div>;
  if (!s) return <div className="p-8 text-sm text-[var(--text-tertiary)]">{error || 'Not found.'}</div>;

  const revVsCost = [
    { name: 'Contract', value: s.contractValue, fill: '#64748b' },
    { name: 'Billed', value: s.revenueBilled, fill: '#2563eb' },
    { name: 'Collected', value: s.revenueCollected, fill: '#22c55e' },
    { name: 'Budget cost', value: s.budgetCost, fill: '#94a3b8' },
    { name: 'Committed', value: s.committedCost, fill: '#f59e0b' },
    { name: 'Actual cost', value: s.actualCost, fill: '#ef4444' },
    { name: 'Forecast cost', value: s.projectedCostAtCompletion, fill: '#a855f7' },
  ].map(d => ({ ...d, value: Math.round(d.value || 0) }));

  const margin = [
    { name: 'Realized', value: Math.round(s.realizedMargin || 0) },
    { name: 'Forecast', value: Math.round(s.projectedMargin || 0) },
  ];

  const kpis = [
    { label: 'Contract value', value: s.contractValue },
    { label: 'Revenue billed', value: s.revenueBilled },
    { label: 'Collected', value: s.revenueCollected },
    { label: 'Actual cost', value: s.actualCost },
    { label: 'Committed cost', value: s.committedCost },
    { label: 'Forecast cost', value: s.projectedCostAtCompletion },
    { label: 'Realized margin', value: s.realizedMargin, pct: s.realizedMarginPercent, warn: s.realizedMargin < 0 },
    { label: 'Forecast margin', value: s.projectedMargin, pct: s.projectedMarginPercent, warn: s.projectedMargin < 0 },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Profitability — ${s.projectNumber}`}
        subtitle={s.projectName}
        breadcrumbs={[{ label: 'Finance', href: '/finance' }, { label: 'Project Profitability', href: '/finance/project-profitability' }, { label: s.projectNumber }]}
        actions={<Button size="sm" variant="secondary" onClick={() => router.push('/finance/project-profitability')}>Back</Button>}
      />

      {s.isMarginEroded && (
        <div className="flex items-center gap-2 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]">
          <AlertTriangle size={14} /> Margin erosion risk — forecast cost is approaching/exceeding the contract value.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map(k => (
          <Card key={k.label} className="p-3">
            <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">{k.label}</div>
            <div className="text-base font-semibold mt-1 tabular-nums" style={{ color: (k as any).warn ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>
              {money(k.value)}{(k as any).pct !== undefined ? <span className="text-[11px] font-normal text-[var(--text-tertiary)]"> ({Math.round((k as any).pct || 0)}%)</span> : ''}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="p-4 lg:col-span-2">
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Revenue vs Cost</div>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={revVsCost} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => money(v)} width={70} />
                <Tooltip formatter={(v: any) => `${money(v)} AED`} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>{revVsCost.map((d, i) => <Cell key={i} fill={d.fill} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Margin (realized vs forecast)</div>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={margin} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => money(v)} width={70} />
                <Tooltip formatter={(v: any) => `${money(v)} AED`} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>{margin.map((d, i) => <Cell key={i} fill={d.value < 0 ? '#ef4444' : '#22c55e'} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
