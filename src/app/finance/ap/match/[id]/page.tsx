// ============================================================
// JEET ERP — Supplier Bill Match Audit & Approval Review
// Routes: /finance/ap/match/[id]
// Theme: Bloomberg Terminal Electric Mint
// ============================================================

'use client';

import React, { useState, use, useEffect } from 'react';
import Link from 'next/link';
import { useSupplierInvoice } from '@/hooks/useSupplierInvoices';
import { supplierInvoiceService } from '@/services/supplierInvoiceService';
import { runUploadPipeline } from '@/lib/document-upload-service';
import { supabase } from '@/lib/supabase';
import WorkflowPanel from '@/components/workflow/WorkflowPanel';
import {
  SUPPLIER_INVOICE_STATUS_LABELS,
  SUPPLIER_INVOICE_STATUS_COLORS,
  MATCH_STATUS_LABELS,
  MATCH_STATUS_COLORS,
  SUPPLIER_INVOICE_TYPE_LABELS
} from '@/constants/finance.constants';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, ShieldCheck, ShieldAlert, FileText, ExternalLink, Package, ClipboardList, Users, Paperclip } from 'lucide-react';

export function MatchReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { invoice, loading, approve, overrideException } = useSupplierInvoice(id);

  const [overrideReason, setOverrideReason] = useState('');
  const [showOverrideModal, setShowOverrideModal] = useState(false);

  // Source / justification links (LPO → PR, payroll, attached document)
  const [src, setSrc] = useState<{
    po?: { id: string; po_number: string };
    pr?: { id: string; pr_number: string };
    sourceDoc?: { path: string; name: string };
  }>({});

  useEffect(() => {
    if (!invoice) return;
    (async () => {
      const next: typeof src = {};
      if ((invoice as any).po_id) {
        const { data: po } = await supabase.from('purchase_orders')
          .select('id, po_number, pr_id').eq('id', (invoice as any).po_id).maybeSingle();
        if (po) {
          next.po = { id: po.id, po_number: po.po_number };
          if (po.pr_id) {
            const { data: pr } = await supabase.from('purchase_requests')
              .select('id, pr_number').eq('id', po.pr_id).maybeSingle();
            if (pr) next.pr = { id: pr.id, pr_number: pr.pr_number };
          }
        }
      }
      if ((invoice as any).source_document_id) {
        const { data: doc } = await supabase.from('documents')
          .select('storage_path, original_filename, title').eq('id', (invoice as any).source_document_id).maybeSingle();
        if (doc) next.sourceDoc = { path: doc.storage_path, name: doc.original_filename || doc.title || 'Attached invoice' };
      }
      setSrc(next);
    })();
  }, [invoice]);

  const isPayroll = (invoice?.supplier_invoice_number || '').startsWith('PAY-');

  const viewSourceDoc = async () => {
    if (!src.sourceDoc) return;
    try {
      const { data, error } = await supabase.storage
        .from('documents').createSignedUrl(src.sourceDoc.path, 300, { download: src.sourceDoc.name });
      if (error || !data?.signedUrl) throw error || new Error('No URL');
      window.open(data.signedUrl, '_blank');
    } catch { setValErr('Could not open the attached document.'); }
  };

  // DRAFT → validate (record the real supplier invoice)
  const [val, setVal] = useState({ number: '', date: '', amount: '', vat_applicable: true });
  const [valDoc, setValDoc] = useState<{ id: string; name: string } | null>(null);
  const [valBusy, setValBusy] = useState(false);
  const [valErr, setValErr] = useState<string | null>(null);

  const validate = async () => {
    const amt = Number(val.amount) || 0;
    if (!val.number.trim()) { setValErr('Enter the supplier invoice number.'); return; }
    if (!(amt > 0)) { setValErr('Enter the invoice amount.'); return; }
    setValBusy(true); setValErr(null);
    try {
      const vatAmt = val.vat_applicable ? Math.round(amt * 0.05 * 100) / 100 : 0;
      await supplierInvoiceService.validateExpected(id, {
        supplier_invoice_number: val.number,
        invoice_date: val.date || undefined,
        taxable_amount: amt, vat_amount: vatAmt, total: Math.round((amt + vatAmt) * 100) / 100,
        source_document_id: valDoc?.id || null,
      });
      window.location.reload();
    } catch (e: any) { setValErr(e.message || 'Validation failed'); setValBusy(false); }
  };

  const uploadInvoiceDoc = async (file: File | undefined) => {
    if (!file) return;
    setValBusy(true); setValErr(null);
    try {
      const doc = await runUploadPipeline(file, 'SUPPLIER', undefined, ['supplier-invoice']);
      setValDoc({ id: doc.id, name: file.name });
    } catch (e: any) {
      const m = /^DUPLICATE_FOUND:([^:]+):(.*)$/.exec(e?.message || '');
      if (m) setValDoc({ id: m[1], name: m[2] || file.name });
      else setValErr(e.message || 'Upload failed');
    } finally { setValBusy(false); }
  };

  const viewProforma = async () => {
    const path = (invoice as any)?.proforma_path;
    if (!path) return;
    try {
      const { data, error } = await supabase.storage
        .from('tender-documents')
        .createSignedUrl(path, 300, { download: (invoice as any)?.proforma_name || true });
      if (error || !data?.signedUrl) throw error || new Error('No URL');
      window.open(data.signedUrl, '_blank');
    } catch { setValErr('Could not open the proforma.'); }
  };

  const formatAED = (v: number) => {
    return new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2 }).format(v) + ' AED';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060814] text-slate-100 flex flex-col font-sans">
