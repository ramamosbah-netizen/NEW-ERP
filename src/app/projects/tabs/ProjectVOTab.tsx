// ============================================================
// JEET ERP — Project Variation Orders (VO) Tab
// Location: src/app/projects/tabs/ProjectVOTab.tsx
// Theme: Bloomberg Terminal Electric Mint
// ============================================================

'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useVOs, useProjectVOSummary } from '@/hooks/useVOs';
import { VO_STATUS_COLORS, VO_STATUS_LABELS, VO_TYPE_LABELS, VO_WORK_STATUS_LABELS } from '@/constants/vo.constants';
import { FileText, Plus, ShieldAlert, CheckCircle, RefreshCw, BarChart2, ArrowRight } from 'lucide-react';

interface ProjectVOTabProps {
  projectId: string;
}

export default function ProjectVOTab({ projectId }: ProjectVOTabProps) {
  const router = useRouter();
  const { vos, loading: listLoading, error: listError, refetch: refetchList } = useVOs({ project_id: projectId });
  const { summary, loading: sumLoading, error: sumError, refetch: refetchSummary } = useProjectVOSummary(projectId);

  const handleRefetch = () => {
    refetchList();
    refetchSummary();
  };

  const formatAED = (v: number) => {
    return new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' AED';
  };

  const loading = listLoading || sumLoading;
  const error = listError || sumError;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[var(--text-primary)]0 font-mono text-xs gap-3">
        <div className="animate-spin rounded-full h-5 w-5 border border-[var(--border)] border-t-emerald-400"></div>
        <span>Compiling Variation Order registries & contract impact metrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] p-4 rounded text-xs font-mono flex items-start gap-2">
        <ShieldAlert size={16} className="shrink-0" />
        <div>
          <span>Failed to load variation order records: {error?.message || 'Error occurred'}</span>
          <button onClick={handleRefetch} className="block mt-2 text-[var(--accent)] hover:underline">
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      
      {/* Title & Actions */}
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider font-bold flex items-center gap-2">
          <BarChart2 size={16} /> Scope Variations & Contract Adjustments
        </h3>
        <div className="flex items-center gap-2">
          <Link
            href={`/vo/create?projectId=${projectId}`}
            className="px-3 py-1.5 bg-[var(--accent)] text-white font-bold font-mono text-[10px] rounded hover:bg-[var(--accent)] transition-all uppercase flex items-center gap-1 cursor-pointer"
          >
            <Plus size={11} /> Create Variation
          </Link>
          <button
            onClick={handleRefetch}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1.5 rounded hover:bg-[var(--surface-hover)] border border-[var(--border)] hover:border-[var(--border)] transition-all cursor-pointer"
            title="Recalculate Variations"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Exposure / proceed-at-risk warning flag */}
      {summary && summary.atRiskExposure > 0 && (
        <div className="bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] p-4 rounded flex gap-3 items-start leading-relaxed font-sans text-xs">
          <ShieldAlert size={20} className="text-[var(--status-danger-text)] shrink-0 mt-0.5 animate-pulse" />
          <div>
            <strong className="block text-[var(--status-danger-text)] font-bold mb-0.5">⚠️ Proceed-At-Risk Exposure Alert</strong>
            <span>
              This project has an at-risk exposure of <strong className="text-[var(--status-danger-text)]">{formatAED(summary.atRiskExposure)}</strong> from variation works that have started or completed on site before obtaining client approval. Internal margins could be compromised if formal client instructions are not signed off.
            </span>
          </div>
        </div>
      )}

      {/* Primary KPI Grid */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-4">
            <span className="text-[var(--text-primary)]0 block uppercase font-mono text-[9px]">Original Value</span>
            <span className="font-mono text-base font-extrabold text-[var(--text-primary)] mt-1 block">
              {formatAED(summary.originalContract)}
            </span>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-4">
            <span className="text-[var(--text-primary)]0 block uppercase font-mono text-[9px]">Approved variations</span>
            <span className="font-mono text-base font-extrabold text-[var(--accent)] mt-1 block">
              {summary.approvedVOs >= 0 ? '+' : ''}{formatAED(summary.approvedVOs)}
            </span>
            <span className="text-[10px] text-[var(--text-primary)]0 font-mono mt-0.5 block">
              {summary.voCount} client approved variations
            </span>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-4">
            <span className="text-[var(--text-primary)]0 block uppercase font-mono text-[9px]">Revised Value</span>
            <span className="font-mono text-base font-extrabold text-[var(--text-primary)] mt-1 block">
              {formatAED(summary.revisedContract)}
            </span>
            <span className="text-[10px] text-[var(--text-primary)]0 font-mono mt-0.5 block">
              {summary.originalContract > 0 ? (((summary.revisedContract - summary.originalContract) / summary.originalContract) * 100).toFixed(1) : 0}% contract growth
            </span>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-4">
            <span className="text-[var(--text-primary)]0 block uppercase font-mono text-[9px]">Pending Value</span>
            <span className="font-mono text-base font-extrabold text-[var(--status-warning-text)] mt-1 block">
              {formatAED(summary.pendingVOs)}
            </span>
            <span className="text-[10px] text-[var(--text-primary)]0 font-mono mt-0.5 block">
              Awaiting client authorization
            </span>
          </div>
        </div>
      )}

      {/* Variations Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded overflow-hidden">
        <div className="bg-[var(--bg-card)] px-4 py-3 border-b border-[var(--border)] flex justify-between items-center">
          <h4 className="text-xs font-mono text-[var(--text-secondary)] uppercase tracking-wide font-bold">
            Variation Order Register ({vos.length})
          </h4>
        </div>

        {vos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[var(--text-primary)]0 font-mono text-xs gap-2">
            <FileText size={24} className="text-[var(--text-tertiary)]" />
            <span>No Variation Orders have been captured for this project yet.</span>
            <Link
              href={`/vo/create?projectId=${projectId}`}
              className="text-[var(--accent)] hover:underline mt-1"
            >
              Capture the first Variation Order
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-secondary)] font-mono text-[10px] uppercase bg-[var(--bg-card)]">
                  <th className="py-2.5 px-4">VO Number</th>
                  <th className="py-2.5 px-4">Title / Scope</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Work Status</th>
                  <th className="py-2.5 px-4 text-right">Value (AED)</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] font-mono text-xs text-[var(--text-secondary)]">
                {vos.map((vo) => {
                  const colors = VO_STATUS_COLORS[vo.status] || { bg: 'rgba(0,0,0,0.1)', text: '#fff', border: 'rgba(0,0,0,0.2)' };
                  return (
                    <tr key={vo.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                      <td className="py-3 px-4 font-bold text-[var(--text-primary)]">
                        {vo.vo_number}
                        {vo.proceed_at_risk && vo.status !== 'CLIENT_APPROVED' && (
                          <span className="ml-1.5 px-1.5 py-0.5 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] text-[8px] rounded uppercase font-extrabold animate-pulse">
                            AT RISK
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate" title={vo.title}>
                        <div className="font-semibold text-[var(--text-primary)]">{vo.title}</div>
                        <div className="text-[10px] text-[var(--text-primary)]0 truncate">{vo.instruction_reference}</div>
                      </td>
                      <td className="py-3 px-4 text-[10px] text-[var(--text-secondary)]">
                        {VO_TYPE_LABELS[vo.vo_type] || vo.vo_type}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] ${vo.work_status === 'COMPLETED' ? 'text-[var(--accent)]' : vo.work_status === 'IN_PROGRESS' ? 'text-[var(--status-warning-text)]' : 'text-[var(--text-primary)]0'}`}>
                          {VO_WORK_STATUS_LABELS[vo.work_status] || vo.work_status}
                        </span>
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${vo.sell_amount < 0 ? 'text-[var(--status-danger-text)]' : 'text-[var(--text-primary)]'}`}>
                        {vo.sell_amount < 0 ? '-' : ''}{new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(vo.sell_amount))}
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
                          Details <ArrowRight size={10} />
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

    </div>
  );
}
