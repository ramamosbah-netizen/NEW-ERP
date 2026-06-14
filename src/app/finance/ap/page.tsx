// ============================================================
// JEET ERP — Accounts Payable (AP) Supplier Invoices Registry
// Routes: /finance/ap
// Theme: Bloomberg Terminal Electric Mint
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useSupplierInvoices, SupplierInvoiceFilters } from '@/hooks/useSupplierInvoices';
import { supplierInvoiceService } from '@/services/supplierInvoiceService';
import { runUploadPipeline } from '@/lib/document-upload-service';
import type { SupplierInvoice } from '@/types/finance.types';
import {
  SUPPLIER_INVOICE_STATUS_LABELS,
  SUPPLIER_INVOICE_STATUS_COLORS,
  MATCH_STATUS_LABELS,
  MATCH_STATUS_COLORS,
  SUPPLIER_INVOICE_TYPE_LABELS
} from '@/constants/finance.constants';
import { Search, Plus, ArrowRight, ShieldAlert, Receipt, CheckCircle, X, Paperclip } from 'lucide-react';

export default function SupplierInvoicesListPage() {
  const [filters, setFilters] = useState<SupplierInvoiceFilters>({
    status: '',
  });
  const [search, setSearch] = useState('');

  const { invoices, loading, refetch } = useSupplierInvoices(filters);

  // Quick-validate a DRAFT bill directly from the register
  const [vBill, setVBill] = useState<SupplierInvoice | null>(null);
  const [vForm, setVForm] = useState({ number: '', date: '', amount: '', vat: true });
  const [vDoc, setVDoc] = useState<{ id: string; name: string } | null>(null);
  const [vBusy, setVBusy] = useState(false);
  const [vErr, setVErr] = useState<string | null>(null);

  const openValidate = (inv: SupplierInvoice) => {
    setVBill(inv);
    setVForm({ number: inv.supplier_invoice_number?.startsWith('AWAITING-') || inv.supplier_invoice_number?.startsWith('PAY-') ? '' : inv.supplier_invoice_number, date: '', amount: String(inv.taxable_amount || ''), vat: (Number(inv.vat_amount) || 0) > 0 });
    setVDoc(null); setVErr(null);
  };

  const uploadVDoc = async (file: File | undefined) => {
    if (!file) return;
    setVBusy(true); setVErr(null);
    try {
      const doc = await runUploadPipeline(file, 'SUPPLIER', undefined, ['supplier-invoice']);
      setVDoc({ id: doc.id, name: file.name });
    } catch (e: any) {
      const m = /^DUPLICATE_FOUND:([^:]+):(.*)$/.exec(e?.message || '');
      if (m) setVDoc({ id: m[1], name: m[2] || file.name });
      else setVErr(e.message || 'Upload failed');
    } finally { setVBusy(false); }
  };

  const doValidate = async () => {
    if (!vBill) return;
    const amt = Number(vForm.amount) || 0;
    if (!vForm.number.trim()) { setVErr('Enter the supplier invoice number.'); return; }
    if (!(amt > 0)) { setVErr('Enter the invoice amount.'); return; }
    setVBusy(true); setVErr(null);
    try {
      const vatAmt = vForm.vat ? Math.round(amt * 0.05 * 100) / 100 : 0;
      await supplierInvoiceService.validateExpected(vBill.id, {
        supplier_invoice_number: vForm.number, invoice_date: vForm.date || undefined,
        taxable_amount: amt, vat_amount: vatAmt, total: Math.round((amt + vatAmt) * 100) / 100,
        source_document_id: vDoc?.id || null,
      });
      setVBill(null);
      refetch();
    } catch (e: any) { setVErr(e.message || 'Validation failed'); } finally { setVBusy(false); }
  };

  // Per-LPO received-items summary (delivered/received lines) for PO-matched bills
  const [received, setReceived] = useState<Record<string, { complete: number; partial: number; total: number }>>({});
  useEffect(() => {
    const poIds = Array.from(new Set(invoices.map(i => (i as any).po_id).filter(Boolean))) as string[];
    if (poIds.length === 0) { setReceived({}); return; }
    supabase.from('po_items').select('po_id, receipt_status').in('po_id', poIds).then(({ data }) => {
      const m: Record<string, { complete: number; partial: number; total: number }> = {};
      for (const r of (data || []) as any[]) {
        const e = m[r.po_id] || (m[r.po_id] = { complete: 0, partial: 0, total: 0 });
        e.total++;
        if (r.receipt_status === 'COMPLETE') e.complete++;
        else if (r.receipt_status === 'PARTIAL') e.partial++;
      }
      setReceived(m);
    });
  }, [invoices]);

  const receivedCell = (poId: string | null | undefined) => {
    if (!poId) return { label: 'Direct', tone: 'rgba(100,116,139,0.6)' };
    const e = received[poId];
    if (!e) return { label: '—', tone: 'rgba(100,116,139,0.6)' };
    if (e.complete >= e.total && e.total > 0) return { label: `Delivered ${e.complete}/${e.total}`, tone: '#34d399' };
    if (e.complete > 0 || e.partial > 0) return { label: `Partial ${e.complete}/${e.total}`, tone: '#fbbf24' };
    return { label: `Pending 0/${e.total}`, tone: '#f87171' };
  };

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
                  <th className="py-3.5 px-4 text-center">Received (LPO)</th>
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
                    <td colSpan={9} className="py-8 text-center text-slate-500 font-mono">
                      Querying supplier ledger...
                    </td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500 font-mono">
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
                        <td className="py-4 px-4 text-center">
                          {(() => { const c = receivedCell((inv as any).po_id); return (
                            <span className="font-mono text-[10px] font-bold" style={{ color: c.tone }}>{c.label}</span>
                          ); })()}
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
                          <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                            {inv.status === 'DRAFT' && (
                              <button onClick={() => openValidate(inv)} title="Validate supplier invoice"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-400/10 cursor-pointer">
                                <CheckCircle size={12} /> Validate
                              </button>
                            )}
                            <Link href={`/finance/ap/match/${inv.id}`} className="text-emerald-400 hover:text-emerald-300">
                              <ArrowRight size={14} />
                            </Link>
                          </div>
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

      {/* Quick-validate a DRAFT bill */}
      {vBill && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setVBill(null)}>
          <div className="w-full max-w-lg bg-[#0a0f26] border border-slate-800 rounded-lg p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Validate supplier invoice</h3>
              <button onClick={() => setVBill(null)} className="text-slate-500 hover:text-slate-200 cursor-pointer"><X size={16} /></button>
            </div>
            <p className="text-xs text-slate-500 mb-4">{vBill.supplier_name || 'Payable'} · {vBill.internal_ref}</p>
            {vErr && <div className="text-xs text-red-400 mb-3">{vErr}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Invoice no *</label>
                <input value={vForm.number} onChange={e => setVForm({ ...vForm, number: e.target.value })}
                  className="w-full bg-[#060814] border border-slate-800 rounded py-2 px-3 text-xs text-slate-200" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Invoice date</label>
                <input type="date" value={vForm.date} onChange={e => setVForm({ ...vForm, date: e.target.value })}
                  className="w-full bg-[#060814] border border-slate-800 rounded py-2 px-3 text-xs text-slate-200" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Amount (excl VAT) *</label>
                <input type="number" step="any" value={vForm.amount} onChange={e => setVForm({ ...vForm, amount: e.target.value })}
                  className="w-full bg-[#060814] border border-slate-800 rounded py-2 px-3 text-xs text-slate-200 text-right" />
              </div>
              <label className="col-span-2 sm:col-span-1 flex items-center gap-2 text-xs text-slate-400 mt-5 cursor-pointer">
                <input type="checkbox" checked={vForm.vat} onChange={e => setVForm({ ...vForm, vat: e.target.checked })} /> +5% VAT
              </label>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <label className="flex items-center gap-2 px-3 py-2 rounded border border-dashed border-slate-700 text-xs text-slate-400 cursor-pointer hover:border-emerald-500/50">
                <Paperclip size={13} /> {vDoc ? `✓ ${vDoc.name}` : (vBusy ? 'Uploading…' : 'Attach invoice (image/PDF)')}
                <input type="file" accept="image/*,application/pdf" className="hidden" disabled={vBusy} onChange={e => uploadVDoc(e.target.files?.[0])} />
              </label>
              <button onClick={doValidate} disabled={vBusy}
                className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-emerald-400 text-slate-950 text-xs font-bold rounded hover:bg-emerald-300 disabled:opacity-50 uppercase tracking-wider">
                <CheckCircle size={14} /> Validate & register
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