<div className="flex-1 flex items-center justify-center font-mono text-slate-500">
          Loading matching audit details...
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-[#060814] text-slate-100 flex flex-col font-sans">
<div className="flex-1 flex items-center justify-center font-mono text-slate-500">
          Supplier bill not found.
        </div>
      </div>
    );
  }

  const statusColor = SUPPLIER_INVOICE_STATUS_COLORS[invoice.status] || { bg: 'rgba(100,116,139,0.1)', text: '#fff', border: 'transparent' };
  const matchColor = MATCH_STATUS_COLORS[invoice.match_status] || { bg: 'rgba(100,116,139,0.1)', text: '#fff' };

  const priceExceptions = invoice.match_results?.priceExceptions || [];
  const qtyExceptions = invoice.match_results?.qtyExceptions || [];
  const trnValid = invoice.match_results?.trnValid !== false;
  const trnError = invoice.match_results?.trnError || '';

  const hasExceptions = priceExceptions.length > 0 || qtyExceptions.length > 0 || !trnValid;

  return (
    <div className="min-h-screen bg-[#060814] text-slate-100 flex flex-col font-sans">
<main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="text-[10px] text-slate-500 font-mono uppercase tracking-widest flex items-center gap-1">
              <Link href="/finance/ap" className="hover:text-emerald-400 flex items-center gap-0.5"><ArrowLeft size={10} /> Registry</Link> &gt; <span className="text-slate-300">{invoice.internal_ref}</span>
            </div>
            <h1 className="font-heading font-extrabold text-2xl tracking-tight text-slate-100 uppercase mt-1">
              3-Way Match Audit Review
            </h1>
          </div>

          {/* Action flow buttons */}
          <div className="flex gap-2">
            {invoice.status === 'REGISTERED' && (
              <>
                {!hasExceptions ? (
                  <button
                    onClick={async () => { if (confirm('Approve this matched invoice for scheduling?')) await approve(); }}
                    className="px-4 py-2 bg-emerald-400 text-slate-950 text-xs font-bold rounded hover:bg-emerald-300 transition-all uppercase tracking-wider flex items-center gap-1"
                  >
                    <CheckCircle size={14} /> Approve matched bill
                  </button>
                ) : (
                  <button
                    onClick={() => setShowOverrideModal(true)}
                    className="px-4 py-2 bg-amber-400 text-slate-950 text-xs font-bold rounded hover:bg-amber-300 transition-all uppercase tracking-wider flex items-center gap-1"
                  >
                    <AlertTriangle size={14} /> Override Match Exception
                  </button>
                )}
              </>
            )}

            {invoice.status === 'APPROVED' && (
              <Link
                href={`/finance/ap/schedule?invoice_id=${invoice.id}&supplier_id=${invoice.supplier_id}`}
                className="px-4 py-2 bg-emerald-400 text-slate-950 text-xs font-bold rounded hover:bg-emerald-300 transition-all uppercase tracking-wider flex items-center gap-1"
              >
                Schedule disbursement
              </Link>
            )}
          </div>
        </div>

        {/* Audit Status Card */}
        <div className={`p-5 rounded border ${
          invoice.match_status === 'MATCHED' ? 'bg-emerald-500/5 border-emerald-500/20' : invoice.match_status === 'EXCEPTION' ? 'bg-rose-500/5 border-rose-500/20' : 'bg-slate-950/60 border-slate-900'
        } flex flex-col md:flex-row gap-4 items-center justify-between`}>
          <div className="flex items-center gap-3">
            {invoice.match_status === 'MATCHED' ? (
              <div className="h-10 w-10 bg-emerald-500/10 text-emerald-400 flex items-center justify-center rounded-full">
                <ShieldCheck size={24} />
              </div>
            ) : (
              <div className="h-10 w-10 bg-rose-500/10 text-rose-400 flex items-center justify-center rounded-full">
                <ShieldAlert size={24} />
              </div>
            )}
            <div>
              <h3 className="font-heading font-bold text-sm text-slate-200">
                Match Audit Result: <span className="font-mono uppercase" style={{ color: matchColor.text }}>{MATCH_STATUS_LABELS[invoice.match_status]}</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                {invoice.match_status === 'MATCHED' 
                  ? 'All invoiced line items match purchase order pricing and received quantities.' 
                  : invoice.match_status === 'EXCEPTION'
                    ? 'Discrepancies found in price, quantity, or tax registration credentials.'
                    : 'Override approved. Invoice was pushed to scheduling for payment.'}
              </p>
            </div>
          </div>

          <div className="flex gap-4 text-xs font-mono">
            <div className="text-center bg-[#060814] px-4 py-2 border border-slate-900 rounded">
              <span className="text-slate-500 text-[10px] block">LPO Qty Mismatches</span>
              <span className={`font-bold mt-0.5 block ${qtyExceptions.length > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                {qtyExceptions.length}
              </span>
            </div>
            <div className="text-center bg-[#060814] px-4 py-2 border border-slate-900 rounded">
              <span className="text-slate-500 text-[10px] block">LPO Price Deltas</span>
              <span className={`font-bold mt-0.5 block ${priceExceptions.length > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                {priceExceptions.length}
              </span>
            </div>
          </div>
        </div>

        {/* Audit Details Breakdown */}
        {hasExceptions && (
          <div className="bg-slate-950/40 border border-slate-900 rounded p-6 flex flex-col gap-4">
            <h4 className="text-xs font-mono text-rose-400 uppercase tracking-widest border-b border-slate-900 pb-2 flex items-center gap-1.5">
              <AlertTriangle size={14} /> Exception breakdown
            </h4>

            {/* TRN exceptions */}
            {!trnValid && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded p-4 text-xs flex gap-2 text-rose-300">
                <AlertTriangle size={16} className="shrink-0" />
                <div>
                  <strong>Tax Registration Credentials Audit Failed:</strong>
                  <p className="mt-1">{trnError}</p>
                </div>
              </div>
            )}

            {/* Qty Exceptions list */}
            {qtyExceptions.length > 0 && (
              <div>
                <h5 className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-2">Quantity exceptions (qty invoiced &gt; outstanding GRN)</h5>
                <div className="border border-slate-900 rounded overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950 border-b border-slate-900 text-slate-500 font-mono text-[9px] uppercase tracking-wider">
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3 text-right">GRN Received</th>
                        <th className="py-2.5 px-3 text-right">Prev Invoiced</th>
                        <th className="py-2.5 px-3 text-right">Invoiced (This bill)</th>
                        <th className="py-2.5 px-3 text-right">Exceeded Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qtyExceptions.map((ex: any, idx: number) => {
                        const exceeded = ex.invQty - (ex.grnQty - ex.prevInvoiced);
                        return (
                          <tr key={idx} className="border-b border-slate-900/40 text-slate-300 bg-rose-500/5">
                            <td className="py-3 px-3 font-semibold">{ex.description}</td>
                            <td className="py-3 px-3 text-right font-mono">{ex.grnQty}</td>
                            <td className="py-3 px-3 text-right font-mono text-slate-400">{ex.prevInvoiced}</td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-rose-400">{ex.invQty}</td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-rose-500">+{exceeded.toFixed(3)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Price Exceptions list */}
            {priceExceptions.length > 0 && (
              <div>
                <h5 className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-2">Price exceptions (invoiced price differs from PO price)</h5>
                <div className="border border-slate-900 rounded overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950 border-b border-slate-900 text-slate-500 font-mono text-[9px] uppercase tracking-wider">
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3 text-right">PO Price</th>
                        <th className="py-2.5 px-3 text-right">Invoiced Price</th>
                        <th className="py-2.5 px-3 text-right">Delta (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceExceptions.map((ex: any, idx: number) => (
                        <tr key={idx} className="border-b border-slate-900/40 text-slate-300 bg-amber-500/5">
                          <td className="py-3 px-3 font-semibold">{ex.description}</td>
                          <td className="py-3 px-3 text-right font-mono">{ex.poPrice.toFixed(2)}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-amber-400">{ex.invPrice.toFixed(2)}</td>
                          <td className={`py-3 px-3 text-right font-mono font-bold ${ex.diffPercent > 0 ? 'text-amber-500' : 'text-emerald-400'}`}>
                            {ex.diffPercent > 0 ? `+${ex.diffPercent}%` : `${ex.diffPercent}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Source & justification — why this bill exists */}
        <div className="mb-6 bg-slate-950/60 border border-slate-900 rounded p-5">
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 uppercase tracking-widest mb-3">
            <FileText size={13} /> Source &amp; Justification
          </div>
          <div className="flex flex-wrap gap-2">
            {src.po && (
              <Link href={`/procurement/po/${src.po.id}`} target="_blank"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-slate-800 bg-[#0a0f26] text-xs text-slate-200 hover:border-emerald-500/50 hover:text-emerald-300 transition-all">
                <Package size={13} /> LPO {src.po.po_number} <ExternalLink size={11} className="opacity-60" />
              </Link>
            )}
            {src.pr && (
              <Link href={`/procurement/pr/${src.pr.id}`} target="_blank"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-slate-800 bg-[#0a0f26] text-xs text-slate-200 hover:border-emerald-500/50 hover:text-emerald-300 transition-all">
                <ClipboardList size={13} /> Purchase Request {src.pr.pr_number} <ExternalLink size={11} className="opacity-60" />
              </Link>
            )}
            {isPayroll && (
              <Link href="/payroll" target="_blank"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-slate-800 bg-[#0a0f26] text-xs text-slate-200 hover:border-emerald-500/50 hover:text-emerald-300 transition-all">
                <Users size={13} /> Payroll sheet <ExternalLink size={11} className="opacity-60" />
              </Link>
            )}
            {(invoice as any).proforma_path && (
              <button onClick={viewProforma}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-slate-800 bg-[#0a0f26] text-xs text-slate-200 hover:border-emerald-500/50 hover:text-emerald-300 transition-all cursor-pointer">
                <FileText size={13} /> Proforma{(invoice as any).proforma_name ? ` — ${(invoice as any).proforma_name}` : ''}
              </button>
            )}
            {src.sourceDoc && (
              <button onClick={viewSourceDoc}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-slate-800 bg-[#0a0f26] text-xs text-slate-200 hover:border-emerald-500/50 hover:text-emerald-300 transition-all cursor-pointer">
                <Paperclip size={13} /> Invoice / receipt — {src.sourceDoc.name}
              </button>
            )}
            {!src.po && !isPayroll && !src.sourceDoc && !(invoice as any).proforma_path && (
              <span className="text-xs text-slate-500">
                {(invoice as any).cost_bucket ? `Direct expense · ${(invoice as any).cost_bucket}` : 'No linked source document.'}
                {(invoice as any).expense_category ? ` · ${(invoice as any).expense_category}` : ''}
              </span>
            )}
          </div>
        </div>

        {/* DRAFT payable → validate the supplier's actual invoice */}
        {invoice.status === 'DRAFT' && (
          <div className="mb-6 bg-slate-950/60 border border-slate-800 rounded p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-300 uppercase tracking-wider mb-1">
              <FileText size={15} /> Validate supplier invoice
            </div>
            <p className="text-xs text-slate-500 mb-3">
              This is a draft payable from the approved LPO. Record the supplier&apos;s actual invoice to register it.
            </p>
            {(invoice as any).proforma_path && (
              <button onClick={viewProforma}
                className="inline-flex items-center gap-1.5 mb-4 px-3 py-1.5 rounded border border-slate-700 text-[11px] text-emerald-300 hover:bg-emerald-400/10 cursor-pointer">
                <FileText size={12} /> View imported proforma{(invoice as any).proforma_name ? ` — ${(invoice as any).proforma_name}` : ''}
              </button>
            )}
            {valErr && <div className="text-xs text-red-400 mb-3">{valErr}</div>}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 uppercase">Invoice no *</label>
                <input value={val.number} onChange={e => setVal({ ...val, number: e.target.value })}
                  className="w-full mt-1 bg-[#0a0f26] border border-slate-800 rounded py-2 px-3 text-xs text-slate-200" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase">Invoice date</label>
                <input type="date" value={val.date} onChange={e => setVal({ ...val, date: e.target.value })}
                  className="w-full mt-1 bg-[#0a0f26] border border-slate-800 rounded py-2 px-3 text-xs text-slate-200" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase">Amount (excl VAT)</label>
                <input type="number" step="any" value={val.amount} onChange={e => setVal({ ...val, amount: e.target.value })}
                  placeholder={String(invoice.taxable_amount || '')}
                  className="w-full mt-1 bg-[#0a0f26] border border-slate-800 rounded py-2 px-3 text-xs text-slate-200 text-right" />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-400 mt-5 cursor-pointer">
                <input type="checkbox" checked={val.vat_applicable} onChange={e => setVal({ ...val, vat_applicable: e.target.checked })} /> +5% VAT
              </label>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <label className="flex items-center gap-2 px-3 py-2 rounded border border-dashed border-slate-700 text-xs text-slate-400 cursor-pointer hover:border-emerald-500/50">
                {valDoc ? `✓ ${valDoc.name}` : (valBusy ? 'Uploading…' : 'Attach invoice (image/PDF)')}
                <input type="file" accept="image/*,application/pdf" className="hidden" disabled={valBusy}
                  onChange={e => uploadInvoiceDoc(e.target.files?.[0])} />
              </label>
              <button onClick={validate} disabled={valBusy}
                className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-emerald-400 text-slate-950 text-xs font-bold rounded hover:bg-emerald-300 disabled:opacity-50 uppercase tracking-wider">
                <CheckCircle size={14} /> Validate & register
              </button>
            </div>
          </div>
        )}

        {/* Configurable approval workflow (Admin Center → Workflows, module "SINV").
            Renders only once a supplier-bill workflow is configured. */}
        <WorkflowPanel
          moduleKey="SINV"
          entityId={id}
          context={{ status: invoice.status, total: Number(invoice.total) || 0, match_status: invoice.match_status }}
          className="mb-6"
        />

        {/* Bill Metadata & Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Items */}
          <div className="md:col-span-2 bg-slate-950/40 border border-slate-900 rounded p-6 flex flex-col gap-6">
            <div className="flex justify-between items-start border-b border-slate-900 pb-4">
              <div>
                <h3 className="text-xl font-mono font-bold text-slate-100">{invoice.supplier_invoice_number}</h3>
                <p className="text-xs text-slate-400 mt-1">Vendor: {invoice.supplier_name}</p>
              </div>
              <span
                className="px-3 py-1 rounded text-xs font-bold uppercase tracking-wider border"
                style={{ backgroundColor: statusColor.bg, color: statusColor.text, borderColor: statusColor.border }}
              >
                {SUPPLIER_INVOICE_STATUS_LABELS[invoice.status]}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs border-b border-slate-900/60 pb-4">
              <div>
                <span className="text-slate-500 block">Bill Date</span>
                <span className="font-mono text-slate-200 mt-0.5 block">{new Date(invoice.invoice_date).toLocaleDateString('en-GB')}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Received Date</span>
                <span className="font-mono text-slate-200 mt-0.5 block">{new Date(invoice.received_date).toLocaleDateString('en-GB')}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Due Date</span>
                <span className="font-mono text-slate-200 mt-0.5 block">{new Date(invoice.due_date).toLocaleDateString('en-GB')}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Register Type</span>
                <span className="text-slate-200 mt-0.5 block">{SUPPLIER_INVOICE_TYPE_LABELS[invoice.invoice_type]}</span>
              </div>
            </div>

            <div>
              <h4 className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-2">Invoice line details</h4>
              <div className="border border-slate-900 rounded overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-900 text-slate-500 font-mono text-[9px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 text-right">Quantity</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Taxable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item, idx) => (
                      <tr key={item.id} className="border-b border-slate-900/40 text-slate-300">
                        <td className="py-3 px-3 font-mono">{idx + 1}</td>
                        <td className="py-3 px-3">{item.description}</td>
                        <td className="py-3 px-3 text-right font-mono">{item.quantity}</td>
                        <td className="py-3 px-3 text-right font-mono">{Number(item.unit_price).toFixed(2)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-200">{formatAED(item.taxable_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {invoice.override_reason && (
              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded text-xs">
                <div className="font-mono text-amber-400 uppercase tracking-widest text-[9px] mb-1">Match Exception Override justification:</div>
                <p className="text-slate-300">{invoice.override_reason}</p>
              </div>
            )}
          </div>

          {/* Sidebar totals */}
          <div className="bg-slate-950/60 border border-slate-900 rounded p-6 flex flex-col gap-6 h-fit">
            <h3 className="text-xs font-mono text-emerald-400 uppercase tracking-wider border-b border-slate-900 pb-2">
              Financial ledger
            </h3>

            <div className="flex flex-col gap-4 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Taxable Subtotal:</span>
                <span className="text-slate-200">{formatAED(invoice.taxable_amount)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-900 pb-3 text-slate-400">
                <span>VAT (5.00%):</span>
                <span className="text-slate-200">{formatAED(invoice.vat_amount)}</span>
              </div>
              <div className="flex justify-between bg-[#0a0f26] p-3 rounded border border-slate-900">
                <span className="font-bold text-slate-200">Total Billed:</span>
                <span className="font-bold text-emerald-400">
                  {formatAED(invoice.total)}
                </span>
              </div>

              <div className="flex justify-between text-slate-400 pt-2 border-t border-slate-900/60">
                <span>Amount Paid:</span>
                <span className="text-slate-200">{formatAED(invoice.amount_paid)}</span>
              </div>

              <div className="flex justify-between font-bold border-b border-slate-900 pb-3">
                <span className="text-slate-500">Balance due:</span>
                <span className="text-emerald-300">
                  {formatAED(Math.max(0, invoice.total - invoice.amount_paid))}
                </span>
              </div>
            </div>

            {/* DMS Scan preview */}
            {invoice.source_document_id && (
              <div className="bg-[#0a0f26] border border-slate-900 p-4 rounded flex flex-col gap-2">
                <div className="flex items-center gap-2 text-emerald-400">
                  <FileText size={16} />
                  <span className="text-xs font-mono font-bold uppercase tracking-wider">Supplier bill scan</span>
                </div>
                <p className="text-[10px] text-slate-400">Linked audit record scan is stored in DMS.</p>
                <Link
                  href={`/documents`} // DMS router preview
                  className="w-full mt-1 py-1.5 bg-slate-900 border border-slate-800 text-[10px] text-slate-200 font-mono rounded hover:bg-slate-800 uppercase text-center transition-all"
                >
                  Open in Document Center
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Override exception modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-950 border border-slate-900 w-full max-w-md p-6 rounded flex flex-col gap-4">
            <h3 className="font-heading font-extrabold text-sm text-slate-200 uppercase tracking-widest">
              Override Match Exceptions
            </h3>
            <p className="text-xs text-slate-400">Provide the business justification reason to override the quantity or price mismatch and approve this invoice for payment scheduling.</p>
            <textarea
              rows={3}
              value={overrideReason}
              onChange={e => setOverrideReason(e.target.value)}
              className="bg-[#0a0f26] border border-slate-800 rounded py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 w-full"
              placeholder="e.g. Unit price increase approved by PM due to urgent delivery, extra delivery cost included..."
              required
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setShowOverrideModal(false)}
                className="px-3.5 py-1.5 bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-300 rounded uppercase"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!overrideReason.trim()) return;
                  await overrideException(overrideReason);
                  setShowOverrideModal(false);
                }}
                className="px-3.5 py-1.5 bg-emerald-400 text-slate-950 text-[11px] font-bold rounded uppercase hover:bg-emerald-300 transition-all shadow-[0_0_15px_rgba(0,229,160,0.15)]"
              >
                Approve with override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default MatchReviewPage;
