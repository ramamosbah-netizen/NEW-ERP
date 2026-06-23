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
import { useCompany } from '@/lib/company/useCompany';
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
import { Plus, ArrowRight, ShieldAlert, Receipt, CheckCircle, X, Paperclip } from 'lucide-react';
import { PageHeader, Card, Button, Toolbar, SearchInput, SelectFilter } from '@/components/ui';

export default function SupplierInvoicesListPage() {
  const { activeCompanyId } = useCompany();
  const [filters, setFilters] = useState<SupplierInvoiceFilters>({
    status: '',
  });
  const [search, setSearch] = useState('');

  const { invoices, loading, refetch } = useSupplierInvoices({ ...filters, companyId: activeCompanyId || undefined });

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
    if (!poId) return { label: 'Direct', tone: 'var(--text-tertiary)' };
    const e = received[poId];
    if (!e) return { label: '—', tone: 'var(--text-tertiary)' };
    if (e.complete >= e.total && e.total > 0) return { label: `Delivered ${e.complete}/${e.total}`, tone: '#34d399' };
    if (e.complete > 0 || e.partial > 0) return { label: `Partial ${e.complete}/${e.total}`, tone: 'var(--status-warning-text)' };
    return { label: `Pending 0/${e.total}`, tone: 'var(--status-danger-text)' };
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
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Payables (AP)"
        subtitle="Supplier bills — 3-way match, exceptions & disbursements"
        breadcrumbs={[{ label: 'Finance', href: '/finance' }, { label: 'Payables' }]}
        actions={
          <>
            <Link href="/finance/ap/expenses" className="no-underline">
              <Button variant="secondary" size="sm" icon={Receipt}>Expenses & Accounts</Button>
            </Link>
            <Link href="/finance/ap/register" className="no-underline">
              <Button variant="primary" size="sm" icon={Plus}>Register Supplier Invoice</Button>
            </Link>
          </>
        }
      />

      <Toolbar>
        <SearchInput
          placeholder="Search supplier, invoice # or internal ref…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          containerClassName="flex-1"
          className="w-full"
        />
        <SelectFilter value={filters.status} onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}>
          <option value="">All Statuses</option>
          {Object.entries(SUPPLIER_INVOICE_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </SelectFilter>
      </Toolbar>

      {/* Table List */}
      <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] font-mono uppercase tracking-wider text-[10px]">
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
                    <td colSpan={9} className="py-8 text-center text-[var(--text-muted)] font-mono">
                      Querying supplier ledger...
                    </td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-[var(--text-muted)] font-mono">
                      No registered bills found.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map(inv => {
                    const statusColor = SUPPLIER_INVOICE_STATUS_COLORS[inv.status] || { bg: 'var(--surface-hover)', text: '#fff', border: 'transparent' };
                    const matchColor = MATCH_STATUS_COLORS[inv.match_status] || { bg: 'var(--surface-hover)', text: '#fff' };
                    return (
                      <tr 
                        key={inv.id} 
                        className="border-b border-[var(--border)] hover:bg-[var(--accent-glow)] transition-all cursor-pointer"
                        onClick={() => window.location.href = `/finance/ap/match/${inv.id}`}
                      >
                        <td className="py-4 px-4 font-mono text-[var(--text-secondary)]">
                          {inv.internal_ref}
                        </td>
                        <td className="py-4 px-4 font-semibold text-[var(--text-primary)]">
                          {inv.supplier_name}
                        </td>
                        <td className="py-4 px-4 font-mono font-bold text-[var(--text-secondary)]">
                          {inv.supplier_invoice_number}
                        </td>
                        <td className="py-4 px-4 text-center">
                          {(() => { const c = receivedCell((inv as any).po_id); return (
                            <span className="font-mono text-[10px] font-bold" style={{ color: c.tone }}>{c.label}</span>
                          ); })()}
                        </td>
                        <td className="py-4 px-4 text-[var(--text-secondary)]">
                          {new Date(inv.due_date).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-bold text-[var(--text-primary)]">
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
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[var(--accent)] text-[var(--accent)] text-[10px] font-bold uppercase tracking-wider hover:bg-[var(--accent-glow)] cursor-pointer">
                                <CheckCircle size={12} /> Validate
                              </button>
                            )}
                            <Link href={`/finance/ap/match/${inv.id}`} className="text-[var(--accent)] hover:text-[var(--accent)]">
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
      </Card>

      {/* Quick-validate a DRAFT bill */}
      {vBill && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setVBill(null)}>
          <div className="w-full max-w-lg bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Validate supplier invoice</h3>
              <button onClick={() => setVBill(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"><X size={16} /></button>
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-4">{vBill.supplier_name || 'Payable'} · {vBill.internal_ref}</p>
            {vErr && <div className="text-xs text-[var(--status-danger-text)] mb-3">{vErr}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Invoice no *</label>
                <input value={vForm.number} onChange={e => setVForm({ ...vForm, number: e.target.value })}
                  className="w-full bg-[var(--bg-dark)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-primary)]" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Invoice date</label>
                <input type="date" value={vForm.date} onChange={e => setVForm({ ...vForm, date: e.target.value })}
                  className="w-full bg-[var(--bg-dark)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-primary)]" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Amount (excl VAT) *</label>
                <input type="number" step="any" value={vForm.amount} onChange={e => setVForm({ ...vForm, amount: e.target.value })}
                  className="w-full bg-[var(--bg-dark)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-primary)] text-right" />
              </div>
              <label className="col-span-2 sm:col-span-1 flex items-center gap-2 text-xs text-[var(--text-secondary)] mt-5 cursor-pointer">
                <input type="checkbox" checked={vForm.vat} onChange={e => setVForm({ ...vForm, vat: e.target.checked })} /> +5% VAT
              </label>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <label className="flex items-center gap-2 px-3 py-2 rounded border border-dashed border-[var(--border)] text-xs text-[var(--text-secondary)] cursor-pointer hover:border-[var(--accent)]">
                <Paperclip size={13} /> {vDoc ? `✓ ${vDoc.name}` : (vBusy ? 'Uploading…' : 'Attach invoice (image/PDF)')}
                <input type="file" accept="image/*,application/pdf" className="hidden" disabled={vBusy} onChange={e => uploadVDoc(e.target.files?.[0])} />
              </label>
              <button onClick={doValidate} disabled={vBusy}
                className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] text-[var(--text-primary)] text-xs font-bold rounded hover:bg-[var(--accent)] disabled:opacity-50 uppercase tracking-wider">
                <CheckCircle size={14} /> Validate & register
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
