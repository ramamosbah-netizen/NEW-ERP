// ============================================================
// JEET ERP — Client Invoice Detailed Viewer
// Routes: /finance/ar/[id]
// Theme: Bloomberg Terminal Electric Mint
// ============================================================

'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { useClientInvoice } from '@/hooks/useClientInvoices';
import { INVOICE_TYPE_LABELS, INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from '@/constants/finance.constants';
import { ArrowLeft, FileText, CheckCircle, XCircle, Send, AlertCircle, Calendar } from 'lucide-react';

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { invoice, loading, submitApproval, approve, reject, markSent, writeOff, deleteDraft } = useClientInvoice(id);

  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [writeOffReason, setWriteOffReason] = useState('');
  const [showWriteOffModal, setShowWriteOffModal] = useState(false);

  const formatAED = (v: number) => {
    return new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' AED';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060814] text-slate-100 flex flex-col font-sans">
<div className="flex-1 flex items-center justify-center font-mono text-slate-500">
          Loading invoice details...
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-[#060814] text-slate-100 flex flex-col font-sans">
<div className="flex-1 flex items-center justify-center font-mono text-slate-500">
          Invoice not found or has been deleted.
        </div>
      </div>
    );
  }

  const statusColor = INVOICE_STATUS_COLORS[invoice.status] || { bg: 'rgba(100,116,139,0.1)', text: '#fff', border: 'transparent' };

  return (
    <div className="min-h-screen bg-[#060814] text-slate-100 flex flex-col font-sans">
<main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Breadcrumb & Navigation */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="text-[10px] text-slate-500 font-mono uppercase tracking-widest flex items-center gap-1">
              <Link href="/finance/ar" className="hover:text-emerald-400 flex items-center gap-0.5"><ArrowLeft size={10} /> Registry</Link> &gt; <span className="text-slate-300">{invoice.invoice_number}</span>
            </div>
            <h1 className="font-heading font-extrabold text-2xl tracking-tight text-slate-100 uppercase mt-1">
              Invoice details
            </h1>
          </div>

          {/* Action flow based on invoice status */}
          <div className="flex flex-wrap gap-2">
            {invoice.status === 'DRAFT' && (
              <>
                <button
                  onClick={async () => { if (confirm('Submit this invoice for approval?')) await submitApproval(); }}
                  className="px-4 py-2 bg-emerald-400 text-slate-950 text-xs font-bold rounded hover:bg-emerald-300 transition-all uppercase tracking-wider"
                >
                  Submit for Approval
                </button>
                <button
                  onClick={async () => { if (confirm('Delete this draft invoice?')) { await deleteDraft(); window.location.href = '/finance/ar'; } }}
                  className="px-4 py-2 bg-slate-900 border border-slate-800 text-red-400 hover:bg-red-500/10 hover:border-red-500/25 text-xs font-bold rounded transition-all uppercase tracking-wider"
                >
                  Delete Draft
                </button>
              </>
            )}

            {invoice.status === 'PENDING_APPROVAL' && (
              <>
                <button
                  onClick={async () => { if (confirm('Approve this invoice? (Generates PDF + ledger retention)')) await approve(); }}
                  className="px-4 py-2 bg-emerald-400 text-slate-950 text-xs font-bold rounded hover:bg-emerald-300 transition-all uppercase tracking-wider flex items-center gap-1"
                >
                  <CheckCircle size={14} /> Approve Invoice
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="px-4 py-2 bg-slate-900 border border-slate-800 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/25 text-xs font-bold rounded transition-all uppercase tracking-wider flex items-center gap-1"
                >
                  <XCircle size={14} /> Reject / Return
                </button>
              </>
            )}

            {invoice.status === 'APPROVED' && (
              <button
                onClick={async () => { if (confirm('Mark invoice as officially sent to client?')) await markSent(); }}
                className="px-4 py-2 bg-emerald-400 text-slate-950 text-xs font-bold rounded hover:bg-emerald-300 transition-all uppercase tracking-wider flex items-center gap-1"
              >
                <Send size={14} /> Mark as Sent to Client
              </button>
            )}

            {['SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status) && (
              <>
                <Link
                  href={`/finance/ar/payment?invoice_id=${invoice.id}&client_id=${invoice.client_id}`}
                  className="px-4 py-2 bg-emerald-400 text-slate-950 text-xs font-bold rounded hover:bg-emerald-300 transition-all uppercase tracking-wider flex items-center gap-1"
                >
                  Record Payment
                </Link>
                <button
                  onClick={() => setShowWriteOffModal(true)}
                  className="px-4 py-2 bg-slate-900 border border-slate-800 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/25 text-xs font-bold rounded transition-all uppercase tracking-wider flex items-center gap-1"
                >
                  Write Off
                </button>
              </>
            )}
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="md:col-span-2 bg-slate-950/40 border border-slate-900 rounded p-6 flex flex-col gap-6">
            {/* Invoice Header details */}
            <div className="flex justify-between items-start border-b border-slate-900 pb-4">
              <div>
                <h3 className="text-xl font-mono font-bold text-slate-100">{invoice.invoice_number}</h3>
                <p className="text-xs text-slate-400 mt-1">Client: {invoice.client_name}</p>
              </div>
              <span
                className="px-3 py-1 rounded text-xs font-bold uppercase tracking-wider border"
                style={{ backgroundColor: statusColor.bg, color: statusColor.text, borderColor: statusColor.border }}
              >
                {INVOICE_STATUS_LABELS[invoice.status]}
              </span>
            </div>

            {/* Dates & Billing parameters grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block">Invoice Date</span>
                <span className="font-mono text-slate-200 mt-0.5 block">{new Date(invoice.invoice_date).toLocaleDateString('en-GB')}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Supply Date</span>
                <span className="font-mono text-slate-200 mt-0.5 block">{new Date(invoice.supply_date).toLocaleDateString('en-GB')}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Due Date</span>
                <span className="font-mono text-slate-200 mt-0.5 block">{new Date(invoice.due_date).toLocaleDateString('en-GB')}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Invoice Type</span>
                <span className="text-slate-200 mt-0.5 block">{INVOICE_TYPE_LABELS[invoice.invoice_type]}</span>
              </div>
            </div>

            {invoice.period_from && invoice.period_to && (
              <div className="text-xs bg-[#0a0f26]/30 border border-slate-900/60 p-3 rounded flex gap-4">
                <div>
                  <span className="text-slate-500">Billing Period:</span>
                  <span className="font-mono text-slate-300 ml-1.5">
                    {new Date(invoice.period_from).toLocaleDateString('en-GB')} to {new Date(invoice.period_to).toLocaleDateString('en-GB')}
                  </span>
                </div>
              </div>
            )}

            {/* Line Items Table */}
            <div>
              <h4 className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-2">Itemized lines</h4>
              <div className="border border-slate-900 rounded overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-900 text-slate-400 font-mono text-[9px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">BOQ Ref</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">VAT</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item, idx) => (
                      <tr key={item.id} className="border-b border-slate-900/40 text-slate-300">
                        <td className="py-3 px-3 font-mono">{idx + 1}</td>
                        <td className="py-3 px-3">{item.description}</td>
                        <td className="py-3 px-3 font-mono text-slate-500">{item.boq_reference || '—'}</td>
                        <td className="py-3 px-3 text-right font-mono">{item.quantity} {item.unit}</td>
                        <td className="py-3 px-3 text-right font-mono">{Number(item.unit_price).toFixed(2)}</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-400">{Number(item.vat_amount).toFixed(2)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-200">{Number(item.line_total).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="bg-[#0a0f26]/20 border border-slate-900 p-4 rounded text-xs">
                <div className="font-mono text-slate-400 uppercase tracking-widest text-[9px] mb-1">Invoice Notes / Rejection Reason:</div>
                <p className="text-slate-300 whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}
          </div>

          {/* Math Ledger Summary Sidebar */}
          <div className="bg-slate-950/60 border border-slate-900 rounded p-6 flex flex-col gap-6 h-fit">
            <h3 className="text-xs font-mono text-emerald-400 uppercase tracking-wider border-b border-slate-900 pb-2">
              Financial Summary
            </h3>

            <div className="flex flex-col gap-4 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Subtotal (Taxable):</span>
                <span className="font-mono text-slate-200">{formatAED(invoice.taxable_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">VAT (5.00%):</span>
                <span className="font-mono text-slate-200">{formatAED(invoice.vat_amount)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-900 pb-3">
                <span className="text-slate-400 font-semibold">Total (Incl. VAT):</span>
                <span className="font-mono font-bold text-slate-100">{formatAED(invoice.total_incl_vat)}</span>
              </div>

              {Number(invoice.advance_recovery) > 0 && (
                <div className="flex justify-between text-rose-400">
                  <span>Less: Advance Recovery:</span>
                  <span className="font-mono">- {formatAED(invoice.advance_recovery)}</span>
                </div>
              )}

              {Number(invoice.retention_held) > 0 && (
                <div className="flex justify-between text-rose-400">
                  <span>Less: Retention Held:</span>
                  <span className="font-mono">- {formatAED(invoice.retention_held)}</span>
                </div>
              )}

              <div className="flex justify-between bg-[#0a0f26] p-3 rounded border border-slate-900 mt-2">
                <span className="font-bold text-slate-200">Net Due:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {formatAED(invoice.net_due)}
                </span>
              </div>

              <div className="flex justify-between text-slate-400 border-t border-slate-900 pt-4">
                <span>Amount Paid:</span>
                <span className="font-mono text-slate-200">{formatAED(invoice.amount_paid)}</span>
              </div>

              <div className="flex justify-between font-bold border-b border-slate-900 pb-3">
                <span className="text-slate-400">Balance Outstanding:</span>
                <span className="font-mono text-emerald-300">
                  {formatAED(Math.max(0, invoice.net_due - invoice.amount_paid))}
                </span>
              </div>

              {invoice.certified_amount && (
                <div className="text-[10px] text-slate-500 font-mono">
                  * Billed based on consultant certified amount of {formatAED(invoice.certified_amount)}
                </div>
              )}
            </div>

            {/* DMS document connection */}
            {invoice.pdf_document_id && (
              <div className="bg-[#0a0f26] border border-slate-900 p-4 rounded flex flex-col gap-2">
                <div className="flex items-center gap-2 text-emerald-400">
                  <FileText size={16} />
                  <span className="text-xs font-mono font-bold uppercase tracking-wider">Tax Invoice PDF</span>
                </div>
                <p className="text-[10px] text-slate-400">The FTA-compliant branded PDF is filed in DMS.</p>
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

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-950 border border-slate-900 w-full max-w-md p-6 rounded flex flex-col gap-4">
            <h3 className="font-heading font-extrabold text-sm text-slate-200 uppercase tracking-widest">
              Reject / Return Invoice
            </h3>
            <p className="text-xs text-slate-400">Provide the correction comment explaining why this progress claim or standalone invoice is returned to draft.</p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="bg-[#0a0f26] border border-slate-800 rounded py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 w-full"
              placeholder="e.g. Quantity on Line 2 is incorrect, please revise..."
              required
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-3.5 py-1.5 bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-300 rounded uppercase"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!rejectReason.trim()) return;
                  await reject(rejectReason);
                  setShowRejectModal(false);
                }}
                className="px-3.5 py-1.5 bg-rose-500 text-slate-950 text-[11px] font-bold rounded uppercase hover:bg-rose-400 transition-all"
              >
                Reject & Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Write Off Modal */}
      {showWriteOffModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-950 border border-slate-900 w-full max-w-md p-6 rounded flex flex-col gap-4">
            <h3 className="font-heading font-extrabold text-sm text-slate-200 uppercase tracking-widest">
              Write Off Outstanding Balance
            </h3>
            <p className="text-xs text-slate-400">Confirm the reason for writing off this invoice. This is an irreversible operational finance adjustment.</p>
            <textarea
              rows={3}
              value={writeOffReason}
              onChange={e => setWriteOffReason(e.target.value)}
              className="bg-[#0a0f26] border border-slate-800 rounded py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 w-full"
              placeholder="e.g. Bad debt, customer liquidation, minor discrepancy offset..."
              required
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setShowWriteOffModal(false)}
                className="px-3.5 py-1.5 bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-300 rounded uppercase"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!writeOffReason.trim()) return;
                  await writeOff(writeOffReason);
                  setShowWriteOffModal(false);
                }}
                className="px-3.5 py-1.5 bg-rose-500 text-slate-950 text-[11px] font-bold rounded uppercase hover:bg-rose-400 transition-all"
              >
                Confirm Write Off
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
