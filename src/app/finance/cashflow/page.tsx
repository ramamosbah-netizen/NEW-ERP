// ============================================================
// JEET ERP — Rolling 13-Week Cash Flow Forecast Dashboard
// Routes: /finance/cashflow
// Theme: Bloomberg Terminal Electric Mint
// ============================================================

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import useCashFlow from '@/hooks/useCashFlow';
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, RefreshCw } from 'lucide-react';

export default function CashFlowPage() {
  const [openingInput, setOpeningInput] = useState<number>(500000);
  const { forecast, loading, error, refetch, setStartingBalance } = useCashFlow(openingInput);

  const formatAED = (v: number) => {
    return new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' AED';
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const handleUpdateOpeningBalance = (e: React.FormEvent) => {
    e.preventDefault();
    setStartingBalance(openingInput);
  };

  // Compute key forecast indicators
  const totalInflows = forecast.reduce((acc, f) => acc + f.inflows.total, 0);
  const totalOutflows = forecast.reduce((acc, f) => acc + f.outflows.total, 0);
  const netForecastedFlow = totalInflows - totalOutflows;
  
  const closingBalance = forecast.length > 0 ? forecast[forecast.length - 1].cumulativeBalance : openingInput;
  const peakCash = forecast.length > 0 ? Math.max(...forecast.map(f => f.cumulativeBalance)) : openingInput;
  const minCash = forecast.length > 0 ? Math.min(...forecast.map(f => f.cumulativeBalance)) : openingInput;

  return (
    <div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text-primary)] flex flex-col font-sans">
<main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex justify-between items-start gap-4 flex-wrap">
          <div>
            <div className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest flex items-center gap-1">
              <Link href="/finance" className="hover:text-[var(--accent)] flex items-center gap-0.5"><ArrowLeft size={10} /> Finance Command</Link> &gt; <span className="text-[var(--text-secondary)]">Cash Flow Forecast</span>
            </div>
            <h1 className="font-heading font-extrabold text-2xl tracking-tight text-[var(--text-primary)] uppercase mt-1">
              13-Week Rolling Cash Flow
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <form onSubmit={handleUpdateOpeningBalance} className="flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border)] rounded p-1">
              <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase px-2">Opening Cash Balance:</span>
              <input
                type="number"
                value={openingInput}
                onChange={(e) => setOpeningInput(Number(e.target.value))}
                className="bg-[var(--bg-card)] border border-[var(--border)] rounded px-2.5 py-1 text-xs text-[var(--text-primary)] font-mono w-32 focus:outline-none focus:border-[var(--accent)]"
              />
              <button
                type="submit"
                className="bg-[var(--accent)] text-[var(--text-primary)] text-[10px] font-mono uppercase font-bold px-3 py-1 rounded transition-all hover:bg-[var(--accent)] cursor-pointer"
              >
                Set
              </button>
            </form>

            <button
              onClick={() => refetch()}
              className="bg-[var(--surface-hover)] border border-[var(--border)] hover:border-[var(--border)] p-2 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
              title="Refresh Forecast"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Global Summary Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-4">
            <span className="text-[var(--text-muted)] block uppercase font-mono text-[9px] mb-1">Peak Cash Position</span>
            <span className="font-mono text-base font-extrabold text-[var(--accent)] block">{formatAED(peakCash)}</span>
            <span className="text-[10px] text-[var(--text-secondary)] block mt-0.5">Maximum projected surplus</span>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-4">
            <span className="text-[var(--text-muted)] block uppercase font-mono text-[9px] mb-1">Min Cash Position</span>
            <span className="font-mono text-base font-extrabold text-[var(--status-warning-text)] block">{formatAED(minCash)}</span>
            <span className="text-[10px] text-[var(--text-secondary)] block mt-0.5">Maximum projected drawdown</span>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-4">
            <span className="text-[var(--text-muted)] block uppercase font-mono text-[9px] mb-1">Net Forecasted Flow</span>
            <span className={`font-mono text-base font-extrabold block ${netForecastedFlow >= 0 ? 'text-[var(--accent)]' : 'text-[var(--status-danger-text)]'}`}>
              {netForecastedFlow >= 0 ? '+' : ''}{formatAED(netForecastedFlow)}
            </span>
            <span className="text-[10px] text-[var(--text-secondary)] block mt-0.5">13-week cumulative net</span>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-4">
            <span className="text-[var(--text-muted)] block uppercase font-mono text-[9px] mb-1">Projected Ending Cash</span>
            <span className="font-mono text-base font-extrabold text-[var(--text-primary)] block">{formatAED(closingBalance)}</span>
            <span className="text-[10px] text-[var(--text-secondary)] block mt-0.5">Estimated cash on hand in week 13</span>
          </div>
        </div>

        {/* 13-Week Cash Flow Table */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[var(--bg-card)] border-b border-[var(--border)] text-[var(--text-secondary)] font-mono uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4 text-center">Wk</th>
                  <th className="py-3.5 px-4">Period Duration</th>
                  <th className="py-3.5 px-4 text-right">Inflow (AR)</th>
                  <th className="py-3.5 px-4 text-right">Inflow (Milestones)</th>
                  <th className="py-3.5 px-4 text-right text-[var(--accent)]">Total Inflow</th>
                  <th className="py-3.5 px-4 text-right">Outflow (AP)</th>
                  <th className="py-3.5 px-4 text-right">Outflow (POs)</th>
                  <th className="py-3.5 px-4 text-right text-[var(--status-danger-text)]">Total Outflow</th>
                  <th className="py-3.5 px-4 text-right">Net Flow</th>
                  <th className="py-3.5 px-4 text-right">Ending Balance</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-[var(--text-muted)] font-mono">
                      Simulating 13-week cash projections...
                    </td>
                  </tr>
                ) : forecast.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-[var(--text-muted)] font-mono">
                      No billing forecast parameters found.
                    </td>
                  </tr>
                ) : (
                  forecast.map((week) => {
                    const isPositive = week.netFlow >= 0;
                    return (
                      <tr 
                        key={week.weekIndex} 
                        className="border-b border-[var(--border)] hover:bg-[var(--bg-card)]/40 transition-all font-mono"
                      >
                        <td className="py-3 px-4 text-center font-bold text-[var(--text-muted)]">
                          #{week.weekIndex}
                        </td>
                        <td className="py-3 px-4 text-[var(--text-secondary)] font-sans text-xs">
                          {formatDate(week.startDate)} &ndash; {formatDate(week.endDate)}
                        </td>
                        <td className="py-3 px-4 text-right text-[var(--text-secondary)]">
                          {formatAED(week.inflows.invoices)}
                        </td>
                        <td className="py-3 px-4 text-right text-[var(--text-secondary)]">
                          {formatAED(week.inflows.milestones)}
                        </td>
                        <td className="py-3 px-4 text-right text-[var(--accent)] font-bold">
                          {formatAED(week.inflows.total)}
                        </td>
                        <td className="py-3 px-4 text-right text-[var(--text-secondary)]">
                          {formatAED(week.outflows.supplierInvoices)}
                        </td>
                        <td className="py-3 px-4 text-right text-[var(--text-secondary)]">
                          {formatAED(week.outflows.purchaseOrders)}
                        </td>
                        <td className="py-3 px-4 text-right text-[var(--status-danger-text)] font-bold">
                          {formatAED(week.outflows.total)}
                        </td>
                        <td className={`py-3 px-4 text-right font-bold ${isPositive ? 'text-[var(--accent)]' : 'text-[var(--status-danger-text)]'}`}>
                          {isPositive ? '+' : ''}{formatAED(week.netFlow)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-[var(--text-primary)]">
                          {formatAED(week.cumulativeBalance)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
