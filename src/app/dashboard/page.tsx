'use client';

import React, { useState, useEffect } from 'react';
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
  CheckSquare,
  ArrowRight,
  RefreshCw,
  Sliders,
  DollarSign,
  Ticket,
  Users,
  Search,
  CheckCircle,
  FileSpreadsheet
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
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip as ChartTooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

type Profile = {
  id: string;
  full_name: string;
  role: 'admin' | 'manager' | 'account' | 'engineer' | 'storekeeper';
  email: string;
};

const PIE_COLORS = ['#3b82f6', '#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444'];

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [kpiData, setKpiData] = useState<ExecutiveKPIs | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Summary sections lists state
  const [recentTenders, setRecentTenders] = useState<any[]>([]);
  const [recentBOQs, setRecentBOQs] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'approvals' | 'tenders' | 'boqs'>('approvals');

  const { alerts: expiryAlerts, loading: alertsLoading, acknowledgeAlert } = useExpiryAlerts();

  const fetchSessionAndData = async () => {
    try {
      setRefreshing(true);
      // 1. Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.replace('/signin');
        return;
      }
      setUser(user);

      // 2. Fetch profile row
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError || !profileData) {
        setIsFallback(true);
        setProfile({
          id: user.id,
          full_name: user.user_metadata.full_name || 'ERP User',
          role: user.user_metadata.role || 'engineer',
          email: user.email || ''
        });
      } else {
        setProfile(profileData as Profile);
      }

      // 3. Fetch KPI Summary Data
      const kpis = await kpiService.getExecutiveKPIs();
      setKpiData(kpis);

      // 4. Fetch Tenders list for data table
      const { data: tenderList } = await supabase
        .from('tenders')
        .select('id, title, client_name, deadline_date, budget, status, updated_at')
        .order('updated_at', { ascending: false })
        .limit(5);
      setRecentTenders(tenderList || []);

      // 5. Fetch BOQs list
      const { data: boqList } = await supabase
        .from('boqs')
        .select('id, version, status, updated_at, tender_id')
        .order('updated_at', { ascending: false })
        .limit(5);
      setRecentBOQs(boqList || []);

      // 6. Fetch Pending LPOs requiring approval
      const { data: pendingPOList } = await supabase
        .from('purchase_orders')
        .select('id, po_number, supplier_name, total, status, created_at')
        .eq('status', 'PENDING_APPROVAL')
        .limit(5);
      setPendingApprovals(pendingPOList || []);

    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSessionAndData();
  }, [router]);

  const handleAckAlert = async (id: string) => {
    try {
      await acknowledgeAlert(id);
      const kpis = await kpiService.getExecutiveKPIs();
      setKpiData(kpis);
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const formatAED = (v: number) => {
    return new Intl.NumberFormat('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v) + ' AED';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060814] flex flex-col items-center justify-center text-center p-6">
        <div className="h-12 w-12 border-2 border-emerald-450 border-t-transparent animate-spin rounded-full mb-4"></div>
        <h2 className="text-xl font-bold font-heading text-white">JEET ERP</h2>
        <p className="text-slate-400 text-xs mt-1 font-mono uppercase tracking-wider">Aggregating executive cockpit parameters...</p>
      </div>
    );
  }

  if (!profile || !kpiData) return null;

  // Recharts Project delivery phases dataset
  const statusChartData = [
    { name: 'Mobilization', value: kpiData.projectStatusCounts.mobilization },
    { name: 'In Progress', value: kpiData.projectStatusCounts.inProgress },
    { name: 'Testing', value: kpiData.projectStatusCounts.testing },
    { name: 'Handover', value: kpiData.projectStatusCounts.handover },
    { name: 'DLP (Warranty)', value: kpiData.projectStatusCounts.dlp },
    { name: 'On Hold', value: kpiData.projectStatusCounts.onHold },
  ].filter(item => item.value > 0);

  // Column definitions for the recent/pending tables
  const approvalColumns: ColumnDef<any>[] = [
    {
      accessorKey: 'po_number',
      header: 'LPO Number',
      cell: ({ row }) => (
        <Link 
          href={`/procurement/po/${row.original.id}`}
          className="text-primary hover:underline font-mono font-bold"
        >
          {row.original.po_number || 'LPO-PENDING'}
        </Link>
      )
    },
    {
      accessorKey: 'supplier_name',
      header: 'Supplier Name',
      cell: ({ getValue }) => <span className="font-semibold text-text-primary">{String(getValue() || 'Unspecified')}</span>
    },
    {
      accessorKey: 'total',
      header: 'Total Amount',
      cell: ({ getValue }) => <span className="font-mono text-success font-bold">{formatAED(Number(getValue() || 0))}</span>
    },
    {
      accessorKey: 'status',
      header: 'Approval Stage',
      cell: ({ getValue }) => <StatusChip status={String(getValue() || 'PENDING')} />
    }
  ];

  const tenderColumns: ColumnDef<any>[] = [
    {
      accessorKey: 'title',
      header: 'Tender Name',
      cell: ({ row }) => (
        <Link 
          href={`/tenders/${row.original.id}`}
          className="text-secondary hover:underline font-bold"
        >
          {row.original.title}
        </Link>
      )
    },
    {
      accessorKey: 'client_name',
      header: 'Client Agency'
    },
    {
      accessorKey: 'budget',
      header: 'Estimated Sum',
      cell: ({ getValue }) => {
        const val = getValue();
        return val ? <span className="font-mono">{formatAED(Number(val))}</span> : <span className="text-text-muted">Unspecified</span>;
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => <StatusChip status={String(getValue() || 'Draft')} />
    }
  ];

  const boqColumns: ColumnDef<any>[] = [
    {
      accessorKey: 'version',
      header: 'BOQ Version',
      cell: ({ row }) => (
        <Link 
          href={`/tenders/${row.original.tender_id}/boq`}
          className="text-primary hover:underline font-mono font-bold"
        >
          v{row.original.version || 1} Estimations
        </Link>
      )
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => <StatusChip status={String(getValue() || 'draft')} />
    },
    {
      accessorKey: 'updated_at',
      header: 'Last Calibrated',
      cell: ({ getValue }) => <span className="font-mono text-[10px] text-text-muted">{new Date(String(getValue())).toLocaleDateString()}</span>
    }
  ];

  return (
    <div className="flex flex-col gap-6 relative">
      {/* Warning banner if fallback profiles table */}
      {isFallback && (
        <div className="flex gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-amber-200 text-xs items-start">
          <AlertTriangle className="flex-shrink-0 text-amber-400 mt-0.5" size={18} />
          <div>
            <strong>Profile Sync Mode Active</strong>
            <p className="mt-1 leading-relaxed">
              Unable to locate a matching profile record in database. Administrative permissions set from authenticated session attributes.
            </p>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-4">
        <div>
          <h1 className="font-heading font-extrabold text-2xl tracking-tight text-slate-100 uppercase">
            Corporate Operations Executive (COE) Cockpit
          </h1>
          <p className="text-[10px] text-emerald-450 font-mono tracking-widest uppercase mt-0.5">
            Unified contract sums · realized margin · liquid cash flow · risk matrix
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchSessionAndData}
            isLoading={refreshing}
            className="flex items-center gap-1.5"
          >
            Refresh Cockpit
          </Button>
          <Link href="/finance" className="no-underline">
            <Button size="sm" variant="primary" className="font-extrabold flex items-center gap-1.5">
              Open Finance Hub <ArrowRight size={13} />
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title="Portfolio Value"
          value={kpiData.portfolioValue}
          valuePrefix="AED"
          trend={kpiData.portfolioValue > 0 ? 'up' : 'neutral'}
          tooltip="Sum contract value of active projects (excludes submitted/lost/cancelled)"
          borderAccent="primary"
          icon={Briefcase}
          sparklineData={[kpiData.portfolioValue * 0.9, kpiData.portfolioValue * 0.95, kpiData.portfolioValue]}
        />
        <KPICard
          title="Avg Margin"
          value={`${kpiData.averageMargin}%`}
          trend={kpiData.averageMargin > 30 ? 'up' : 'neutral'}
          tooltip="Weighted gross margin average computed from project actual material + labour costs"
          borderAccent="success"
          icon={Percent}
          sparklineData={[25, 28, kpiData.averageMargin]}
        />
        <KPICard
          title="Cash Position"
          value={kpiData.cashPosition}
          valuePrefix="AED"
          trend="up"
          tooltip="Net cash in hand based on client payments (receipts) minus supplier disbursements"
          borderAccent="secondary"
          icon={Wallet}
          sparklineData={[500000, 520000, kpiData.cashPosition]}
        />
        <KPICard
          title="Active Pipeline"
          value={kpiData.activePipelineValue}
          valuePrefix="AED"
          change={kpiData.activePipelineCount}
          changeText="bids pending"
          trend="neutral"
          tooltip="Gross estimated commercial sum of pre-award quotations currently in submitted state"
          borderAccent="accent"
          icon={TrendingUp}
          sparklineData={[kpiData.activePipelineValue * 0.85, kpiData.activePipelineValue * 0.92, kpiData.activePipelineValue]}
        />
        <KPICard
          title="SLA Compliance"
          value={`${kpiData.slaComplianceRate}%`}
          trend={kpiData.slaComplianceRate >= 90 ? 'up' : 'down'}
          tooltip="Service desk response & resolution SLA compliance percentage rate"
          borderAccent="warning"
          icon={ShieldAlert}
          sparklineData={[88, 92, kpiData.slaComplianceRate]}
        />
      </div>

      {/* Main Grid Section: Charts on Left, Funnel on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 flex flex-col gap-4 min-w-0" borderAccent="none">
          <div>
            <h3 className="font-heading font-bold text-sm text-slate-200 uppercase tracking-wider">
              Monthly Performance (Billed vs Spent)
            </h3>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              Tax Invoices generated vs Supplier expenses registered (excl VAT)
            </p>
          </div>
          
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kpiData.monthlyPerformance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" stroke="#475569" fontSize={10} className="font-mono" />
                <YAxis stroke="#475569" fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <ChartTooltip 
                  contentStyle={{ backgroundColor: '#090e24', borderColor: 'rgba(255,255,255,0.1)' }}
                  labelStyle={{ color: '#fff', fontSize: '12px' }}
                  itemStyle={{ fontSize: '11px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="billed" name="Billed Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="spent" name="Project Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="flex flex-col gap-4 min-w-0" borderAccent="none">
          <div>
            <h3 className="font-heading font-bold text-sm text-slate-200 uppercase tracking-wider">
              Project Delivery Funnel
            </h3>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              Distribution of projects by active execution phase
            </p>
          </div>

          <div className="h-[200px] w-full relative flex items-center justify-center">
            {statusChartData.length === 0 ? (
              <span className="text-slate-500 text-xs font-mono">No active projects to display</span>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip 
                    contentStyle={{ backgroundColor: '#090e24', borderColor: 'rgba(255,255,255,0.1)' }}
                    itemStyle={{ color: '#fff', fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-auto">
            {statusChartData.map((item, idx) => (
              <div key={item.name} className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></span>
                <span className="truncate flex-1">{item.name}</span>
                <span className="font-bold text-slate-200">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Interactive Tabs for Approvals, Tenders, and BOQ lists using TanstackDataTable */}
      <Card className="flex flex-col gap-4" borderAccent="none">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/5 pb-2">
          <div>
            <h3 className="font-heading font-bold text-sm text-slate-200 uppercase tracking-wider">
              Recent Action Registers & Queues
            </h3>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              Live queues computed directly from database audit triggers
            </p>
          </div>
          
          <div className="flex gap-1.5 bg-bg-dark border border-border-color p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('approvals')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'approvals' 
                  ? 'bg-primary/10 text-primary shadow-[0_0_8px_var(--primary-glow)]' 
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Approval Queue ({pendingApprovals.length})
            </button>
            <button
              onClick={() => setActiveTab('tenders')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'tenders' 
                  ? 'bg-primary/10 text-primary shadow-[0_0_8px_var(--primary-glow)]' 
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Tenders Summary ({recentTenders.length})
            </button>
            <button
              onClick={() => setActiveTab('boqs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'boqs' 
                  ? 'bg-primary/10 text-primary shadow-[0_0_8px_var(--primary-glow)]' 
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              BOQ Estimates ({recentBOQs.length})
            </button>
          </div>
        </div>

        {activeTab === 'approvals' && (
          <TanstackDataTable
            columns={approvalColumns}
            data={pendingApprovals}
            emptyText="No local purchase orders pending executive authorization."
          />
        )}

        {activeTab === 'tenders' && (
          <TanstackDataTable
            columns={tenderColumns}
            data={recentTenders}
            emptyText="No tenders found in the system database."
          />
        )}

        {activeTab === 'boqs' && (
          <TanstackDataTable
            columns={boqColumns}
            data={recentBOQs}
            emptyText="No BOQ estimates registered."
          />
        )}
      </Card>

      {/* Compliance alerts and launcher */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance warnings */}
        <Card className="flex flex-col gap-3 min-h-[300px]" borderAccent="warning">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <div>
              <h3 className="font-heading font-bold text-sm text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="text-amber-400" size={16} />
                Risk & Compliance Feed
              </h3>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                Document expiries, Mulkiya, visas & contract renewals pending
              </p>
            </div>
            <span className="bg-amber-400/10 text-amber-400 border border-amber-400/20 text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold">
              {kpiData.complianceWarningsCount} Pending Alerts
            </span>
          </div>

          <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto max-h-[280px] pr-1">
            {alertsLoading ? (
              <span className="text-slate-500 text-xs font-mono py-8 text-center">Loading compliance alerts...</span>
            ) : expiryAlerts.length === 0 ? (
              <div className="text-slate-500 text-xs font-mono py-12 text-center flex flex-col items-center gap-2">
                <Activity size={24} className="opacity-30" />
                <span>No compliance warnings active. System secure.</span>
              </div>
            ) : (
              expiryAlerts.map(alert => {
                const daysLeft = Math.ceil(
                  (new Date(alert.expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)
                );
                const isExpired = daysLeft < 0;

                return (
                  <div 
                    key={alert.id} 
                    className="bg-[#0b0f2a] border border-white/5 rounded p-3 flex justify-between items-center hover:border-white/10 transition-all"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-slate-200 truncate max-w-[260px]">
                        {(alert.document as any)?.title || 'Document Expiry'}
                      </span>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 font-mono">
                        <span>Expiry: {new Date(alert.expiry_date).toLocaleDateString('en-AE')}</span>
                        <span>•</span>
                        <span className={isExpired ? 'text-red-400 font-bold' : daysLeft <= 30 ? 'text-amber-400 font-bold' : ''}>
                          {isExpired ? 'Expired' : `${daysLeft} days remaining`}
                        </span>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={() => handleAckAlert(alert.id)}
                      className="bg-slate-900 border border-white/10 hover:bg-slate-800 text-[10px] font-mono"
                    >
                      Dismiss
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Launchpad shortcuts */}
        <Card className="flex flex-col gap-4" borderAccent="none">
          <div>
            <h3 className="font-heading font-bold text-sm text-slate-200 uppercase tracking-wider">
              Module Launchpad
            </h3>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              Quick entry points to main command registers
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { href: '/tenders', label: 'Tenders Hub', icon: FileText, color: 'text-indigo-400' },
              { href: '/quotations', label: 'Quotations', icon: FileText, color: 'text-cyan-400' },
              { href: '/projects', label: 'Projects Registry', icon: Briefcase, color: 'text-emerald-400' },
              { href: '/procurement/po', label: 'Purchase Orders', icon: Sliders, color: 'text-purple-400' },
              { href: '/service-desk', label: 'Service Desk', icon: Ticket, color: 'text-amber-400' },
              { href: '/hr', label: 'HR & Employees', icon: Users, color: 'text-pink-400' },
              { href: '/fleet', label: 'Fleet Registry', icon: Sliders, color: 'text-sky-400' },
              { href: '/finance/cashflow', label: 'Cash Flow Forecast', icon: DollarSign, color: 'text-emerald-400' },
              { href: '/finance/vat', label: 'VAT compliance', icon: Percent, color: 'text-purple-400' },
            ].map(item => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="no-underline group">
                  <div className="bg-[#0b0f2a] border border-white/5 hover:border-emerald-450/30 p-3 rounded flex flex-col gap-2 h-full transition-all cursor-pointer">
                    <Icon className={`${item.color} group-hover:scale-110 transition-transform`} size={18} />
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-300 group-hover:text-white truncate">
                        {item.label}
                      </span>
                      <ArrowRight size={10} className="text-slate-600 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
