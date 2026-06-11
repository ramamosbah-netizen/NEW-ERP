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
  RefreshCw
} from 'lucide-react';
import { kpiService, FinanceKPIs } from '@/services/kpiService';
import { useCashFlow } from '@/hooks/useCashFlow';
import { KPICard } from '@/components/ui/KPICard';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function FinanceDashboard() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<FinanceKPIs | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch live stats from kpiService
  const loadFinanceData = async () => {
    try {
      setRefreshing(true);
      const data = await kpiService.getFinanceKPIs();
      setKpis(data);
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
      <div className="min-h-screen bg-[#060814] flex flex-col items-center justify-center text-center p-6">
        <div className="h-12 w-12 border-2 border-emerald-400 border-t-transparent animate-spin rounded-full mb-4"></div>
        <h2 className="text-xl font-bold font-heading text-white">JEET ERP</h2>
        <p className="text-slate-400 text-xs mt-1">Aggregating financial ledger data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060814] text-slate-100 flex flex-col font-sans">
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col gap-6">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-4">
          <div>
            <h1 className="font-heading font-extrabold text-2xl tracking-tight text-slate-100 uppercase">
              Financial Operations Command
            </h1>
            <p className="text-[10px] text-emerald-400 font-mono tracking-widest uppercase mt-0.5">
              Client billing · supplier aging · quarterly vat compliance · rolling forecast
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadFinanceData}
              disabled={refreshing}
              className="text-slate-300 border-white/10 hover:bg-white/5 flex items-center gap-1.5"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Link href="/finance/ar/create" className="no-underline">
              <Button size="sm" className="bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold">
                + Create Client Invoice
              </Button>
            </Link>
            <Link href="/finance/ap/register" className="no-underline">
              <Button size="sm" variant="secondary" className="text-slate-200 border-white/10 hover:bg-white/5 font-bold">
                + Register Supplier Bill
              </Button>
            </Link>
          </div>
        </div>

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
              className="group-hover:border-red-500/55 transition-all"
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
              className="group-hover:border-emerald-400/55 transition-all"
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
              className="group-hover:border-cyan-400/55 transition-all"
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
              className="group-hover:border-amber-400/55 transition-all"
            />
          </Link>

        </div>

        {/* Rolling cash flow forecast chart */}
        <Card className="flex flex-col gap-4 min-w-0">
          <div>
            <h3 className="font-heading font-bold text-sm text-slate-200 uppercase tracking-wider">
              13-Week Cash Flow Forecast Trend
            </h3>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              Projected rolling cumulative balance & weekly net flows
            </p>
          </div>

          <div className="h-[300px] w-full">
            {cfLoading ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs font-mono">
                Calculating cash flow trajectory...
              </div>
            ) : forecast.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs font-mono">
                No cash flow forecast data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecast} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="startDate" stroke="#475569" fontSize={10} className="font-mono" />
                  <YAxis stroke="#475569" fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#090e24', borderColor: 'rgba(255,255,255,0.1)' }}
                    labelStyle={{ color: '#fff', fontSize: '11px', fontFamily: 'monospace' }}
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
            <div className="flex items-center gap-3 border-b border-white/5 pb-2.5">
              <div className="h-8 w-8 bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 rounded">
                <ArrowUpRight size={18} />
              </div>
              <div>
                <h3 className="font-heading font-bold text-sm uppercase text-slate-200">Accounts Receivable (AR)</h3>
                <p className="text-[9px] text-slate-500 font-mono uppercase mt-0.5">Billing claims & aging collections</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed flex-1">
              Track client progress claim certifications, advance recoveries, and retention ledgers. Compile compliant Tax Invoices and record cash receipts with allocations.
            </p>
            <div className="flex flex-wrap gap-2 mt-auto">
              <Link href="/finance/ar" className="no-underline">
                <Button size="sm" variant="secondary" className="text-xs font-mono text-slate-300 border-white/10 hover:bg-white/5">
                  Invoice Registry
                </Button>
              </Link>
              <Link href="/finance/ar/payment" className="no-underline">
                <Button size="sm" variant="secondary" className="text-xs font-mono text-slate-300 border-white/10 hover:bg-white/5">
                  Record Receipt
                </Button>
              </Link>
              <Link href="/finance/ar/aging" className="no-underline">
                <Button size="sm" variant="secondary" className="text-xs font-mono text-slate-300 border-white/10 hover:bg-white/5">
                  Receivables Aging
                </Button>
              </Link>
              <Link href="/finance/ar/statement" className="no-underline">
                <Button size="sm" variant="secondary" className="text-xs font-mono text-slate-300 border-white/10 hover:bg-white/5">
                  Customer Statements
                </Button>
              </Link>
            </div>
          </Card>

          {/* AP Section */}
          <Card className="flex flex-col gap-3.5">
            <div className="flex items-center gap-3 border-b border-white/5 pb-2.5">
              <div className="h-8 w-8 bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 rounded">
                <ArrowDownLeft size={18} />
              </div>
              <div>
                <h3 className="font-heading font-bold text-sm uppercase text-slate-200">Accounts Payable (AP)</h3>
                <p className="text-[9px] text-slate-500 font-mono uppercase mt-0.5">Supplier matching & disbursements</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed flex-1">
              Verify incoming supplier invoices against Local Purchase Orders (LPO) and Goods Receipt Notes (GRN). Review match exceptions and approve scheduled disbursements.
            </p>
            <div className="flex flex-wrap gap-2 mt-auto">
              <Link href="/finance/ap" className="no-underline">
                <Button size="sm" variant="secondary" className="text-xs font-mono text-slate-300 border-white/10 hover:bg-white/5">
                  Bill Registry
                </Button>
              </Link>
              <Link href="/finance/ap/register" className="no-underline">
                <Button size="sm" variant="secondary" className="text-xs font-mono text-slate-300 border-white/10 hover:bg-white/5">
                  Register Invoice
                </Button>
              </Link>
              <Link href="/finance/ap/aging" className="no-underline">
                <Button size="sm" variant="secondary" className="text-xs font-mono text-slate-300 border-white/10 hover:bg-white/5">
                  Payables Aging
                </Button>
              </Link>
              <Link href="/finance/ap/schedule" className="no-underline">
                <Button size="sm" variant="secondary" className="text-xs font-mono text-slate-300 border-white/10 hover:bg-white/5">
                  Disbursements
                </Button>
              </Link>
            </div>
          </Card>

        </div>
      </main>
    </div>
  );
}
