'use client';

// ============================================================
// JEET ERP — Projects: Executive Dashboard (portfolio health)
// Schedule (progress) + cost (committed) + margin + risk across
// all live projects. Read-only; batched portfolio service.
// ============================================================

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import projectPortfolioService, { PortfolioSummary } from '@/services/projectPortfolioService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { LayoutDashboard, FileDown, Sheet, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const aedShort = (n: number) => `${(Number(n || 0) / 1000).toFixed(0)}k`;
const PIE = ['var(--accent)', 'var(--status-success-text)', 'var(--status-warning-text)', 'var(--status-info-text)', 'var(--status-danger-text)', '#8b5cf6'];

export default function ProjectExecutiveDashboard() {
  const router = useRouter();
  const [data, setData] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    projectPortfolioService.getPortfolio().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  const t = data?.totals;
  const marginColor = (pct: number) => pct >= 15 ? 'var(--status-success-text)' : pct >= 5 ? 'var(--status-warning-text)' : 'var(--status-danger-text)';

  const exportCols = ['Project', 'Name', 'Status', 'Contract', 'Billed', 'Collected', 'Committed', 'Proj. margin', 'Margin %', 'Progress %', 'T&C done', 'Open risks'];
  const exportRows = (data?.rows || []).map(r => [r.project_number, r.name, r.status, r.contractValue, r.revenueBilled, r.revenueCollected, r.committedCost, r.projectedMargin, `${r.marginPct}%`, `${r.progress}%`, `${r.tcDone}/${r.tcTotal}`, r.openRisks]);

  const marginChart = (data?.rows || []).slice(0, 10).map(r => ({ name: r.project_number, margin: r.projectedMargin, contract: r.contractValue }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Project Executive Dashboard"
        subtitle="Portfolio health — schedule, cost, margin and risk across live projects"
        breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'Executive' }]}
        actions={data && data.rows.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Project Portfolio', columns: exportCols, rows: exportRows, fileName: 'project-portfolio' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Project Portfolio', columns: exportCols, rows: exportRows, fileName: 'project-portfolio' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading portfolio…</div></Card>
      ) : !data || data.rows.length === 0 ? (
        <Card><EmptyState icon={LayoutDashboard} title="No live projects" description="Active projects with contracts will appear here." /></Card>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Live projects</div><div className="text-2xl font-bold mt-1">{t!.projects}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Contract value</div><div className="text-xl font-bold mt-1">{aed(t!.contractValue)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Billed / Collected</div><div className="text-lg font-semibold mt-1">{aed(t!.revenueBilled)}</div><div className="text-[11px] text-[var(--text-tertiary)]">collected {aed(t!.revenueCollected)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Projected margin</div><div className="text-xl font-bold mt-1" style={{ color: marginColor(t!.marginPct) }}>{aed(t!.projectedMargin)}</div><div className="text-[11px] text-[var(--text-tertiary)]">{t!.marginPct}% of contract</div></Card>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Committed cost</div><div className="text-lg font-semibold mt-1">{aed(t!.committedCost)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Open risks</div><div className="text-2xl font-bold mt-1">{t!.openRisks}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">High-risk projects</div><div className="text-2xl font-bold mt-1" style={{ color: t!.highRiskProjects ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{t!.highRiskProjects}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">T&amp;C packages done</div><div className="text-2xl font-bold mt-1">{t!.tcCompleted}<span className="text-sm font-normal text-[var(--text-tertiary)]"> / {t!.tcPackages}</span></div></Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="p-4 lg:col-span-2">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Contract vs projected margin (top 10)</div>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={marginChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={aedShort} />
                    <Tooltip formatter={(v: any) => aed(v)} />
                    <Legend />
                    <Bar dataKey="contract" name="Contract" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="margin" name="Proj. margin" fill="var(--status-success-text)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By status</div>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={data.byStatus} dataKey="contractValue" nameKey="status" cx="50%" cy="50%" outerRadius={90} label={(e: any) => e.status}>
                      {data.byStatus.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => aed(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Portfolio table */}
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Project</th><th className="p-3">Status</th>
                <th className="p-3 text-right">Contract</th><th className="p-3 text-right">Billed</th>
                <th className="p-3 text-right">Committed</th><th className="p-3 text-right">Proj. margin</th>
                <th className="p-3 text-center">Progress</th><th className="p-3 text-center">T&amp;C</th><th className="p-3 text-center">Risks</th>
              </tr></thead>
              <tbody>
                {data.rows.map(r => (
                  <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/projects/${r.id}`)}>
                    <td className="p-3"><div className="font-medium text-[var(--text-primary)]">{r.project_number}</div><div className="text-[11px] text-[var(--text-tertiary)] line-clamp-1">{r.name}</div></td>
                    <td className="p-3 text-xs">{r.status}</td>
                    <td className="p-3 text-right tabular-nums">{aed(r.contractValue)}</td>
                    <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{aed(r.revenueBilled)}</td>
                    <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{aed(r.committedCost)}</td>
                    <td className="p-3 text-right tabular-nums font-medium" style={{ color: marginColor(r.marginPct) }}>{aed(r.projectedMargin)} <span className="text-[10px]">({r.marginPct}%)</span></td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-active)] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${r.progress}%`, background: 'var(--accent)' }} /></div>
                        <span className="text-[10px] tabular-nums w-7 text-right">{r.progress}%</span>
                      </div>
                    </td>
                    <td className="p-3 text-center text-xs tabular-nums">{r.tcTotal > 0 ? <span title={`${r.tcReadiness}% avg completion`}>{r.tcDone}/{r.tcTotal}</span> : <span className="text-[var(--text-tertiary)]">—</span>}</td>
                    <td className="p-3 text-center">
                      {r.openRisks > 0 ? <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full" style={{ background: r.maxRiskScore >= 12 ? 'var(--status-danger-bg)' : 'var(--status-warning-bg)', color: r.maxRiskScore >= 12 ? 'var(--status-danger-text)' : 'var(--status-warning-text)' }}>{r.maxRiskScore >= 12 && <AlertTriangle size={10} />}{r.openRisks}</span> : <span className="text-[var(--text-tertiary)]">—</span>}
                    </td>
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
