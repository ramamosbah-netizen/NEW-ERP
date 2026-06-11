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
    <div className="min-h-screen bg-[#060814] text-slate-100 flex flex-col font-sans">
<main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Header */}
        <div>
          <div className="text-[10px] text-slate-500 font-mono uppercase tracking-widest flex items-center gap-1">
            <Link href="/finance/ap" className="hover:text-emerald-400 flex items-center gap-0.5"><ArrowLeft size={10} /> AP Registry</Link> &gt; <span className="text-slate-300">Aging Analysis</span>
          </div>
          <h1 className="font-heading font-extrabold text-2xl tracking-tight text-slate-100 uppercase mt-1">
            Accounts Payable Aging
          </h1>
        </div>

        {/* Global Summary Grid */}
        <div className="bg-slate-950/60 border border-slate-900 rounded p-6">
          <h3 className="text-xs font-mono text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <BarChart2 size={16} /> Aggregate Aging Buckets (Payables)
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 text-xs">
            <div className="bg-[#0a0f26]/40 p-4 rounded border border-slate-900/60">
              <span className="text-slate-500 block uppercase font-mono text-[9px]">Total Outstanding</span>
              <span className="font-mono text-sm font-bold text-slate-100 mt-1 block">{formatAED(agingSummary.totalOutstanding)}</span>
              <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">100%</span>
            </div>

            <div className="bg-[#0a0f26]/40 p-4 rounded border border-slate-900/60">
              <span className="text-emerald-400 block uppercase font-mono text-[9px]">Current (Not Due)</span>
              <span className="font-mono text-sm font-bold text-slate-100 mt-1 block">{formatAED(agingSummary.current)}</span>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">{getPct(agingSummary.current)}</span>
            </div>

            <div className="bg-[#0a0f26]/40 p-4 rounded border border-slate-900/60">
              <span className="text-amber-400 block uppercase font-mono text-[9px]">1 - 30 Days</span>
              <span className="font-mono text-sm font-bold text-slate-100 mt-1 block">{formatAED(agingSummary.bucket1_30)}</span>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">{getPct(agingSummary.bucket1_30)}</span>
            </div>

            <div className="bg-[#0a0f26]/40 p-4 rounded border border-slate-900/60">
              <span className="text-amber-500 block uppercase font-mono text-[9px]">31 - 60 Days</span>
              <span className="font-mono text-sm font-bold text-slate-100 mt-1 block">{formatAED(agingSummary.bucket31_60)}</span>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">{getPct(agingSummary.bucket31_60)}</span>
            </div>

            <div className="bg-[#0a0f26]/40 p-4 rounded border border-slate-900/60">
              <span className="text-rose-400 block uppercase font-mono text-[9px]">61 - 90 Days</span>
              <span className="font-mono text-sm font-bold text-slate-100 mt-1 block">{formatAED(agingSummary.bucket61_90)}</span>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">{getPct(agingSummary.bucket61_90)}</span>
            </div>

            <div className="bg-[#0a0f26]/40 p-4 rounded border border-slate-900/60">
              <span className="text-rose-600 block uppercase font-mono text-[9px]">90+ Days Overdue</span>
              <span className="font-mono text-sm font-bold text-slate-100 mt-1 block">{formatAED(agingSummary.bucket90_plus)}</span>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">{getPct(agingSummary.bucket90_plus)}</span>
            </div>
          </div>
        </div>

        {/* Detailed Supplier Table */}
        <div className="bg-slate-950/40 border border-slate-900 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-900 text-slate-400 font-mono uppercase tracking-wider text-[10px]">
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
                    <td colSpan={7} className="py-8 text-center text-slate-500 font-mono">
                      Compiling AP aging statistics...
                    </td>
                  </tr>
                ) : supplierAging.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 font-mono">
                      No unpaid outstanding supplier invoices.
                    </td>
                  </tr>
                ) : (
                  supplierAging.map(supplier => (
                    <tr 
                      key={supplier.clientId} 
                      className="border-b border-slate-900/50 hover:bg-emerald-500/5 transition-all"
                    >
                      <td className="py-4 px-4 font-bold text-slate-200">
                        {supplier.clientName}
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-bold text-slate-100">
                        {formatAED(supplier.totalOutstanding)}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-emerald-400">
                        {formatAED(supplier.current)}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-amber-300">
                        {formatAED(supplier.bucket1_30)}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-amber-500">
                        {formatAED(supplier.bucket31_60)}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-rose-400">
                        {formatAED(supplier.bucket61_90)}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-rose-600 font-bold">
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
