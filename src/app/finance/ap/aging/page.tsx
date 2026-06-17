// ============================================================
// JEET ERP — Accounts Payable (AP) Aging Analysis
// Routes: /finance/ap/aging
// Theme: Bloomberg Terminal Electric Mint
// ============================================================

'use client';

import React from 'react';
import Link from 'next/link';
import useAging from '@/hooks/useAging';
import { ArrowLeft, BarChart2 } from 'lucide-react';

export default function APAgingPage() {
  const { agingSummary, clientAging: supplierAging, loading } = useAging('AP');

  const formatAED = (v: number) => {
    return new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' AED';
  };

  const getPct = (val: number) => {
    if (agingSummary.totalOutstanding === 0) return '0%';
    return ((val / agingSummary.totalOutstanding) * 100).toFixed(1) + '%';
  };

  return (
    <div className="flex flex-col">
<main className="flex flex-col gap-5">
        {/* Header */}
        <div>
          <div className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest flex items-center gap-1">
            <Link href="/finance/ap" className="hover:text-[var(--accent)] flex items-center gap-0.5"><ArrowLeft size={10} /> AP Registry</Link> &gt; <span className="text-[var(--text-secondary)]">Aging Analysis</span>
          </div>
          <h1 className="font-heading font-extrabold text-2xl tracking-tight text-[var(--text-primary)] uppercase mt-1">
            Accounts Payable Aging
          </h1>
        </div>

        {/* Global Summary Grid */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-6">
          <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider mb-4 flex items-center gap-2">
            <BarChart2 size={16} /> Aggregate Aging Buckets (Payables)
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 text-xs">
            <div className="bg-[var(--bg-card)]/40 p-4 rounded border border-[var(--border)]">
              <span className="text-[var(--text-muted)] block uppercase font-mono text-[9px]">Total Outstanding</span>
              <span className="font-mono text-sm font-bold text-[var(--text-primary)] mt-1 block">{formatAED(agingSummary.totalOutstanding)}</span>
              <span className="text-[10px] text-[var(--text-secondary)] font-mono mt-0.5 block">100%</span>
            </div>

            <div className="bg-[var(--bg-card)]/40 p-4 rounded border border-[var(--border)]">
              <span className="text-[var(--accent)] block uppercase font-mono text-[9px]">Current (Not Due)</span>
              <span className="font-mono text-sm font-bold text-[var(--text-primary)] mt-1 block">{formatAED(agingSummary.current)}</span>
              <span className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5 block">{getPct(agingSummary.current)}</span>
            </div>

            <div className="bg-[var(--bg-card)]/40 p-4 rounded border border-[var(--border)]">
              <span className="text-[var(--status-warning-text)] block uppercase font-mono text-[9px]">1 - 30 Days</span>
              <span className="font-mono text-sm font-bold text-[var(--text-primary)] mt-1 block">{formatAED(agingSummary.bucket1_30)}</span>
              <span className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5 block">{getPct(agingSummary.bucket1_30)}</span>
            </div>

            <div className="bg-[var(--bg-card)]/40 p-4 rounded border border-[var(--border)]">
              <span className="text-[var(--status-warning-text)] block uppercase font-mono text-[9px]">31 - 60 Days</span>
              <span className="font-mono text-sm font-bold text-[var(--text-primary)] mt-1 block">{formatAED(agingSummary.bucket31_60)}</span>
              <span className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5 block">{getPct(agingSummary.bucket31_60)}</span>
            </div>

            <div className="bg-[var(--bg-card)]/40 p-4 rounded border border-[var(--border)]">
              <span className="text-[var(--status-danger-text)] block uppercase font-mono text-[9px]">61 - 90 Days</span>
              <span className="font-mono text-sm font-bold text-[var(--text-primary)] mt-1 block">{formatAED(agingSummary.bucket61_90)}</span>
              <span className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5 block">{getPct(agingSummary.bucket61_90)}</span>
            </div>

            <div className="bg-[var(--bg-card)]/40 p-4 rounded border border-[var(--border)]">
              <span className="text-[var(--status-danger-text)] block uppercase font-mono text-[9px]">90+ Days Overdue</span>
              <span className="font-mono text-sm font-bold text-[var(--text-primary)] mt-1 block">{formatAED(agingSummary.bucket90_plus)}</span>
              <span className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5 block">{getPct(agingSummary.bucket90_plus)}</span>
            </div>
          </div>
        </div>

        {/* Detailed Supplier Table */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[var(--bg-card)] border-b border-[var(--border)] text-[var(--text-secondary)] font-mono uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Supplier Name</th>
                  <th className="py-3.5 px-4 text-right">Outstanding</th>
                  <th className="py-3.5 px-4 text-right">Current</th>
                  <th className="py-3.5 px-4 text-right">1-30 Days</th>
                  <th className="py-3.5 px-4 text-right">31-60 Days</th>
                  <th className="py-3.5 px-4 text-right">61-90 Days</th>
                  <th className="py-3.5 px-4 text-right">90+ Days</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[var(--text-muted)] font-mono">
                      Compiling AP aging statistics...
                    </td>
                  </tr>
                ) : supplierAging.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[var(--text-muted)] font-mono">
                      No unpaid outstanding supplier invoices.
                    </td>
                  </tr>
                ) : (
                  supplierAging.map(supplier => (
                    <tr 
                      key={supplier.clientId} 
                      className="border-b border-[var(--border)] hover:bg-[var(--accent-glow)] transition-all"
                    >
                      <td className="py-4 px-4 font-bold text-[var(--text-primary)]">
                        {supplier.clientName}
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-bold text-[var(--text-primary)]">
                        {formatAED(supplier.totalOutstanding)}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-[var(--accent)]">
                        {formatAED(supplier.current)}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-[var(--status-warning-text)]">
                        {formatAED(supplier.bucket1_30)}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-[var(--status-warning-text)]">
                        {formatAED(supplier.bucket31_60)}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-[var(--status-danger-text)]">
                        {formatAED(supplier.bucket61_90)}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-[var(--status-danger-text)] font-bold">
                        {formatAED(supplier.bucket90_plus)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
