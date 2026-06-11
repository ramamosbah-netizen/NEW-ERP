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
      <div className="flex flex-col items-center justify-center py-12 text-slate-500 font-mono text-xs gap-3">
        <div className="animate-spin rounded-full h-5 w-5 border border-slate-700 border-t-emerald-400"></div>
        <span>Compiling committed cost ledger & revenue metrics...</span>
      </div>
    );
  }

  if (error || !financials) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded text-xs font-mono flex items-start gap-2">
        <ShieldAlert size={16} className="shrink-0" />
        <div>
          <span>Failed to compile cost control parameters: {error?.message || 'Project not found'}</span>
          <button onClick={() => refetch()} className="block mt-2 text-emerald-400 hover:underline">
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
        <h3 className="text-xs font-mono text-emerald-400 uppercase tracking-wider font-bold flex items-center gap-2">
          <BarChart2 size={16} /> Committed Cost Control & Profitability
        </h3>
        <button
          onClick={() => refetch()}
          className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer"
          title="Recalculate Profitability"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Margin warning flag */}
      {isMarginEroded && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded flex gap-3 items-start leading-relaxed font-sans text-xs">
          <ShieldAlert size={20} className="text-rose-400 shrink-0 mt-0.5 animate-pulse" />
          <div>
            <strong className="block text-rose-300 font-bold mb-0.5">⚠️ Budget Margin Erosion Detected</strong>
            <span>
              The projected cost at completion ({formatAED(projectedCostAtCompletion)}) exceeds 95% of the total contract value ({formatAED(contractValue)}). 
              Please review outstanding purchase commitments and material requisitions.
            </span>
          </div>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-950/60 border border-slate-900 rounded p-4">
          <span className="text-slate-500 block uppercase font-mono text-[9px]">Contract Value</span>
          <span className="font-mono text-base font-extrabold text-slate-100 mt-1 block">{formatAED(contractValue)}</span>
        </div>

        <div className="bg-slate-950/60 border border-slate-900 rounded p-4">
          <span className="text-slate-500 block uppercase font-mono text-[9px]">Billed Revenue</span>
          <span className="font-mono text-base font-extrabold text-slate-100 mt-1 block">{formatAED(revenueBilled)}</span>
          <span className="text-[10px] text-emerald-400 font-mono mt-0.5 block">
            {contractValue > 0 ? ((revenueBilled / contractValue) * 100).toFixed(1) : 0}% of contract
          </span>
        </div>

        <div className="bg-slate-950/60 border border-slate-900 rounded p-4">
          <span className="text-slate-500 block uppercase font-mono text-[9px]">Cash Collected</span>
          <span className="font-mono text-base font-extrabold text-slate-100 mt-1 block">{formatAED(revenueCollected)}</span>
          <span className="text-[10px] text-emerald-400 font-mono mt-0.5 block">
            {revenueBilled > 0 ? ((revenueCollected / revenueBilled) * 100).toFixed(1) : 0}% of billed
          </span>
        </div>

        <div className="bg-slate-950/60 border border-slate-900 rounded p-4">
          <span className="text-slate-500 block uppercase font-mono text-[9px]">BOQ Cost Budget</span>
          <span className="font-mono text-base font-extrabold text-slate-100 mt-1 block">{formatAED(budgetCost)}</span>
        </div>
      </div>

      {/* Margin comparison panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Realized Performance */}
        <div className="bg-slate-950/40 border border-slate-900 rounded p-5 flex flex-col gap-4">
          <div>
            <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wide">
              Realized Margin (Billed vs actual)
            </h4>
            <span className="text-[10px] text-slate-500">Based on standard supplier invoice registrations</span>
          </div>

          <div className="flex justify-between items-baseline font-mono mt-1">
            <span className="text-2xl font-extrabold text-emerald-400">{formatAED(realizedMargin)}</span>
            <span className="text-sm font-bold text-emerald-400">{realizedMarginPercent}%</span>
          </div>

          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
            <div 
              style={{ width: `${Math.max(0, Math.min(100, realizedMarginPercent))}%` }} 
              className="bg-emerald-400 h-full rounded-full transition-all"
            ></div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs font-mono border-t border-slate-900 pt-3 mt-1">
            <div>
              <span className="text-slate-500 text-[9px] block uppercase">Billed Revenue</span>
              <span className="text-slate-200 font-semibold block">{formatAED(revenueBilled)}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[9px] block uppercase">Actual Registered Cost</span>
              <span className="text-slate-200 font-semibold block">{formatAED(actualCost)}</span>
            </div>
          </div>
        </div>

        {/* Projected Performance */}
        <div className="bg-slate-950/40 border border-slate-900 rounded p-5 flex flex-col gap-4">
          <div>
            <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wide">
              Projected Margin (At completion)
            </h4>
            <span className="text-[10px] text-slate-500">Includes registered actuals and remaining commitments (LPOs)</span>
          </div>

          <div className="flex justify-between items-baseline font-mono mt-1">
            <span className={`text-2xl font-extrabold ${projectedMargin >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
              {formatAED(projectedMargin)}
            </span>
            <span className={`text-sm font-bold ${projectedMarginPercent >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
              {projectedMarginPercent}%
            </span>
          </div>

          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
            <div 
              style={{ width: `${Math.max(0, Math.min(100, projectedMarginPercent))}%` }} 
              className={`h-full rounded-full transition-all ${projectedMarginPercent >= 0 ? 'bg-emerald-400' : 'bg-rose-500'}`}
            ></div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs font-mono border-t border-slate-900 pt-3 mt-1">
            <div>
              <span className="text-slate-500 text-[9px] block uppercase">Contract Value</span>
              <span className="text-slate-200 font-semibold block">{formatAED(contractValue)}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[9px] block uppercase">Projected Cost</span>
              <span className="text-slate-200 font-semibold block">{formatAED(projectedCostAtCompletion)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Waterfall breakdown table */}
      <div className="bg-slate-950/40 border border-slate-900 rounded overflow-hidden">
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-900">
          <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wide font-bold">
            Project Committed Costs Waterfall
          </h4>
        </div>
        
        <div className="p-4 text-xs font-mono flex flex-col gap-3">
          <div className="flex justify-between border-b border-slate-900 pb-2">
            <span className="text-slate-400">1. Original BOQ Cost Budget</span>
            <span className="text-slate-200 font-bold">{formatAED(budgetCost)}</span>
          </div>

          <div className="flex justify-between border-b border-slate-900 pb-2">
            <span className="text-slate-400">2. LPO Committed Purchase Costs</span>
            <span className="text-slate-200 font-bold text-amber-500">{formatAED(committedCost)}</span>
          </div>

          <div className="flex justify-between border-b border-slate-900 pb-2 pl-4">
            <span className="text-slate-500">a) Registered Supplier Invoice Actuals (from POs)</span>
            <span className="text-slate-300">{formatAED(actualCost - actualLabourCost)}</span>
          </div>

          <div className="flex justify-between border-b border-slate-900 pb-2 pl-4">
            <span className="text-slate-500">b) Accrued Unbilled Cost (Received Goods pending Invoice)</span>
            <span className="text-slate-300">{formatAED(accruedUnbilledCost)}</span>
          </div>

          <div className="flex justify-between border-b border-slate-900 pb-2">
            <span className="text-slate-400">3. Timesheet Actual Labour Cost (burdened)</span>
            <span className="text-slate-200 font-bold text-cyan-400">{formatAED(actualLabourCost)}</span>
          </div>

          <div className="flex justify-between border-b border-slate-900 pb-2 pl-4">
            <span className="text-slate-500">a) BOQ Labor Budget Allocation</span>
            <span className="text-slate-300">{formatAED(budgetLabourCost)}</span>
          </div>

          <div className="flex justify-between border-b border-slate-900 pb-2 pl-4">
            <span className="text-slate-500">b) Actual Labour Cost vs Budget Variance</span>
            <span className={`font-bold ${actualLabourCost > budgetLabourCost ? 'text-rose-500' : 'text-emerald-400'}`}>
              {formatAED(actualLabourCost - budgetLabourCost)} ({budgetLabourCost > 0 ? ((actualLabourCost / budgetLabourCost) * 100).toFixed(1) : 0}%)
            </span>
          </div>

          <div className="flex justify-between border-b border-slate-900 pb-2">
            <span className="text-slate-400">4. Total Projected Cost at Completion (Actuals + Remaining LPOs + Labour)</span>
            <span className="text-slate-100 font-extrabold">{formatAED(projectedCostAtCompletion)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
