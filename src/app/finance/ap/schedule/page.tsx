// ============================================================
// JEET ERP — Disbursement Scheduling & Supplier Payments
// Routes: /finance/ap/schedule
// Theme: Bloomberg Terminal Electric Mint
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supplierInvoiceService } from '@/services/supplierInvoiceService';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Wallet, AlertTriangle, CheckCircle } from 'lucide-react';

export default function DisbursementSchedulingPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [unpaidInvoices, setUnpaidInvoices] = useState<any[]>([]);
  
  // Payment Form States
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>('TRANSFER');
  const [reference, setReference] = useState<string>('');
  const [bankAccount, setBankAccount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [allocationAmounts, setAllocationAmounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load suppliers
  useEffect(() => {
    supabase
      .from('pricing_suppliers')
      .select('id, name')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (data) setSuppliers(data);
      });
  }, []);

  // Fetch unpaid invoices for selected supplier
  useEffect(() => {
    if (!selectedSupplierId) {
      setUnpaidInvoices([]);
      setAllocationAmounts({});
      return;
    }

    const loadSupplierInvoices = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch REGISTERED, APPROVED, SCHEDULED, PARTIALLY_PAID
        const { data, error } = await supabase
          .from('supplier_invoices')
          .select('*, projects(name)')
          .eq('supplier_id', selectedSupplierId)
          .in('status', ['REGISTERED', 'APPROVED', 'SCHEDULED', 'PARTIALLY_PAID'])
          .order('due_date', { ascending: true });

        if (error) throw error;
        
        setUnpaidInvoices(data || []);
        
        // Pre-fill allocations with 0
        const initialAllocs: Record<string, number> = {};
        (data || []).forEach(inv => {
          const outstanding = Number(inv.total) - Number(inv.amount_paid);
          initialAllocs[inv.id] = 0; // standard default
        });
        setAllocationAmounts(initialAllocs);
      } catch (err: any) {
        console.error('Error loading invoices:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadSupplierInvoices();
  }, [selectedSupplierId]);

  const handleAllocationChange = (invId: string, value: number, max: number) => {
    setAllocationAmounts(prev => ({
      ...prev,
      [invId]: Math.max(0, Math.min(max, value))
    }));
  };

  const handleApplyFullAmount = (invId: string, max: number) => {
    setAllocationAmounts(prev => ({
      ...prev,
      [invId]: max
    }));
  };

  const getTotalAllocated = () => {
    return Object.values(allocationAmounts).reduce((acc, curr) => acc + curr, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalPayment = getTotalAllocated();
    
    if (totalPayment <= 0) {
      alert('Please allocate a payment amount greater than 0 to at least one invoice.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const allocationsArray = Object.entries(allocationAmounts)
        .filter(([_, amount]) => amount > 0)
        .map(([invoiceId, amount]) => ({
          invoiceId,
          amount
        }));

      await supplierInvoiceService.recordSupplierPayment({
        supplier_id: selectedSupplierId,
        amount: totalPayment,
        payment_date: paymentDate,
        method: paymentMethod,
        reference,
        bank_account: bankAccount,
        notes
      }, allocationsArray);

      alert('Disbursement payment scheduled successfully!');
      router.push('/finance/ap');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to record disbursement payment.');
    } finally {
      setSaving(false);
    }
  };

  const formatAED = (v: number) => {
    return new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' AED';
  };

  return (
    <div className="min-h-screen bg-[#060814] text-slate-100 flex flex-col font-sans">
<main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Header */}
        <div>
          <div className="text-[10px] text-slate-500 font-mono uppercase tracking-widest flex items-center gap-1">
            <Link href="/finance/ap" className="hover:text-emerald-400 flex items-center gap-0.5"><ArrowLeft size={10} /> AP Registry</Link> &gt; <span className="text-slate-300">Schedule Payment</span>
          </div>
          <h1 className="font-heading font-extrabold text-2xl tracking-tight text-slate-100 uppercase mt-1">
            AP Disbursement Scheduler
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Scheduling Form */}
          <div className="md:col-span-2 flex flex-col gap-6">
            
            {/* Step 1: Select Supplier */}
            <div className="bg-slate-950/60 border border-slate-900 rounded p-6">
              <label className="text-xs font-mono text-emerald-400 uppercase tracking-wider block mb-2">
                1. Select Pricing Supplier
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full bg-[#0a0f26] border border-slate-900 rounded px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 font-sans"
                required
              >
                <option value="">-- Choose Supplier --</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Step 2: Unpaid Invoices & Allocations */}
            {selectedSupplierId && (
              <div className="bg-slate-950/60 border border-slate-900 rounded p-6">
                <label className="text-xs font-mono text-emerald-400 uppercase tracking-wider block mb-4">
                  2. Allocate Outstanding Balances
                </label>

                {loading ? (
                  <p className="text-xs font-mono text-slate-500">Querying supplier ledger records...</p>
                ) : unpaidInvoices.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 flex flex-col items-center gap-2">
                    <CheckCircle size={24} className="text-emerald-400" />
                    <p className="text-xs font-mono">No outstanding invoices found. Supplier ledger is fully paid.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {unpaidInvoices.map(inv => {
                      const outstanding = Number(inv.total) - Number(inv.amount_paid);
                      const currentAlloc = allocationAmounts[inv.id] || 0;
                      return (
                        <div key={inv.id} className="bg-[#0a0f26]/40 p-4 rounded border border-slate-900/60 flex flex-col gap-3">
                          <div className="flex justify-between items-start text-xs">
                            <div>
                              <span className="font-mono text-emerald-400 font-bold block">{inv.supplier_invoice_number}</span>
                              <span className="text-[10px] text-slate-500 block">Due Date: {new Date(inv.due_date).toLocaleDateString('en-GB')} ({inv.status})</span>
                              {inv.projects?.name && (
                                <span className="text-[9px] text-slate-400 block mt-0.5">Project: {inv.projects.name}</span>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-slate-500 block">Outstanding Balance</span>
                              <span className="font-mono font-bold block text-slate-200">{formatAED(outstanding)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="number"
                              step="0.01"
                              value={currentAlloc || ''}
                              onChange={(e) => handleAllocationChange(inv.id, Number(e.target.value), outstanding)}
                              placeholder="0.00"
                              className="bg-slate-950 border border-slate-900 rounded px-3 py-1.5 text-xs text-slate-200 font-mono w-full focus:outline-none focus:border-emerald-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleApplyFullAmount(inv.id, outstanding)}
                              className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500 hover:text-slate-950 font-mono text-[10px] uppercase font-bold px-3 py-1.5 rounded transition-all shrink-0"
                            >
                              Apply Max
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right sidebar: Payment details */}
          <div className="flex flex-col gap-6">
            <div className="bg-slate-950/60 border border-slate-900 rounded p-6 sticky top-24">
              <h3 className="text-xs font-mono text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Wallet size={16} /> Disbursement Info
              </h3>

              <div className="flex flex-col gap-4 text-xs">
                <div>
                  <label className="text-slate-500 uppercase font-mono text-[9px] block mb-1">Total Payment Amount</label>
                  <div className="font-mono text-xl font-extrabold text-slate-100 bg-slate-900 border border-slate-800 rounded p-3 text-center">
                    {formatAED(getTotalAllocated())}
                  </div>
                </div>

                <div>
                  <label className="text-slate-500 uppercase font-mono text-[9px] block mb-1">Disbursement Date</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full bg-[#0a0f26] border border-slate-900 rounded px-3 py-2 text-slate-100 font-sans focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-500 uppercase font-mono text-[9px] block mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-[#0a0f26] border border-slate-900 rounded px-3 py-2 text-slate-100 font-sans focus:outline-none focus:border-emerald-500"
                    required
                  >
                    <option value="TRANSFER">Bank Wire Transfer</option>
                    <option value="CHEQUE">Corporate Cheque</option>
                    <option value="CASH">Cash Payment</option>
                    <option value="CARD">Corporate Credit Card</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-500 uppercase font-mono text-[9px] block mb-1">Reference / Cheque Number</label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. TXN-19284 / CHQ-0029"
                    className="w-full bg-[#0a0f26] border border-slate-900 rounded px-3 py-2 text-slate-100 font-sans focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-slate-500 uppercase font-mono text-[9px] block mb-1">Debit Bank Account</label>
                  <input
                    type="text"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    placeholder="e.g. Emirates NBD Main Account"
                    className="w-full bg-[#0a0f26] border border-slate-900 rounded px-3 py-2 text-slate-100 font-sans focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-slate-500 uppercase font-mono text-[9px] block mb-1">Disbursement Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Provide optional transaction notes..."
                    className="w-full bg-[#0a0f26] border border-slate-900 rounded px-3 py-2 text-slate-100 font-sans focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded flex gap-2 items-start">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span className="text-[10px] font-mono leading-relaxed">{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving || !selectedSupplierId || getTotalAllocated() === 0}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-transparent text-slate-950 font-bold uppercase font-mono py-2.5 rounded transition-all shadow-[0_0_15px_rgba(0,229,160,0.1)] text-center cursor-pointer"
                >
                  {saving ? 'Recording Disbursement...' : 'Execute Payment'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
