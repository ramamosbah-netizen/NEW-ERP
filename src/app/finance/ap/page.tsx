// ============================================================
// JEET ERP — Accounts Payable (AP) Supplier Invoices Registry
// Routes: /finance/ap
// Theme: Bloomberg Terminal Electric Mint
// ============================================================

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSupplierInvoices, SupplierInvoiceFilters } from '@/hooks/useSupplierInvoices';
import { 
  SUPPLIER_INVOICE_STATUS_LABELS, 
  SUPPLIER_INVOICE_STATUS_COLORS,
  MATCH_STATUS_LABELS,
  MATCH_STATUS_COLORS,
  SUPPLIER_INVOICE_TYPE_LABELS
} from '@/constants/finance.constants';
import { Search, Plus, ArrowRight, ShieldAlert, Receipt } from 'lucide-react';

export default function SupplierInvoicesListPage() {
  const [filters, setFilters] = useState<SupplierInvoiceFilters>({
    status: '',
  });
  const [search, setSearch] = useState('');

  const { invoices, loading } = useSupplierInvoices(filters);

  const formatAED = (v: number) => {
    return new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2 }).format(v) + ' AED';
  };

  const filteredInvoices = invoices.filter(inv => {
    const s = search.toLowerCase();
    return (
      inv.supplier_invoice_number.toLowerCase().includes(s) ||
      inv.internal_ref.toLowerCase().includes(s) ||
      (inv.supplier_name && inv.supplier_name.toLowerCase().includes(s))
    );
  });

  return (
    <div className="min-h-screen bg-[#060814] text-slate-100 flex flex-col font-sans">
<main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Breadcrumb & Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
              <Link href="/finance" className="hover:text-emerald-400">Finance</Link> &gt; <span className="text-slate-300">Payables</span>
            </div>
            <h1 className="font-heading font-extrabold text-2xl tracking-tight text-slate-100 uppercase mt-1">
              Supplier Bills & Invoices (AP)
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/finance/ap/expenses"
              className="flex items-center gap-1.5 px-4 py-2 border border-emerald-400/40 text-emerald-300 text-xs font-bold rounded hover:bg-emerald-400/10 transition-all uppercase tracking-wider"
            >
              <Receipt size={14} /> Expenses & Accounts
            </Link>
            <Link
              href="/finance/ap/register"
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-400 text-slate-950 text-xs font-bold rounded hover:bg-emerald-300 transition-all uppercase tracking-wider"
            >
              <Plus size={14} /> Register Supplier Invoice
            </Link>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="bg-slate-950/60 border border-slate-900 rounded p-4 flex flex-col md:flex-row gap-4 items-center">
          {/* Search bar */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
            <input
              type="text"
              placeholder="Search by supplier name, invoice # or internal reference..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#0a0f26] border border-slate-800 rounded py-2 pl-9 pr-4 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Status select */}
          <div className="w-full md:w-48">
            <select
              value={filters.status}
              onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full bg-[#0a0f26] border border-slate-800 rounded py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="">All Statuses</option>
              {Object.entries(SUPPLIER_INVOICE_STATUS_LABELS).map(([k, v]) => (
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
                  <th className="py-3.5 px-4">Ref ID</th>
                  <th className="py-3.5 px-4">Supplier / Vendor</th>
                  <th className="py-3.5 px-4">Bill Number</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4 text-right">Total Amount</th>
                  <th className="py-3.5 px-4 text-center">3-Way Match</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500 font-mono">
                      Querying supplier ledger...
                    </td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500 font-mono">
                      No registered bills found.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map(inv => {
                    const statusColor = SUPPLIER_INVOICE_STATUS_COLORS[inv.status] || { bg: 'rgba(100,116,139,0.1)', text: '#fff', border: 'transparent' };
                    const matchColor = MATCH_STATUS_COLORS[inv.match_status] || { bg: 'rgba(100,116,139,0.1)', text: '#fff' };
                    return (
                      <tr 
                        key={inv.id} 
                        className="border-b border-slate-900 hover:bg-emerald-500/5 transition-all cursor-pointer"
                        onClick={() => window.location.href = `/finance/ap/match/${inv.id}`}
                      >
                        <td className="py-4 px-4 font-mono text-slate-400">
                          {inv.internal_ref}
                        </td>
                        <td className="py-4 px-4 font-semibold text-slate-200">
                          {inv.supplier_name}
                        </td>
                        <td className="py-4 px-4 font-mono font-bold text-slate-300">
                          {inv.supplier_invoice_number}
                        </td>
                        <td className="py-4 px-4 text-slate-400">
                          {new Date(inv.due_date).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-bold text-slate-100">
                          {formatAED(inv.total)}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span 
                            className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1 w-fit mx-auto"
                            style={{ backgroundColor: matchColor.bg, color: matchColor.text }}
                          >
                            {inv.match_status === 'EXCEPTION' && <ShieldAlert size={10} />}
                            {MATCH_STATUS_LABELS[inv.match_status]}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span 
                            className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border"
                            style={{ backgroundColor: statusColor.bg, color: statusColor.text, borderColor: statusColor.border }}
                          >
                            {SUPPLIER_INVOICE_STATUS_LABELS[inv.status]}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <Link href={`/finance/ap/match/${inv.id}`} className="text-emerald-400 hover:text-emerald-300">
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
