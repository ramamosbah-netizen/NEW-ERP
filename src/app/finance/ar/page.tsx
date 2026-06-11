// ============================================================
// JEET ERP — Accounts Receivable (AR) Invoice Registry
// Routes: /finance/ar
// Theme: Bloomberg Terminal Electric Mint
// ============================================================

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useClientInvoices, InvoiceFilters } from '@/hooks/useClientInvoices';
import { INVOICE_TYPE_LABELS, INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from '@/constants/finance.constants';
import { Search, Plus, Calendar, FileText, ArrowRight } from 'lucide-react';

export default function ClientInvoicesListPage() {
  const [filters, setFilters] = useState<InvoiceFilters>({
    status: '',
    search: '',
  });

  const { invoices, loading, refetch } = useClientInvoices(filters);

  const formatAED = (v: number) => {
    return new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' AED';
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, search: e.target.value }));
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters(prev => ({ ...prev, status: e.target.value }));
  };

  return (
    <div className="min-h-screen bg-[#060814] text-slate-100 flex flex-col font-sans">
<main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Breadcrumb & Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
              <Link href="/finance" className="hover:text-emerald-400">Finance</Link> &gt; <span className="text-slate-300">Receivables</span>
            </div>
            <h1 className="font-heading font-extrabold text-2xl tracking-tight text-slate-100 uppercase mt-1">
              Client Invoice Registry (AR)
            </h1>
          </div>
          <Link 
            href="/finance/ar/create" 
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-400 text-slate-950 text-xs font-bold rounded hover:bg-emerald-300 transition-all uppercase tracking-wider"
          >
            <Plus size={14} /> New Invoice Draft
          </Link>
        </div>

        {/* Filters Panel */}
        <div className="bg-slate-950/60 border border-slate-900 rounded p-4 flex flex-col md:flex-row gap-4 items-center">
          {/* Search bar */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
            <input
              type="text"
              placeholder="Search by Invoice # or Client Name..."
              value={filters.search}
              onChange={handleSearchChange}
              className="w-full bg-[#0a0f26] border border-slate-800 rounded py-2 pl-9 pr-4 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Status select */}
          <div className="w-full md:w-48">
            <select
              value={filters.status}
              onChange={handleStatusChange}
              className="w-full bg-[#0a0f26] border border-slate-800 rounded py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="">All Statuses</option>
              {Object.entries(INVOICE_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table List */}
        <div className="bg-slate-950/40 border border-slate-900 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-900 text-slate-400 font-mono uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Invoice Number</th>
                  <th className="py-3.5 px-4">Client Name</th>
                  <th className="py-3.5 px-4">Billing Date</th>
                  <th className="py-3.5 px-4">Invoice Type</th>
                  <th className="py-3.5 px-4 text-right">Net Due</th>
                  <th className="py-3.5 px-4 text-right">Amount Paid</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500 font-mono">
                      Querying invoices...
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500 font-mono">
                      No invoices registered.
                    </td>
                  </tr>
                ) : (
                  invoices.map(inv => {
                    const statusColor = INVOICE_STATUS_COLORS[inv.status] || { bg: 'rgba(100,116,139,0.1)', text: '#fff', border: 'transparent' };
                    return (
                      <tr 
                        key={inv.id} 
                        className="border-b border-slate-900 hover:bg-emerald-500/5 transition-all cursor-pointer"
                        onClick={() => window.location.href = `/finance/ar/${inv.id}`}
                      >
                        <td className="py-4 px-4 font-mono font-bold text-slate-200">
                          {inv.invoice_number}
                        </td>
                        <td className="py-4 px-4 font-semibold text-slate-300">
                          {inv.client_name}
                        </td>
                        <td className="py-4 px-4 text-slate-400">
                          {new Date(inv.invoice_date).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-4 px-4 text-slate-400">
                          {INVOICE_TYPE_LABELS[inv.invoice_type]}
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-bold text-slate-100">
                          {formatAED(inv.net_due)}
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-slate-400">
                          {formatAED(inv.amount_paid)}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span 
                            className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border"
                            style={{ backgroundColor: statusColor.bg, color: statusColor.text, borderColor: statusColor.border }}
                          >
                            {INVOICE_STATUS_LABELS[inv.status]}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <Link href={`/finance/ar/${inv.id}`} className="text-emerald-400 hover:text-emerald-300">
                            <ArrowRight size={14} />
                          </Link>
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
