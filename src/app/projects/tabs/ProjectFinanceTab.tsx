// ============================================================
// JEET ERP — Project Financials Cost Control Tab
// Location: src/app/projects/tabs/ProjectFinanceTab.tsx
// Theme: Bloomberg Terminal Electric Mint
// ============================================================

'use client';

import React from 'react';
import useProjectFinancials from '@/hooks/useProjectFinancials';
import { TrendingUp, ShieldAlert, CheckCircle, RefreshCw, BarChart2, DollarSign } from 'lucide-react';

interface ProjectFinanceTabProps {
  projectId: string;
}

export default function ProjectFinanceTab({ projectId }: ProjectFinanceTabProps) {
  const { financials, loading, error, refetch } = useProjectFinancials(projectId);

  const formatAED = (v: number) => {
    return new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' AED';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[var(--text-primary)]0 font-mono text-xs gap-3">
        <div className="animate-spin rounded-full h-5 w-5 border border-[var(--border)] border-t-emerald-400"></div>
        <span>Compiling committed cost ledger & revenue metrics...</span>
      </div>
    );
  }

  if (error || !financials) {
    return (
      <div className="bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] p-4 rounded text-xs font-mono flex items-start gap-2">
        <ShieldAlert size={16} className="shrink-0" />
        <div>
          <span>Failed to compile cost control parameters: {error?.message || 'Project not found'}</span>
          <button onClick={() => refetch()} className="block mt-2 text-[var(--accent)] hover:underline">
            Retry Calculation
          </button>
        </div>
      </div>
    );
  }

  const {
    contractValue,
    budgetCost,
    committedCost,
    actualCost,
    actualLabourCost,
    budgetLabourCost,
    accruedUnbilledCost,
    revenueBilled,
    revenueCollected,
    realizedMargin,
    realizedMarginPercent,
    projectedCostAtCompletion,
    projectedMargin,
    projectedMarginPercent,
    isMarginEroded
  } = financials;

  return (
    <div className="flex flex-col gap-6">
      
      {/* Title & Refresh */}
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider font-bold flex items-center gap-2">
          <BarChart2 size={16} /> Committed Cost Control & Profitability
        </h3>
        <button
          onClick={() => refetch()}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 rounded hover:bg-[var(--surface-hover)] border border-[var(--border)] hover:border-[var(--border)] transition-all cursor-pointer"
          title="Recalculate Profitability"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Margin warning flag */}
      {isMarginEroded && (
        <div className="bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] p-4 rounded flex gap-3 items-start leading-relaxed font-sans text-xs">
          <ShieldAlert size={20} className="text-[var(--status-danger-text)] shrink-0 mt-0.5 animate-pulse" />
          <div>
            <strong className="block text-[var(--status-danger-text)] font-bold mb-0.5">⚠️ Budget Margin Erosion Detected</strong>
            <span>
              The projected cost at completion ({formatAED(projectedCostAtCompletion)}) exceeds 95% of the total contract value ({formatAED(contractValue)}). 
              Please review outstanding purchase commitments and material requisitions.
            </span>
          </div>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-4">
          <span className="text-[var(--text-primary)]0 block uppercase font-mono text-[9px]">Contract Value</span>
          <span className="font-mono text-base font-extrabold text-[var(--text-primary)] mt-1 block">{formatAED(contractValue)}</span>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-4">
          <span className="text-[var(--text-primary)]0 block uppercase font-mono text-[9px]">Billed Revenue</span>
          <span className="font-mono text-base font-extrabold text-[var(--text-primary)] mt-1 block">{formatAED(revenueBilled)}</span>
          <span className="text-[10px] text-[var(--accent)] font-mono mt-0.5 block">
            {contractValue > 0 ? ((revenueBilled / contractValue) * 100).toFixed(1) : 0}% of contract
          </span>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-4">
          <span className="text-[var(--text-primary)]0 block uppercase font-mono text-[9px]">Cash Collected</span>
          <span className="font-mono text-base font-extrabold text-[var(--text-primary)] mt-1 block">{formatAED(revenueCollected)}</span>
          <span className="text-[10px] text-[var(--accent)] font-mono mt-0.5 block">
            {revenueBilled > 0 ? ((revenueCollected / revenueBilled) * 100).toFixed(1) : 0}% of billed
          </span>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-4">
          <span className="text-[var(--text-primary)]0 block uppercase font-mono text-[9px]">BOQ Cost Budget</span>
          <span className="font-mono text-base font-extrabold text-[var(--text-primary)] mt-1 block">{formatAED(budgetCost)}</span>
        </div>
      </div>

      {/* Margin comparison panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Realized Performance */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-5 flex flex-col gap-4">
          <div>
            <h4 className="text-xs font-mono font-bold text-[var(--text-secondary)] uppercase tracking-wide">
              Realized Margin (Billed vs actual)
            </h4>
            <span className="text-[10px] text-[var(--text-primary)]0">Based on standard supplier invoice registrations</span>
          </div>

          <div className="flex justify-between items-baseline font-mono mt-1">
            <span className="text-2xl font-extrabold text-[var(--accent)]">{formatAED(realizedMargin)}</span>
            <span className="text-sm font-bold text-[var(--accent)]">{realizedMarginPercent}%</span>
          </div>

          <div className="w-full bg-[var(--surface-hover)] rounded-full h-2 overflow-hidden">
            <div 
              style={{ width: `${Math.max(0, Math.min(100, realizedMarginPercent))}%` }} 
              className="bg-[var(--accent)] h-full rounded-full transition-all"
            ></div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs font-mono border-t border-[var(--border)] pt-3 mt-1">
            <div>
              <span className="text-[var(--text-primary)]0 text-[9px] block uppercase">Billed Revenue</span>
              <span className="text-[var(--text-primary)] font-semibold block">{formatAED(revenueBilled)}</span>
            </div>
            <div>
              <span className="text-[var(--text-primary)]0 text-[9px] block uppercase">Actual Registered Cost</span>
              <span className="text-[var(--text-primary)] font-semibold block">{formatAED(actualCost)}</span>
            </div>
          </div>
        </div>

        {/* Projected Performance */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-5 flex flex-col gap-4">
          <div>
            <h4 className="text-xs font-mono font-bold text-[var(--text-secondary)] uppercase tracking-wide">
              Projected Margin (At completion)
            </h4>
            <span className="text-[10px] text-[var(--text-primary)]0">Includes registered actuals and remaining commitments (LPOs)</span>
          </div>

          <div className="flex justify-between items-baseline font-mono mt-1">
            <span className={`text-2xl font-extrabold ${projectedMargin >= 0 ? 'text-[var(--accent)]' : 'text-[var(--status-danger-text)]'}`}>
              {formatAED(projectedMargin)}
            </span>
            <span className={`text-sm font-bold ${projectedMarginPercent >= 0 ? 'text-[var(--accent)]' : 'text-[var(--status-danger-text)]'}`}>
              {projectedMarginPercent}%
            </span>
          </div>

          <div className="w-full bg-[var(--surface-hover)] rounded-full h-2 overflow-hidden">
            <div 
              style={{ width: `${Math.max(0, Math.min(100, projectedMarginPercent))}%` }} 
              className={`h-full rounded-full transition-all ${projectedMarginPercent >= 0 ? 'bg-[var(--accent)]' : 'bg-[var(--status-danger-bg)]'}`}
            ></div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs font-mono border-t border-[var(--border)] pt-3 mt-1">
            <div>
              <span className="text-[var(--text-primary)]0 text-[9px] block uppercase">Contract Value</span>
              <span className="text-[var(--text-primary)] font-semibold block">{formatAED(contractValue)}</span>
            </div>
            <div>
              <span className="text-[var(--text-primary)]0 text-[9px] block uppercase">Projected Cost</span>
              <span className="text-[var(--text-primary)] font-semibold block">{formatAED(projectedCostAtCompletion)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Waterfall breakdown table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded overflow-hidden">
        <div className="bg-[var(--bg-card)] px-4 py-3 border-b border-[var(--border)]">
          <h4 className="text-xs font-mono text-[var(--text-secondary)] uppercase tracking-wide font-bold">
            Project Committed Costs Waterfall
          </h4>
        </div>
        
        <div className="p-4 text-xs font-mono flex flex-col gap-3">
          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <span className="text-[var(--text-secondary)]">1. Original BOQ Cost Budget</span>
            <span className="text-[var(--text-primary)] font-bold">{formatAED(budgetCost)}</span>
          </div>

          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <span className="text-[var(--text-secondary)]">2. LPO Committed Purchase Costs</span>
            <span className="text-[var(--text-primary)] font-bold text-[var(--status-warning-text)]">{formatAED(committedCost)}</span>
          </div>

          <div className="flex justify-between border-b border-[var(--border)] pb-2 pl-4">
            <span className="text-[var(--text-primary)]0">a) Registered Supplier Invoice Actuals (from POs)</span>
            <span className="text-[var(--text-secondary)]">{formatAED(actualCost - actualLabourCost)}</span>
          </div>

          <div className="flex justify-between border-b border-[var(--border)] pb-2 pl-4">
            <span className="text-[var(--text-primary)]0">b) Accrued Unbilled Cost (Received Goods pending Invoice)</span>
            <span className="text-[var(--text-secondary)]">{formatAED(accruedUnbilledCost)}</span>
          </div>

          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <span className="text-[var(--text-secondary)]">3. Timesheet Actual Labour Cost (burdened)</span>
            <span className="text-[var(--text-primary)] font-bold text-[var(--accent)]">{formatAED(actualLabourCost)}</span>
          </div>

          <div className="flex justify-between border-b border-[var(--border)] pb-2 pl-4">
            <span className="text-[var(--text-primary)]0">a) BOQ Labor Budget Allocation</span>
            <span className="text-[var(--text-secondary)]">{formatAED(budgetLabourCost)}</span>
          </div>

          <div className="flex justify-between border-b border-[var(--border)] pb-2 pl-4">
            <span className="text-[var(--text-primary)]0">b) Actual Labour Cost vs Budget Variance</span>
            <span className={`font-bold ${actualLabourCost > budgetLabourCost ? 'text-[var(--status-danger-text)]' : 'text-[var(--accent)]'}`}>
              {formatAED(actualLabourCost - budgetLabourCost)} ({budgetLabourCost > 0 ? ((actualLabourCost / budgetLabourCost) * 100).toFixed(1) : 0}%)
            </span>
          </div>

          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <span className="text-[var(--text-secondary)]">4. Total Projected Cost at Completion (Actuals + Remaining LPOs + Labour)</span>
            <span className="text-[var(--text-primary)] font-extrabold">{formatAED(projectedCostAtCompletion)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
