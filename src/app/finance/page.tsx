// ============================================================
// JEET ERP — Finance Operations Hub Dashboard
// Route: /finance
// Theme: Bloomberg Terminal Electric Mint
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  TrendingUp, 
  FileText, 
  Layers, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Percent, 
  Calendar, 
  ArrowRightLeft,
  DollarSign,
  RefreshCw,
  AlertTriangle,
  AlertOctagon
} from 'lucide-react';
import { kpiService, FinanceKPIs } from '@/services/kpiService';
import { useCashFlow } from '@/hooks/useCashFlow';
import executiveFinanceService, { ExecDashboard } from '@/services/executiveFinanceService';
import { KPICard } from '@/components/ui/KPICard';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function FinanceDashboard() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<FinanceKPIs | null>(null);
  const [exec, setExec] = useState<ExecDashboard | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch live stats from kpiService
  const loadFinanceData = async () => {
    try {
      setRefreshing(true);
      const data = await kpiService.getFinanceKPIs();
      setKpis(data);
      executiveFinanceService.getDashboard().then(setExec).catch(() => {});
    } catch (err) {
      console.error('Error fetching finance KPIs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFinanceData();
  }, []);

  // Fetch forecast using cashflow hook with initial cash balance
  const cashBalance = kpis?.cashPosition ?? 500000;
  const { forecast, loading: cfLoading } = useCashFlow(cashBalance);

  const formatAED = (v: number) => {
    return new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' AED';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-24">
        <div className="h-10 w-10 border-2 border-[var(--accent)] border-t-transparent animate-spin rounded-full mb-4"></div>
        <p className="text-[var(--text-muted)] text-xs">Aggregating financial ledger data…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Finance"
        subtitle="Client billing · supplier aging · VAT compliance · rolling forecast"
        actions={
          <>
            <Button variant="secondary" size="sm" icon={RefreshCw} isLoading={refreshing} onClick={loadFinanceData}>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link href="/finance/ar/create" className="no-underline">
              <Button variant="primary" size="sm">Create Client Invoice</Button>
            </Link>
            <Link href="/finance/ap/register" className="no-underline">
              <Button variant="secondary" size="sm">Register Supplier Bill</Button>
            </Link>
          </>
        }
      />

        {/* KPI Scorecard Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* Receivables Stat */}
          <Link href="/finance/ar/aging" className="no-underline block group">
            <KPICard
              title="Receivables (AR)"
              value={kpis?.receivablesTotal ?? 0}
              valuePrefix="AED"
              change={kpis?.receivablesOverdue ? Math.round((kpis.receivablesOverdue / (kpis.receivablesTotal || 1)) * 100) : 0}
              changeText="% overdue"
              trend={(kpis?.receivablesOverdue ?? 0) > 0 ? 'down' : 'neutral'}
              tooltip="Total outstanding client invoice balances. Click to open Aging report."
              borderAccent="primary"
              icon={ArrowUpRight}
              sparklineData={kpis?.agingAR.map(b => b.amount) || [0, 0, 0, 0]}
              className="group-hover:border-primary/55 transition-all"
            />
          </Link>

          {/* Payables Stat */}
          <Link href="/finance/ap/aging" className="no-underline block group">
            <KPICard
              title="Payables (AP)"
              value={kpis?.payablesTotal ?? 0}
              valuePrefix="AED"
              change={kpis?.payablesOverdue ? Math.round((kpis.payablesOverdue / (kpis.payablesTotal || 1)) * 100) : 0}
              changeText="% overdue"
              trend="neutral"
              tooltip="Total outstanding registered supplier bill balances. Click to open Aging report."
              borderAccent="danger"
              icon={ArrowDownLeft}
              sparklineData={kpis?.agingAP.map(b => b.amount) || [0, 0, 0, 0]}
              className="group-hover:border-[var(--status-danger-border)] transition-all"
            />
          </Link>

          {/* Cash Position Stat */}
          <Link href="/finance/cashflow" className="no-underline block group">
            <KPICard
              title="Cash Balance"
              value={kpis?.cashPosition ?? 500000}
              valuePrefix="AED"
              trend="up"
              tooltip="Net company cash (500k AED base + client receipts - disbursements). Click to view Cash Flow Forecast."
              borderAccent="success"
              icon={DollarSign}
              sparklineData={[500000, 520000, kpis?.cashPosition ?? 500000]}
              className="group-hover:border-[var(--accent)] transition-all"
            />
          </Link>

          {/* Projected Flow Stat */}
          <Link href="/finance/cashflow" className="no-underline block group">
            <KPICard
              title="Projected Net (Wk 1)"
              value={kpis?.netWeeklyProjectedFlow ?? 0}
              valuePrefix="AED"
              change={kpis?.weeklyInflows ? Math.round((kpis.weeklyInflows / ((kpis.weeklyOutflows || 1) + kpis.weeklyInflows)) * 100) : 0}
              changeText="% inflow ratio"
              trend={(kpis?.netWeeklyProjectedFlow ?? 0) >= 0 ? 'up' : 'down'}
              tooltip="Forecasted next-week cash flow balance (inflows minus outflows). Click to view Cash Flow Forecast."
              borderAccent="accent"
              icon={ArrowRightLeft}
              sparklineData={forecast.slice(0, 4).map(w => w.netFlow) || [0, 0, 0, 0]}
              className="group-hover:border-[var(--border)] transition-all"
            />
          </Link>

          {/* VAT Compliance Stat */}
          <Link href="/finance/vat" className="no-underline block group">
            <KPICard
              title="VAT Liability"
              value={kpis?.vatLiability ?? 0}
              valuePrefix="AED"
              trend="neutral"
              tooltip="Accumulated net tax payable (output VAT minus input VAT recovery). Click to open VAT filing portal."
              borderAccent="warning"
              icon={Percent}
              sparklineData={[kpis?.vatLiability ? kpis.vatLiability * 0.9 : 0, kpis?.vatLiability ?? 0]}
              className="group-hover:border-[var(--status-warning-border)] transition-all"
            />
          </Link>

        </div>

        {/* Executive risk alerts */}
        {exec && exec.alerts.length > 0 && (
          <div className="grid md:grid-cols-2 gap-2">
            {exec.alerts.map((a, i) => (
              <div key={i} className="flex items-start gap-2 rounded p-2.5 text-xs border"
                style={{
                  background: a.level === 'danger' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                  borderColor: a.level === 'danger' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)',
                  color: a.level === 'danger' ? 'var(--status-danger-text)' : 'var(--status-warning-text)',
                }}>
                {a.level === 'danger' ? <AlertOctagon size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
                <div><div className="font-semibold">{a.title}</div><div className="opacity-90">{a.detail}</div></div>
              </div>
            ))}
          </div>
        )}

        {/* Executive KPI row */}
        {exec && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Working capital', value: exec.kpis.workingCapital, warn: exec.kpis.workingCapital < 0 },
              { label: 'Net profit (YTD)', value: exec.kpis.netProfit, warn: exec.kpis.netProfit < 0 },
              { label: 'Total commitments', value: exec.kpis.totalCommitments },
              { label: 'Projects at risk', value: exec.kpis.projectsAtRisk, count: true, warn: exec.kpis.projectsAtRisk > 0 },
            ].map(k => (
              <div key={k.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3.5">
                <div className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-wider">{k.label}</div>
                <div className="text-lg font-bold tabular-nums mt-1" style={{ color: k.warn ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>
                  {k.count ? k.value : formatAED(k.value)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Executive charts: revenue trend · AR vs AP aging · project margin */}
        {exec && (
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="flex flex-col gap-3 min-w-0">
              <h3 className="font-heading font-bold text-sm text-[var(--text-primary)] uppercase tracking-wider">Revenue Trend</h3>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={exec.revenueTrend} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" stroke="var(--text-tertiary)" fontSize={10} />
                    <YAxis stroke="var(--text-tertiary)" fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', fontSize: 11 }} />
                    <Bar dataKey="revenue" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="flex flex-col gap-3 min-w-0">
              <h3 className="font-heading font-bold text-sm text-[var(--text-primary)] uppercase tracking-wider">Receivables vs Payables Aging</h3>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={exec.arAging.map((a, i) => ({ bucket: a.bucket, AR: a.amount, AP: exec.apAging[i]?.amount || 0 }))} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="bucket" stroke="var(--text-tertiary)" fontSize={9} />
                    <YAxis stroke="var(--text-tertiary)" fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', fontSize: 11 }} />
                    <Bar dataKey="AR" fill="#2563eb" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="AP" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="flex flex-col gap-3 min-w-0">
              <h3 className="font-heading font-bold text-sm text-[var(--text-primary)] uppercase tracking-wider">Project Margin (lowest first)</h3>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={exec.topProjects} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" stroke="var(--text-tertiary)" fontSize={9} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="project_number" stroke="var(--text-tertiary)" fontSize={9} width={70} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', fontSize: 11 }} />
                    <Bar dataKey="margin" radius={[0, 3, 3, 0]}>{exec.topProjects.map((p, i) => <Cell key={i} fill={p.margin < 0 ? '#ef4444' : '#22c55e'} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )}

        {/* Rolling cash flow forecast chart */}
        <Card className="flex flex-col gap-4 min-w-0">
          <div>
            <h3 className="font-heading font-bold text-sm text-[var(--text-primary)] uppercase tracking-wider">
              13-Week Cash Flow Forecast Trend
            </h3>
            <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
              Projected rolling cumulative balance & weekly net flows
            </p>
          </div>

          <div className="h-[300px] w-full">
            {cfLoading ? (
              <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-xs font-mono">
                Calculating cash flow trajectory...
              </div>
            ) : forecast.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-xs font-mono">
                No cash flow forecast data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart data={forecast} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="startDate" stroke="var(--text-tertiary)" fontSize={10} className="font-mono" />
                  <YAxis stroke="var(--text-tertiary)" fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
                    labelStyle={{ color: 'var(--text-primary)', fontSize: '11px', fontFamily: 'monospace' }}
                    itemStyle={{ fontSize: '11px' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="cumulativeBalance" 
                    name="Projected Balance" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorBalance)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Modules Registers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
          
          {/* AR Section */}
          <Card className="flex flex-col gap-3.5">
            <div className="flex items-center gap-3 border-b border-[var(--border)] pb-2.5">
              <div className="h-8 w-8 bg-[var(--accent-glow)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)] rounded">
                <ArrowUpRight size={18} />
              </div>
              <div>
                <h3 className="font-heading font-bold text-sm uppercase text-[var(--text-primary)]">Accounts Receivable (AR)</h3>
                <p className="text-[9px] text-[var(--text-muted)] font-mono uppercase mt-0.5">Billing claims & aging collections</p>
              </div>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed flex-1">
              Track client progress claim certifications, advance recoveries, and retention ledgers. Compile compliant Tax Invoices and record cash receipts with allocations.
            </p>
            <div className="flex flex-wrap gap-2 mt-auto">
              <Link href="/finance/ar" className="no-underline">
                <Button size="sm" variant="secondary" className="text-xs font-mono text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)]">
                  Invoice Registry
                </Button>
              </Link>
              <Link href="/finance/ar/payment" className="no-underline">
                <Button size="sm" variant="secondary" className="text-xs font-mono text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)]">
                  Record Receipt
                </Button>
              </Link>
              <Link href="/finance/ar/aging" className="no-underline">
                <Button size="sm" variant="secondary" className="text-xs font-mono text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)]">
                  Receivables Aging
                </Button>
              </Link>
              <Link href="/finance/ar/statement" className="no-underline">
                <Button size="sm" variant="secondary" className="text-xs font-mono text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)]">
                  Customer Statements
                </Button>
              </Link>
            </div>
          </Card>

          {/* AP Section */}
          <Card className="flex flex-col gap-3.5">
            <div className="flex items-center gap-3 border-b border-[var(--border)] pb-2.5">
              <div className="h-8 w-8 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] flex items-center justify-center text-[var(--status-danger-text)] rounded">
                <ArrowDownLeft size={18} />
              </div>
              <div>
                <h3 className="font-heading font-bold text-sm uppercase text-[var(--text-primary)]">Accounts Payable (AP)</h3>
                <p className="text-[9px] text-[var(--text-muted)] font-mono uppercase mt-0.5">Supplier matching & disbursements</p>
              </div>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed flex-1">
              Verify incoming supplier invoices against Local Purchase Orders (LPO) and Goods Receipt Notes (GRN). Review match exceptions and approve scheduled disbursements.
            </p>
            <div className="flex flex-wrap gap-2 mt-auto">
              <Link href="/finance/ap" className="no-underline">
                <Button size="sm" variant="secondary" className="text-xs font-mono text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)]">
                  Bill Registry
                </Button>
              </Link>
              <Link href="/finance/ap/register" className="no-underline">
                <Button size="sm" variant="secondary" className="text-xs font-mono text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)]">
                  Register Invoice
                </Button>
              </Link>
              <Link href="/finance/ap/aging" className="no-underline">
                <Button size="sm" variant="secondary" className="text-xs font-mono text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)]">
                  Payables Aging
                </Button>
              </Link>
              <Link href="/finance/ap/schedule" className="no-underline">
                <Button size="sm" variant="secondary" className="text-xs font-mono text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)]">
                  Disbursements
                </Button>
              </Link>
              <Link href="/finance/grn-expense" className="no-underline">
                <Button size="sm" variant="secondary" className="text-xs font-mono text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)]">
                  GRN-to-Expense
                </Button>
              </Link>
            </div>
          </Card>

        </div>
    </div>
  );
}
