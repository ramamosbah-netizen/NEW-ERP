// ============================================================
// JEET ERP — Register Supplier Invoice & 3-Way Match Audit
// Routes: /finance/ap/register
// Theme: Bloomberg Terminal Electric Mint
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useThreeWayMatch } from '@/hooks/useThreeWayMatch';
import { supplierInvoiceService } from '@/services/supplierInvoiceService';
import { ArrowLeft, CheckCircle, AlertTriangle, ShieldAlert } from 'lucide-react';

export function SupplierInvoiceRegisterPage() {
  const router = useRouter();

  const formatAED = (v: number) => {
    return new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' AED';
  };

  // DB Options
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form Fields
  const [supplierId, setSupplierId] = useState('');
  const [invoiceType, setInvoiceType] = useState<'PO_MATCHED' | 'DIRECT_EXPENSE'>('PO_MATCHED');
  const [poId, setPoId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [sourceDocumentId, setSourceDocumentId] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('');
  const [notes, setNotes] = useState('');

  // Items Form State
  const [items, setItems] = useState<Array<{
    po_item_id: string | null;
    description: string;
    quantity: number;
    unit_price: number;
    vat_rate: number;
  }>>([]);

  // UAE TRN on invoice
  const [invoiceSupplierTrn, setInvoiceSupplierTrn] = useState('');

  // 3-Way Match Data Resolution Hook
  const { poDetails, matchDetails, loading: matchLoading } = useThreeWayMatch(poId);

  // Load baseline options
  useEffect(() => {
    supabase.from('pricing_suppliers').select('id, name').then(({ data }) => setSuppliers(data || []));
    supabase.from('projects').select('id, name, project_number').then(({ data }) => setProjects(data || []));
    // Fetch unlinked supplier invoices or general documents in DMS
    supabase.from('documents')
      .select('id, title, original_filename')
      .eq('category', 'COMMERCIAL')
      .eq('subcategory', 'SUPPLIER_INVOICE')
      .then(({ data }) => setDocuments(data || []));
  }, []);

  // Fetch POs for selected supplier
  useEffect(() => {
    if (supplierId) {
      supabase.from('purchase_orders')
        .select('id, po_number, total, project_id')
        .eq('supplier_id', supplierId)
        .in('status', ['APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CLOSED'])
        .then(({ data }) => {
          setPurchaseOrders(data || []);
          if (data && data.length > 0 && !poId) {
            // Do not auto-select to avoid resetting
          }
        });
    } else {
      setPurchaseOrders([]);
    }
  }, [supplierId]);

  // Sync project ID and supplier TRN from selected PO
  useEffect(() => {
    if (poId && poDetails) {
      if (poDetails.project_id) {
        setProjectId(poDetails.project_id);
      }
      if (poDetails.supplier_trn) {
        setInvoiceSupplierTrn(poDetails.supplier_trn);
      }
    }
  }, [poId, poDetails]);

  // Sync items when matchDetails loads
  useEffect(() => {
    if (poId && matchDetails.length > 0) {
      const formItems = matchDetails.map(item => ({
        po_item_id: item.poItemId,
        description: item.description,
        quantity: item.qtyOutstandingToInvoice || item.poQty, // default to outstanding
        unit_price: item.poUnitPrice,
        vat_rate: 5.00
      }));
      setItems(formItems);
    } else {
      setItems([]);
    }
  }, [poId, matchDetails]);

  const handleItemValChange = (index: number, key: string, val: any) => {
    const updated = [...items];
    (updated[index] as any)[key] = val;
    setItems(updated);
  };

  const handleAddDirectExpenseRow = () => {
    setItems(prev => [...prev, { po_item_id: null, description: '', quantity: 1, unit_price: 0, vat_rate: 5.00 }]);
  };

  const handleRemoveDirectExpenseRow = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0);
  const vat = subtotal * 0.05;
  const total = subtotal + vat;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      alert('Please select a supplier.');
      return;
    }
    if (!supplierInvoiceNumber) {
      alert('Please enter the vendor invoice number.');
      return;
    }
    if (!sourceDocumentId) {
      alert('You must link the supplier delivery note / invoice PDF from the DMS.');
      return;
    }

    try {
      setLoading(true);

      const invoiceData = {
        supplier_id: supplierId,
        supplier_invoice_number: supplierInvoiceNumber,
        po_id: invoiceType === 'PO_MATCHED' && poId ? poId : null,
        project_id: projectId || null,
        invoice_type: invoiceType,
        invoice_date: invoiceDate,
        received_date: receivedDate,
        due_date: dueDate,
        source_document_id: sourceDocumentId,
        expense_category: invoiceType === 'DIRECT_EXPENSE' ? expenseCategory : null,
        notes,
      };

      const result = await supplierInvoiceService.registerSupplierInvoice(
        invoiceData as any,
        items,
        invoiceSupplierTrn
      );

      router.push(`/finance/ap/match/${result.id}`);
    } catch (err: any) {
      console.error(err);
      alert('Failed to register invoice: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060814] text-slate-100 flex flex-col font-sans">
<main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Header */}
        <div>
          <div className="text-[10px] text-slate-500 font-mono uppercase tracking-widest flex items-center gap-1">
            <Link href="/finance/ap" className="hover:text-emerald-400 flex items-center gap-0.5"><ArrowLeft size={10} /> Registry</Link> &gt; <span>Register Supplier Bill</span>
          </div>
          <h1 className="font-heading font-extrabold text-2xl tracking-tight text-slate-100 uppercase mt-1">
            Register Supplier Invoice (AP)
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-6">
          {/* Form */}
          <div className="flex-1 bg-slate-950/40 border border-slate-900 rounded p-6 flex flex-col gap-5">
            <h3 className="text-xs font-mono text-emerald-400 uppercase tracking-wider border-b border-slate-900 pb-2">
              Bill metadata
            </h3>

            {/* Selection Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-slate-400 font-mono uppercase mb-1.5">Supplier / Vendor</label>
                <select
                  value={supplierId}
                  onChange={e => { setSupplierId(e.target.value); setPoId(''); }}
                  className="w-full bg-[#0a0f26] border border-slate-800 rounded py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                  required
                >
                  <option value="">Choose Supplier...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-mono uppercase mb-1.5">Registration Type</label>
                <select
                  value={invoiceType}
                  onChange={e => setInvoiceType(e.target.value as any)}
                  className="w-full bg-[#0a0f26] border border-slate-800 rounded py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="PO_MATCHED">LPO-GRN Matched Purchase</option>
                  <option value="DIRECT_EXPENSE">Direct Administrative Expense</option>
                </select>
              </div>
            </div>

            {/* PO & Project row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {invoiceType === 'PO_MATCHED' ? (
                <div>
                  <label className="block text-[10px] text-slate-400 font-mono uppercase mb-1.5">Select Purchase Order (LPO)</label>
                  <select
                    value={poId}
                    onChange={e => setPoId(e.target.value)}
                    className="w-full bg-[#0a0f26] border border-slate-800 rounded py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 font-mono"
                    required={invoiceType === 'PO_MATCHED'}
                  >
                    <option value="">Choose LPO Reference...</option>
                    {purchaseOrders.map(p => (
                      <option key={p.id} value={p.id}>{p.po_number} (Val: {formatAED(p.total)})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] text-slate-400 font-mono uppercase mb-1.5">Administrative Expense Category</label>
                  <select
                    value={expenseCategory}
                    onChange={e => setExpenseCategory(e.target.value)}
                    className="w-full bg-[#0a0f26] border border-slate-800 rounded py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                    required={invoiceType === 'DIRECT_EXPENSE'}
                  >
                    <option value="">Choose Category...</option>
                    <option value="RENT">Rent & Leases</option>
                    <option value="UTILITIES">DEWA / Web / Telecom</option>
                    <option value="FUEL">Vehicle Diesel & Petrol</option>
                    <option value="SALARIES_PLACEHOLDER">Payroll</option>
                    <option value="OTHER">Other Misc Overhead</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] text-slate-400 font-mono uppercase mb-1.5">Associated Project</label>
                <select
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                  className="w-full bg-[#0a0f26] border border-slate-800 rounded py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 font-mono"
                >
                  <option value="">Company Overhead / No Project</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.project_number} — {p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Invoice properties */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[10px] text-slate-400 font-mono uppercase mb-1.5">Supplier Invoice Number</label>
                <input
                  type="text"
                  placeholder="e.g. INV-9042..."
                  value={supplierInvoiceNumber}
                  onChange={e => setSupplierInvoiceNumber(e.target.value)}
                  className="w-full bg-[#0a0f26] border border-slate-800 rounded py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-mono uppercase mb-1.5">Invoice Date</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={e => setInvoiceDate(e.target.value)}
                  className="w-full bg-[#0a0f26] border border-slate-800 rounded py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-mono uppercase mb-1.5">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full bg-[#0a0f26] border border-slate-800 rounded py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 font-mono"
                  required
                />
              </div>
            </div>

            {/* Document link & TRN */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-slate-400 font-mono uppercase mb-1.5">Supplier TRN (on Invoice)</label>
                <input
                  type="text"
                  placeholder="15-digit Tax Registration Number"
                  value={invoiceSupplierTrn}
                  onChange={e => setInvoiceSupplierTrn(e.target.value)}
                  className="w-full bg-[#0a0f26] border border-slate-800 rounded py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-mono uppercase mb-1.5">Link Invoice PDF (from DMS)</label>
                <select
                  value={sourceDocumentId}
                  onChange={e => setSourceDocumentId(e.target.value)}
                  className="w-full bg-[#0a0f26] border border-slate-800 rounded py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                  required
                >
                  <option value="">Select scanned PDF document...</option>
                  {documents.map(d => (
                    <option key={d.id} value={d.id}>{d.original_filename} ({d.title})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Items Grid for matching */}
            <div className="flex flex-col gap-3 mt-4">
              <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                <span className="text-[10px] text-slate-400 font-mono uppercase">Invoiced Line items</span>
                {invoiceType === 'DIRECT_EXPENSE' && (
                  <button
                    type="button"
                    onClick={handleAddDirectExpenseRow}
                    className="px-2.5 py-1 bg-slate-900 border border-slate-800 text-[10px] text-emerald-400 font-mono rounded hover:bg-slate-800 uppercase"
                  >
                    + Add Expense Row
                  </button>
                )}
              </div>

              {invoiceType === 'PO_MATCHED' && items.length === 0 && (
                <p className="text-xs text-slate-500 font-mono py-4 text-center">Select a Purchase Order to load items for matching.</p>
              )}

              {/* Matrix list */}
              {items.map((item, idx) => {
                // Find matching PO item details
                const poMatch = matchDetails.find(m => m.poItemId === item.po_item_id);
                const isPriceMismatch = poMatch && Math.abs((item.unit_price - poMatch.poUnitPrice) / poMatch.poUnitPrice) > 0.005;
                const isQtyExceeds = poMatch && item.quantity > poMatch.qtyOutstandingToInvoice;

                return (
                  <div 
                    key={idx} 
                    className={`flex flex-col gap-3 bg-[#0a0f26]/30 p-4 rounded border ${
                      isQtyExceeds ? 'border-rose-500/40 bg-rose-500/5' : isPriceMismatch ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-900/60'
                    }`}
                  >
                    <div className="text-[10px] font-mono flex flex-wrap justify-between gap-2 text-slate-400">
                      <span className="font-semibold text-slate-200">{item.description}</span>
                      {poMatch && (
                        <div className="flex gap-3 text-slate-500">
                          <span>PO Ordered Qty: <strong className="text-slate-400">{poMatch.poQty}</strong></span>
                          <span>GRN Received Qty: <strong className="text-slate-400">{poMatch.qtyReceived}</strong></span>
                          <span>Outstanding to Bill: <strong className="text-emerald-400">{poMatch.qtyOutstandingToInvoice}</strong></span>
                          <span>PO Price: <strong className="text-slate-400">{poMatch.poUnitPrice.toFixed(2)} AED</strong></span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col md:flex-row gap-3 items-center mt-1">
                      {item.po_item_id === null && (
                        <div className="flex-1 w-full">
                          <input
                            type="text"
                            placeholder="Expense description..."
                            value={item.description}
                            onChange={e => handleItemValChange(idx, 'description', e.target.value)}
                            className="w-full bg-[#0a0f26] border border-slate-800 rounded py-1 px-2.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                            required
                          />
                        </div>
                      )}
                      
                      <div className="w-full md:w-32 flex items-center gap-2">
                        <span className="text-[9px] text-slate-500 font-mono uppercase">Invoiced Qty:</span>
                        <input
                          type="number"
                          step="any"
                          value={item.quantity || ''}
                          onChange={e => handleItemValChange(idx, 'quantity', Number(e.target.value))}
                          className="flex-1 bg-slate-950 border border-slate-800 rounded py-1 px-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 font-mono text-right"
                          required
                        />
                      </div>

                      <div className="w-full md:w-44 flex items-center gap-2">
                        <span className="text-[9px] text-slate-500 font-mono uppercase">Invoiced Price:</span>
                        <input
                          type="number"
                          step="0.0001"
                          value={item.unit_price || ''}
                          onChange={e => handleItemValChange(idx, 'unit_price', Number(e.target.value))}
                          className="flex-1 bg-slate-950 border border-slate-800 rounded py-1 px-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 font-mono text-right"
                          required
                        />
                      </div>

                      <div className="flex-1 text-right font-mono font-bold text-slate-300 pr-2">
                        {formatAED(item.quantity * item.unit_price)}
                      </div>

                      {invoiceType === 'DIRECT_EXPENSE' && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDirectExpenseRow(idx)}
                          className="text-slate-600 hover:text-red-400 p-1"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {/* Mismatch warnings */}
                    {poMatch && (
                      <div className="flex flex-col gap-1 text-[10px] font-mono mt-1">
                        {isQtyExceeds && (
                          <div className="text-rose-400 flex items-center gap-1.5">
                            <ShieldAlert size={12} /> WARNING: Invoiced quantity ({item.quantity}) exceeds outstanding received quantity ({poMatch.qtyOutstandingToInvoice})
                          </div>
                        )}
                        {isPriceMismatch && (
                          <div className="text-amber-400 flex items-center gap-1.5">
                            <AlertTriangle size={12} /> NOTICE: Invoiced unit price ({item.unit_price.toFixed(2)}) differs from PO price ({poMatch.poUnitPrice.toFixed(2)})
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 font-mono uppercase mb-1.5">Internal Notes</label>
              <textarea
                rows={2}
                placeholder="Dispute remarks, payment scheduling requests..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-[#0a0f26] border border-slate-800 rounded py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          {/* Sidebar Summary */}
          <div className="w-full lg:w-80 bg-slate-950/60 border border-slate-900 rounded p-6 flex flex-col gap-5 h-fit">
            <h3 className="text-xs font-mono text-emerald-400 uppercase tracking-wider border-b border-slate-900 pb-2">
              Invoice Totals
            </h3>

            <div className="flex flex-col gap-3.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Taxable amount:</span>
                <span className="font-mono text-slate-200">{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-900 pb-3">
                <span className="text-slate-400">VAT (5.00%):</span>
                <span className="font-mono text-slate-200">{vat.toFixed(2)}</span>
              </div>
              <div className="flex justify-between bg-[#0a0f26] p-3 rounded border border-slate-900 mt-2">
                <span className="font-bold text-slate-200">Total Value:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {total.toFixed(2)} AED
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || items.length === 0}
              className="w-full py-2.5 bg-emerald-400 text-slate-950 font-bold rounded hover:bg-emerald-300 transition-all uppercase tracking-wider text-xs shadow-[0_0_15px_rgba(0,229,160,0.15)] disabled:opacity-40"
            >
              {loading ? 'Registering...' : 'Register Invoice'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
export default SupplierInvoiceRegisterPage;
