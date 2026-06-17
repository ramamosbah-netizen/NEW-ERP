'use client';
import { logger } from '@/lib/logger';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  Briefcase,
  TrendingUp,
  Wallet,
  Percent,
  ShieldAlert,
  AlertTriangle,
  Activity,
  FileText,
  ArrowRight,
  RefreshCw,
  DollarSign,
  Ticket,
  Users,
  CheckCircle,
  ShoppingCart,
  Car,
  BarChart3,
} from 'lucide-react';
import { kpiService, ExecutiveKPIs } from '@/services/kpiService';
import { useExpiryAlerts } from '@/hooks/useExpiryAlerts';
import { KPICard } from '@/components/ui/KPICard';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { TanstackDataTable } from '@/components/tables/TanstackDataTable';
import { ColumnDef } from '@tanstack/react-table';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

type Profile = {
  id: string;
  full_name: string;
  role: 'admin' | 'manager' | 'account' | 'engineer' | 'storekeeper';
  email: string;
};

const PIE_COLORS = ['#71717a', '#a1a1aa', '#3f3f46', '#52525b', '#d4d4d8', '#18181b'];

const LAUNCHPAD = [
  { href: '/tenders',          label: 'Tenders',         icon: Briefcase },
  { href: '/quotations',       label: 'Quotations',      icon: FileText },
  { href: '/projects',         label: 'Projects',        icon: CheckCircle },
  { href: '/procurement/po',   label: 'Purchase Orders', icon: ShoppingCart },
  { href: '/service-desk',     label: 'Service Desk',    icon: Ticket },
  { href: '/hr',               label: 'HR & Employees',  icon: Users },
  { href: '/fleet',            label: 'Fleet',           icon: Car },
  { href: '/finance/cashflow', label: 'Cash Flow',       icon: DollarSign },
  { href: '/finance/vat',      label: 'VAT',             icon: Percent },
  { href: '/reports',          label: 'Reports',         icon: BarChart3 },
];

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [kpiData, setKpiData] = useState<ExecutiveKPIs | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [recentTenders, setRecentTenders] = useState<any[]>([]);
  const [recentBOQs, setRecentBOQs] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'approvals' | 'tenders' | 'boqs'>('approvals');

  const { alerts: expiryAlerts, loading: alertsLoading, acknowledgeAlert } = useExpiryAlerts();

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { router.replace('/signin'); return; }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles').select('*').eq('id', user.id).single();

      if (profileError || !profileData) {
        setIsFallback(true);
        setProfile({ id: user.id, full_name: user.user_metadata.full_name || 'ERP User', role: user.user_metadata.role || 'engineer', email: user.email || '' });
      } else {
        setProfile(profileData as Profile);
      }

      const [kpis, { data: tenderList }, { data: boqList }, { data: pendingPOList }] = await Promise.all([
        kpiService.getExecutiveKPIs(),
        supabase.from('tenders').select('id, title, client_name, deadline_date, budget, status, updated_at').order('updated_at', { ascending: false }).limit(5),
        supabase.from('boqs').select('id, version, status, updated_at, tender_id').order('updated_at', { ascending: false }).limit(5),
        supabase.from('purchase_orders').select('id, po_number, supplier_name, total, status, created_at').eq('status', 'PENDING_APPROVAL').limit(5),
      ]);

      setKpiData(kpis);
      setRecentTenders(tenderList || []);
      setRecentBOQs(boqList || []);
      setPendingApprovals(pendingPOList || []);
    } catch (err) {
      logger.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAckAlert = async (id: string) => {
    await acknowledgeAlert(id);
    const kpis = await kpiService.getExecutiveKPIs();
    setKpiData(kpis);
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v) + ' AED';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="h-8 w-8 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] animate-spin rounded-full" />
        <p className="text-sm text-[var(--text-muted)]">Loading dashboard…</p>
      </div>
    );
  }

  if (!profile || !kpiData) return null;

  const statusChartData = [
    { name: 'Mobilization', value: kpiData.projectStatusCounts.mobilization },
    { name: 'In Progress',  value: kpiData.projectStatusCounts.inProgress },
    { name: 'Testing',      value: kpiData.projectStatusCounts.testing },
    { name: 'Handover',     value: kpiData.projectStatusCounts.handover },
    { name: 'DLP',          value: kpiData.projectStatusCounts.dlp },
    { name: 'On Hold',      value: kpiData.projectStatusCounts.onHold },
  ].filter(d => d.value > 0);

  const approvalColumns: ColumnDef<any>[] = [
    {
      accessorKey: 'po_number',
      header: 'LPO Number',
      cell: ({ row }) => (
        <Link href={`/procurement/po/${row.original.id}`} className="font-mono text-xs font-medium text-[var(--text-primary)] hover:underline">
          {row.original.po_number || 'PENDING'}
        </Link>
      ),
    },
    {
      accessorKey: 'supplier_name',
      header: 'Supplier',
      cell: ({ getValue }) => <span className="text-sm text-[var(--text-primary)]">{String(getValue() || '—')}</span>,
    },
    {
      accessorKey: 'total',
      header: 'Amount',
      cell: ({ getValue }) => <span className="font-mono text-xs text-[var(--text-secondary)]">{fmt(Number(getValue() || 0))}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Stage',
      cell: ({ getValue }) => <StatusChip status={String(getValue() || 'PENDING')} />,
    },
  ];

  const tenderColumns: ColumnDef<any>[] = [
    {
      accessorKey: 'title',
      header: 'Tender',
      cell: ({ row }) => (
        <Link href={`/tenders/${row.original.id}`} className="text-sm font-medium text-[var(--text-primary)] hover:underline">
          {row.original.title}
        </Link>
      ),
    },
    {
      accessorKey: 'client_name',
      header: 'Client',
      cell: ({ getValue }) => <span className="text-sm text-[var(--text-secondary)]">{String(getValue() || '—')}</span>,
    },
    {
      accessorKey: 'budget',
      header: 'Budget',
      cell: ({ getValue }) => {
        const v = getValue();
        return v ? <span className="font-mono text-xs text-[var(--text-secondary)]">{fmt(Number(v))}</span> : <span className="text-xs text-[var(--text-muted)]">—</span>;
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => <StatusChip status={String(getValue() || 'DRAFT')} />,
    },
  ];

  const boqColumns: ColumnDef<any>[] = [
    {
      accessorKey: 'version',
      header: 'Version',
      cell: ({ row }) => (
        <Link href={`/tenders/${row.original.tender_id}/boq`} className="font-mono text-xs font-medium text-[var(--text-primary)] hover:underline">
          v{row.original.version || 1}
        </Link>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => <StatusChip status={String(getValue() || 'DRAFT')} />,
    },
    {
      accessorKey: 'updated_at',
      header: 'Updated',
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-[var(--text-muted)]">
          {new Date(String(getValue())).toLocaleDateString('en-AE')}
        </span>
      ),
    },
  ];

  const tabClass = (tab: typeof activeTab) =>
    `px-3 py-2 text-xs font-medium border-b-2 cursor-pointer transition-colors duration-100 ${
      activeTab === tab
        ? 'text-[var(--text-primary)] border-[var(--text-primary)]'
        : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]'
    }`;

  return (
    <div className="flex flex-col gap-5">
      {isFallback && (
        <div className="flex gap-2.5 bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] rounded-lg p-3 text-[var(--status-warning-text)] text-xs items-start">
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
          <div>
            <strong className="font-medium">Profile sync issue</strong>
            <p className="mt-0.5 opacity-80">Could not load profile from database. Using session metadata.</p>
          </div>
        </div>
      )}

      <PageHeader
        title="Executive overview"
        subtitle={`Welcome back, ${profile.full_name}`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={fetchData}
              className="quote-btn quote-btn-secondary text-xs animate-in fade-in duration-200"
              disabled={refreshing}
            >
              <RefreshCw className={refreshing ? 'animate-spin' : ''} size={14} />
              Refresh
            </button>
            <Link href="/myday" className="no-underline">
              <button className="quote-btn quote-btn-primary text-xs flex items-center gap-1.5 cursor-pointer">
                My Day
                <ArrowRight size={14} />
              </button>
            </Link>
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard
          title="Portfolio value"
          value={kpiData.portfolioValue}
          valuePrefix="AED"
          trend={kpiData.portfolioValue > 0 ? 'up' : 'neutral'}
          tooltip="Sum contract value of active projects"
          icon={Briefcase}
          sparklineData={[kpiData.portfolioValue * 0.88, kpiData.portfolioValue * 0.94, kpiData.portfolioValue]}
        />
        <KPICard
          title="Avg gross margin"
          value={`${kpiData.averageMargin}%`}
          trend={kpiData.averageMargin > 30 ? 'up' : 'neutral'}
          tooltip="Weighted average gross margin across active projects"
          icon={Percent}
          sparklineData={[24, 28, kpiData.averageMargin]}
        />
        <KPICard
          title="Cash position"
          value={kpiData.cashPosition}
          valuePrefix="AED"
          trend="neutral"
          tooltip="Net cash based on receipts minus supplier disbursements"
          icon={Wallet}
          sparklineData={[480000, 510000, kpiData.cashPosition]}
        />
        <KPICard
          title="Active pipeline"
          value={kpiData.activePipelineValue}
          valuePrefix="AED"
          change={kpiData.activePipelineCount}
          changeText="bids"
          trend="neutral"
          tooltip="Gross value of submitted quotations awaiting award"
          icon={TrendingUp}
          sparklineData={[kpiData.activePipelineValue * 0.85, kpiData.activePipelineValue * 0.92, kpiData.activePipelineValue]}
        />
        <KPICard
          title="SLA compliance"
          value={`${kpiData.slaComplianceRate}%`}
          trend={kpiData.slaComplianceRate >= 90 ? 'up' : 'down'}
          tooltip="Service desk SLA compliance rate"
          icon={ShieldAlert}
          sparklineData={[87, 91, kpiData.slaComplianceRate]}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card
          title="Monthly performance"
          subtitle="Billed revenue vs project expenses"
          className="lg:col-span-2"
          padding={false}
        >
          <div className="h-64 px-4 pb-4 pt-2">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={kpiData.monthlyPerformance} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <ChartTooltip
                  contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px' }}
                  labelStyle={{ color: 'var(--text-primary)', fontWeight: 500 }}
                  itemStyle={{ color: 'var(--text-secondary)' }}
                />
                <Bar dataKey="billed" name="Billed" fill="var(--text-primary)" radius={[3, 3, 0, 0]} maxBarSize={20} />
                <Bar dataKey="spent"  name="Expenses" fill="var(--border-color)" radius={[3, 3, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Project phases" subtitle="Active project distribution" padding={false}>
          <div className="p-4">
            {statusChartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs text-[var(--text-muted)]">
                <Activity size={16} className="mr-1.5" />No active projects
              </div>
            ) : (
              <>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <PieChart>
                      <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={40} outerRadius={58} paddingAngle={3} dataKey="value">
                        {statusChartData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip
                        contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px' }}
                        itemStyle={{ color: 'var(--text-secondary)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  {statusChartData.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                      <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="truncate">{item.name}</span>
                      <span className="font-medium text-[var(--text-primary)] ml-auto">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Action queues */}
      <Card padding={false}>
        <div className="border-b border-[var(--border-color)] flex items-center justify-between px-4 py-3">
          <div>
            <h3 className="text-sm font-medium text-[var(--text-primary)]">Action queues</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Live records requiring attention</p>
          </div>
          <div className="flex border border-[var(--border-color)] rounded-md overflow-hidden">
            {([['approvals', `Approvals (${pendingApprovals.length})`], ['tenders', `Tenders (${recentTenders.length})`], ['boqs', `BOQ (${recentBOQs.length})`]] as const).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${activeTab === tab ? 'bg-[var(--bg-dark)] text-[var(--text-primary)]' : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          {activeTab === 'approvals' && <TanstackDataTable columns={approvalColumns} data={pendingApprovals} emptyText="No purchase orders pending approval." />}
          {activeTab === 'tenders'  && <TanstackDataTable columns={tenderColumns}   data={recentTenders}    emptyText="No tenders found." />}
          {activeTab === 'boqs'     && <TanstackDataTable columns={boqColumns}       data={recentBOQs}       emptyText="No BOQ estimates found." />}
        </div>
      </Card>

      {/* Compliance + Launchpad */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Compliance alerts */}
        <Card
          title="Compliance alerts"
          subtitle="Document expiries and renewals"
          headerActions={
            <span className="text-xs font-medium text-[var(--status-warning-text)] bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] px-2 py-0.5 rounded-md">
              {kpiData.complianceWarningsCount} pending
            </span>
          }
          padding={false}
        >
          <div className="flex flex-col divide-y divide-[var(--border-color)] max-h-72 overflow-y-auto">
            {alertsLoading ? (
              <div className="py-10 text-center text-xs text-[var(--text-muted)]">Loading alerts…</div>
            ) : expiryAlerts.length === 0 ? (
              <div className="py-10 text-center text-xs text-[var(--text-muted)] flex flex-col items-center gap-2">
                <CheckCircle size={20} className="text-[var(--success)] opacity-60" />
                All compliance items are clear.
              </div>
            ) : (
              expiryAlerts.map(alert => {
                const daysLeft = Math.ceil((new Date(alert.expiry_date).getTime() - Date.now()) / 86400000);
                const isExpired = daysLeft < 0;
                return (
                  <div key={alert.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--bg-card-hover)] transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${isExpired ? 'bg-[var(--error)]' : daysLeft <= 30 ? 'bg-[var(--warning)]' : 'bg-[var(--text-muted)]'}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                          {(alert.document as any)?.title || 'Document expiry'}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {isExpired ? 'Expired' : `${daysLeft} days remaining`} · {new Date(alert.expiry_date).toLocaleDateString('en-AE')}
                        </p>
                      </div>
                    </div>
                    <button
                      className="quote-btn quote-btn-secondary text-xs h-8 px-3 rounded-md cursor-pointer"
                      onClick={() => handleAckAlert(alert.id)}
                    >
                      Dismiss
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Module launchpad */}
        <Card title="Quick access" subtitle="Jump to any module" padding={false}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-px bg-[var(--border-color)]">
            {LAUNCHPAD.map(item => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="no-underline group bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] transition-colors p-3.5 flex items-center gap-2.5">
                  <Icon size={15} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors flex-shrink-0" />
                  <span className="text-xs font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors truncate">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
