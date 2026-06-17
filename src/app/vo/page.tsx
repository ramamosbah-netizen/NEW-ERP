// ============================================================
// JEET ERP — Variation Orders (VO) Global Registry
// Routes: /vo
// Theme: Bloomberg Terminal Electric Mint
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useVOs } from '@/hooks/useVOs';
import { VO_STATUS_COLORS, VO_STATUS_LABELS, VO_TYPE_LABELS, VO_WORK_STATUS_LABELS } from '@/constants/vo.constants';
import type { VOStatus, VOType } from '@/types/vo.types';
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  ShieldAlert, 
  TrendingUp, 
  DollarSign, 
  RefreshCw, 
  ArrowRight,
  TrendingDown
} from 'lucide-react';

export default function VORegistryPage() {
  // Filters state
  const [search, setSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<VOStatus | ''>('');
  const [selectedType, setSelectedType] = useState<VOType | ''>('');
  const [isAtRisk, setIsAtRisk] = useState<boolean | 'ALL'>('ALL');

  // DB Options for filtering
  const [projects, setProjects] = useState<any[]>([]);

  // Fetch VOs with custom hook using filters
  const filtersPayload = {
    search: search || undefined,
    project_id: selectedProjectId || undefined,
    status: selectedStatus || undefined,
    vo_type: selectedType || undefined,
    proceed_at_risk: isAtRisk === 'ALL' ? undefined : isAtRisk
  };

  const { vos, loading, error, refetch } = useVOs(filtersPayload);

  // Load project references for the dropdown
  useEffect(() => {
    supabase
      .from('projects')
      .select('id, name, project_number')
      .eq('is_active', true)
      .order('project_number', { ascending: true })
      .then(({ data }) => setProjects(data || []));
  }, []);

  const formatAED = (v: number) => {
    return new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' AED';
  };

  // Calculate global summary KPIs from the fetched dataset
  const totalApprovedAmount = vos
    .filter(vo => vo.status === 'CLIENT_APPROVED')
    .reduce((sum, vo) => sum + Number(vo.sell_amount || 0), 0);

  const totalApprovedCount = vos.filter(vo => vo.status === 'CLIENT_APPROVED').length;

  const totalPendingAmount = vos
    .filter(vo => !['CLIENT_APPROVED', 'CANCELLED', 'CLIENT_REJECTED', 'SUPERSEDED'].includes(vo.status))
    .reduce((sum, vo) => sum + Number(vo.sell_amount || 0), 0);

  const totalPendingCount = vos.filter(vo => !['CLIENT_APPROVED', 'CANCELLED', 'CLIENT_REJECTED', 'SUPERSEDED'].includes(vo.status)).length;

  const totalAtRiskExposure = vos
    .filter(vo => vo.proceed_at_risk && vo.status !== 'CLIENT_APPROVED')
    .reduce((sum, vo) => sum + Number(vo.sell_amount || 0), 0);

  const totalAtRiskCount = vos.filter(vo => vo.proceed_at_risk && vo.status !== 'CLIENT_APPROVED').length;

  const averageMargin = vos.length > 0 
    ? vos.reduce((sum, vo) => {
        const sell = Number(vo.sell_amount) || 0;
        const cost = Number(vo.cost_amount) || 0;
        if (sell === 0) return sum + 100; // defaults to 100% margin on pure cost omission/credits if needed
        return sum + ((sell - cost) / sell) * 100;
      }, 0) / vos.length
    : 0;

  return (
    <div className="text-[var(--text-primary)] flex flex-col font-sans">
<main className="flex flex-col gap-5">
        
        {/* Header Title Bar */}
        <div className="flex justify-between items-center">
          <div>
            <div className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">
              Commercial & Billing Operations
            </div>
            <h1 className="font-heading font-extrabold text-2xl tracking-tight text-[var(--text-primary)] uppercase mt-1">
              Variation Orders Registry (VO)
            </h1>
          </div>

          <div className="flex gap-2">
            <Link
              href="/vo/create"
              className="px-3.5 py-2 bg-[var(--accent)] text-[var(--text-primary)] font-bold font-mono text-[11px] rounded hover:bg-[var(--accent)] transition-all uppercase flex items-center gap-1.5 shadow-[0_0_15px_var(--accent-glow)] cursor-pointer"
            >
              <Plus size={13} /> Capture New VO
            </Link>
            <button
              onClick={() => refetch()}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-2 rounded hover:bg-[var(--surface-hover)] border border-[var(--border)] hover:border-[var(--border)] transition-all cursor-pointer"
              title="Refresh Registry"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Global KPI Summary Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-4 flex flex-col justify-between">
            <div>
              <span className="text-[var(--text-muted)] block uppercase font-mono text-[9px]">Approved variations</span>
              <span className="font-mono text-lg font-extrabold text-[var(--accent)] mt-1 block">
                +{formatAED(totalApprovedAmount)}
              </span>
            </div>
            <span className="text-[10px] text-[var(--text-secondary)] font-mono mt-2 block">
              {totalApprovedCount} signed client variations
            </span>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-4 flex flex-col justify-between">
            <div>
              <span className="text-[var(--text-muted)] block uppercase font-mono text-[9px]">Pending client sign-off</span>
              <span className="font-mono text-lg font-extrabold text-[var(--status-warning-text)] mt-1 block">
                {formatAED(totalPendingAmount)}
              </span>
            </div>
            <span className="text-[10px] text-[var(--text-secondary)] font-mono mt-2 block">
              {totalPendingCount} variations in review cycle
            </span>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-4 flex flex-col justify-between">
            <div>
              <span className="text-[var(--text-muted)] block uppercase font-mono text-[9px]">Proceed At-Risk Exposure</span>
              <span className="font-mono text-lg font-extrabold text-[var(--status-danger-text)] mt-1 block">
                {formatAED(totalAtRiskExposure)}
              </span>
            </div>
            <span className="text-[10px] text-[var(--status-danger-text)] font-mono mt-2 block flex items-center gap-1 font-bold">
              <ShieldAlert size={10} className="animate-pulse" /> {totalAtRiskCount} variations executing at risk
            </span>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-4 flex flex-col justify-between">
            <div>
              <span className="text-[var(--text-muted)] block uppercase font-mono text-[9px]">Average Gross Margin</span>
              <span className="font-mono text-lg font-extrabold text-[var(--text-primary)] mt-1 block">
                {averageMargin.toFixed(1)}%
              </span>
            </div>
            <span className="text-[10px] text-[var(--text-secondary)] font-mono mt-2 block">
              Direct profitability ratio
            </span>
          </div>
        </div>

        {/* Filter Strip */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-4 flex flex-col gap-4">
          <div className="text-[10px] font-mono text-[var(--accent)] uppercase tracking-widest flex items-center gap-1.5">
            <Filter size={11} /> Filter & Search Engine
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5">
            {/* Search Box */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[var(--text-muted)]">
                <Search size={12} />
              </span>
              <input
                type="text"
                placeholder="Search VO # or title..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-1.5 pl-8 pr-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] font-mono"
              />
            </div>

            {/* Project Select */}
            <div>
              <select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-1.5 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] font-mono"
              >
                <option value="">All Projects</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.project_number} — {p.name}</option>
                ))}
              </select>
            </div>

            {/* Status Select */}
            <div>
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value as any)}
                className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-1.5 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] font-mono"
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PRICED">Priced</option>
                <option value="PENDING_INTERNAL">Pending Internal Approval</option>
                <option value="INTERNALLY_APPROVED">Internally Approved</option>
                <option value="SUBMITTED_TO_CLIENT">Submitted to Client</option>
                <option value="CLIENT_APPROVED">Client Approved</option>
                <option value="CLIENT_REJECTED">Client Rejected</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {/* Type Select */}
            <div>
              <select
                value={selectedType}
                onChange={e => setSelectedType(e.target.value as any)}
                className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-1.5 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] font-mono"
              >
                <option value="">All VO Types</option>
                <option value="ADDITION">Addition (New Scope)</option>
                <option value="OMISSION">Omission (Scope Credit)</option>
                <option value="SUBSTITUTION">Substitution</option>
                <option value="RATE_CHANGE">Rate Change</option>
                <option value="DAYWORKS">Dayworks (T&M)</option>
                <option value="PROVISIONAL_SUM_ADJ">Provisional Sum Adj</option>
              </select>
            </div>

            {/* Risk filter */}
            <div>
              <select
                value={isAtRisk.toString()}
                onChange={e => {
                  const val = e.target.value;
                  if (val === 'ALL') setIsAtRisk('ALL');
                  else setIsAtRisk(val === 'true');
                }}
                className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-1.5 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] font-mono"
              >
                <option value="ALL">All Risk Levels</option>
                <option value="true">⚠️ Proceed At-Risk Only</option>
                <option value="false">Approved / Regular Scope</option>
              </select>
            </div>
          </div>
        </div>

        {/* Master Registry Table */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)] font-mono text-xs gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border border-[var(--border)] border-t-emerald-400"></div>
              <span>Fetching Variations Ledger...</span>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-[var(--status-danger-text)] font-mono text-xs">
              Error fetching records: {error.message}
            </div>
          ) : vos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)] font-mono text-xs gap-2">
              <FileText size={28} className="text-[var(--text-tertiary)]" />
              <span>No Variation Orders found matching the criteria.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--text-secondary)] font-mono text-[10px] uppercase bg-[var(--bg-card)]">
                    <th className="py-3 px-4">Project</th>
                    <th className="py-3 px-4">VO #</th>
                    <th className="py-3 px-4">Title / Instruction Ref</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-right">Selling Value</th>
                    <th className="py-3 px-4 text-center">Margin</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] font-mono text-xs text-[var(--text-secondary)]">
                  {vos.map((vo) => {
                    const colors = VO_STATUS_COLORS[vo.status] || { bg: 'rgba(0,0,0,0.1)', text: '#fff', border: 'rgba(0,0,0,0.2)' };
                    const sell = Number(vo.sell_amount || 0);
                    const cost = Number(vo.cost_amount || 0);
                    const marginPercent = sell !== 0 ? ((sell - cost) / sell) * 100 : 0;

                    return (
                      <tr key={vo.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                        <td className="py-3 px-4 max-w-xs truncate" title={vo.project_name}>
                          <div className="font-semibold text-[var(--text-primary)]">{vo.project_number}</div>
                          <div className="text-[10px] text-[var(--text-muted)] truncate">{vo.project_name}</div>
                        </td>
                        <td className="py-3 px-4 font-bold text-[var(--text-primary)]">
                          {vo.vo_number}
                          {vo.proceed_at_risk && vo.status !== 'CLIENT_APPROVED' && (
                            <span className="ml-1.5 px-1.5 py-0.5 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] text-[8px] rounded uppercase font-extrabold animate-pulse">
                              AT RISK
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate" title={vo.title}>
                          <div className="font-semibold text-[var(--text-primary)] truncate">{vo.title}</div>
                          <div className="text-[10px] text-[var(--text-muted)] truncate">Ref: {vo.instruction_reference}</div>
                        </td>
                        <td className="py-3 px-4 text-[10px] text-[var(--text-secondary)]">
                          {VO_TYPE_LABELS[vo.vo_type] || vo.vo_type}
                        </td>
                        <td className={`py-3 px-4 text-right font-bold ${sell < 0 ? 'text-[var(--status-danger-text)]' : 'text-[var(--text-primary)]'}`}>
                          {sell < 0 ? '-' : ''}{new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(sell))} AED
                        </td>
                        <td className={`py-3 px-4 text-center font-bold ${marginPercent < 20 ? 'text-[var(--status-danger-text)]' : 'text-[var(--accent)]'}`}>
                          {marginPercent.toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            style={{
                              backgroundColor: colors.bg,
                              color: colors.text,
                              borderColor: colors.border
                            }}
                            className="px-2 py-0.5 rounded border text-[9px] font-extrabold uppercase inline-block"
                          >
                            {VO_STATUS_LABELS[vo.status] || vo.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Link
                            href={`/vo/${vo.id}`}
                            className="text-[var(--accent)] hover:text-[var(--accent)] font-bold text-[10px] flex items-center justify-center gap-0.5 hover:underline cursor-pointer"
                          >
                            Manage <ArrowRight size={10} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
