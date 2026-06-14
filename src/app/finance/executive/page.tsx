'use client';

// ============================================================
// JEET ERP — Finance: Executive Dashboard (Page 11)
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import executiveFinanceService, { ExecDashboard } from '@/services/executiveFinanceService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { AlertTriangle, AlertOctagon, RefreshCw } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

const money = (v: number) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(v || 0);
const tip = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 };

export default function ExecutiveFinancePage() {
  const [d, setD] = useState<ExecDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { setLoading(true); try { setD(await executiveFinanceService.getDashboard()); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="p-8 text-sm text-[var(--text-tertiary)]">Compiling executive dashboard…</div>;
  if (!d) return <div className="p-8 text-sm text-[var(--text-tertiary)]">No data.</div>;

  const k = d.kpis;
  const kpis = [
    { label: 'Current cash', value: k.currentCash },
    { label: 'Available cash', value: k.availableCash },
    { label: 'Expected collections', value: k.expectedCollections },
    { label: 'Expected payments', value: k.expectedPayments, warn: true },
    { label: 'Forecast cash (13w)', value: k.forecastCash, warn: k.forecastCash < 0 },
    { label: 'Working capital', value: k.workingCapital, warn: k.workingCapital < 0 },
    { label: 'Net profit (YTD)', value: k.netProfit, warn: k.netProfit < 0 },
    { label: 'Total commitments', value: k.totalCommitments },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Executive Finance Dashboard"
        subtitle="Cash, working capital, profit, commitments and risk — across the company"
        breadcrumbs={[{ label: 'Finance', href: '/finance' }, { label: 'Executive' }]}
        actions={<button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] cursor-pointer"><RefreshCw size={13} /> Refresh</button>}
      />

      {/* Alerts */}
      {d.alerts.length > 0 && (
        <div className="grid md:grid-cols-2 gap-2">
          {d.alerts.map((a, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg p-3 text-xs border"
              style={{ background: a.level === 'danger' ? 'var(--status-danger-bg)' : 'var(--status-warning-bg)', borderColor: a.level === 'danger' ? 'var(--status-danger-border)' : 'var(--status-warning-border)', color: a.level === 'danger' ? 'var(--status-danger-text)' : 'var(--status-warning-text)' }}>
              {a.level === 'danger' ? <AlertOctagon size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
              <div><div className="font-semibold">{a.title}</div><div className="opacity-90">{a.detail}</div></div>
            </div>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map(kp => (
          <Card key={kp.label} className="p-3.5">
            <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">{kp.label}</div>
            <div className="text-lg font-semibold mt-1 tabular-nums" style={{ color: (kp as any).warn && kp.value < 0 ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{money(kp.value)}<span className="text-xs font-normal text-[var(--text-tertiary)]"> AED</span></div>
          </Card>
        ))}
        <Card className="p-3.5">
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">Projects at risk</div>
          <div className="text-lg font-semibold mt-1 tabular-nums" style={{ color: k.projectsAtRisk > 0 ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{k.projectsAtRisk}</div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="p-4">
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Cash forecast (13 weeks)</div>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={d.cashTrend} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={money} width={64} />
                <Tooltip formatter={(v: any) => `${money(v)} AED`} contentStyle={tip} />
                <Line type="monotone" dataKey="balance" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Revenue trend</div>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={d.revenueTrend} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={money} width={64} />
                <Tooltip formatter={(v: any) => `${money(v)} AED`} contentStyle={tip} />
                <Bar dataKey="revenue" fill="#22c55e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Receivables vs Payables aging</div>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={d.arAging.map((a, i) => ({ bucket: a.bucket, AR: a.amount, AP: d.apAging[i]?.amount || 0 }))} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={money} width={64} />
                <Tooltip formatter={(v: any) => `${money(v)} AED`} contentStyle={tip} />
                <Bar dataKey="AR" fill="#2563eb" radius={[3, 3, 0, 0]} />
                <Bar dataKey="AP" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Project margin (lowest first)</div>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={d.topProjects} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} tickFormatter={money} />
                <YAxis type="category" dataKey="project_number" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} width={90} />
                <Tooltip formatter={(v: any) => `${money(v)} AED`} contentStyle={tip} />
                <Bar dataKey="margin" radius={[0, 3, 3, 0]}>{d.topProjects.map((p, i) => <Cell key={i} fill={p.margin < 0 ? '#ef4444' : '#22c55e'} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
