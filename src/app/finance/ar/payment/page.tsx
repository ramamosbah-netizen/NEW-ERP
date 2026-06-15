// ============================================================
// JEET ERP — Record Client Payment (Receipt)
// Routes: /finance/ar/payment
// Theme: Bloomberg Terminal Electric Mint
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { paymentService } from '@/services/paymentService';
import { ArrowLeft, Save } from 'lucide-react';

function PaymentRecordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialClientId = searchParams.get('client_id') || '';
  const initialInvoiceId = searchParams.get('invoice_id') || '';

  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(initialClientId);
  const [unpaidInvoices, setUnpaidInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form Fields
  const [amount, setAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState<'TRANSFER' | 'CHEQUE' | 'CASH' | 'CARD'>('TRANSFER');
  const [reference, setReference] = useState('');
  const [bankAccount, setBankAccount] = useState('10100'); // default bank GL code
  const [notes, setNotes] = useState('');

  // Allocation Map: invoiceId -> allocated amount
  const [allocations, setAllocations] = useState<Record<string, number>>({});

  // Load clients
  useEffect(() => {
    supabase.from('clients').select('id, name').then(({ data }) => {
      setClients(data || []);
      if (data && data.length > 0 && !selectedClientId) {
        setSelectedClientId(data[0].id);
      }
    });
  }, []);

  // Fetch unpaid invoices for selected client
  useEffect(() => {
    const fetchInvoices = async () => {
      if (!selectedClientId) {
        setUnpaidInvoices([]);
        return;
      }

      const { data } = await supabase
        .from('client_invoices')
        .select('id, invoice_number, net_due, amount_paid, invoice_date')
        .eq('client_id', selectedClientId)
        .in('status', ['APPROVED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE']);

      const invoices = (data || []).map(inv => ({
        ...inv,
        outstanding: Number(inv.net_due) - Number(inv.amount_paid)
      })).filter(inv => inv.outstanding > 0);

      setUnpaidInvoices(invoices);

      // Pre-fill allocation if invoice_id is passed in url
      if (initialInvoiceId) {
        const matching = invoices.find(i => i.id === initialInvoiceId);
        if (matching) {
          setAllocations({ [matching.id]: matching.outstanding });
          setAmount(matching.outstanding);
        }
      } else {
        setAllocations({});
      }
    };

    fetchInvoices();
  }, [selectedClientId, initialInvoiceId]);

  const handleAllocChange = (invoiceId: string, val: number) => {
    setAllocations(prev => ({
      ...prev,
      [invoiceId]: Math.max(0, val)
    }));
  };

  // Calculate sum of allocations
  const allocatedSum = Object.values(allocations).reduce((sum, v) => sum + Number(v), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClientId) {
      alert('Please select a customer.');
      return;
    }
    if (amount <= 0) {
      alert('Payment amount must be greater than zero.');
      return;
    }
    if (Math.abs(allocatedSum - amount) > 0.01) {
      alert(`Allocation mismatch: Total payment is ${amount} AED, but you allocated ${allocatedSum} AED.`);
      return;
    }

    try {
      setLoading(true);

      const paymentData = {
        client_id: selectedClientId,
        amount,
        payment_date: paymentDate,
        method,
        reference,
        bank_account: bankAccount,
        notes,
      };

      const mappedAllocations = Object.entries(allocations)
        .filter(([_, amt]) => amt > 0)
        .map(([invId, amt]) => ({
          invoiceId: invId,
          amount: amt
        }));

      await paymentService.recordPayment(paymentData as any, mappedAllocations);
      router.push('/finance/ar');
    } catch (err: any) {
      console.error(err);
      alert('Failed to record payment: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text-primary)] flex flex-col font-sans">
<main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Header */}
        <div>
          <div className="text-[10px] text-[var(--text-primary)]0 font-mono uppercase tracking-widest flex items-center gap-1">
            <Link href="/finance/ar" className="hover:text-[var(--accent)] flex items-center gap-0.5"><ArrowLeft size={10} /> Registry</Link> &gt; <span className="text-[var(--text-secondary)]">Record Payment</span>
          </div>
          <h1 className="font-heading font-extrabold text-2xl tracking-tight text-[var(--text-primary)] uppercase mt-1">
            Record Client Payment (Receipt)
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-6">
          {/* Inputs */}
          <div className="quote-card flex-1 flex flex-col gap-5">
            <h3 className="quote-card-title text-xs font-mono text-[var(--accent)] uppercase tracking-wider border-b border-[var(--border)] pb-2">
              Receipt parameters
            </h3>

            <div className="quote-form-group">
              <label>Customer Name</label>
              <select
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
                className="quote-form-input w-full"
                required
              >
                <option value="">Select Customer...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="quote-form-group">
                <label>Total Amount (AED)</label>
                <input
                  type="number"
                  step="0.01"
                  value={amount || ''}
                  onChange={e => setAmount(Number(e.target.value))}
                  className="quote-form-input w-full font-mono text-right font-bold"
                  required
                />
              </div>

              <div className="quote-form-group">
                <label>Payment Date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  className="quote-form-input w-full font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="quote-form-group">
                <label>Payment Method</label>
                <select
                  value={method}
                  onChange={e => setMethod(e.target.value as any)}
                  className="quote-form-input w-full"
                >
                  <option value="TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                </select>
              </div>

              <div className="quote-form-group">
                <label>Transaction Reference</label>
                <input
                  type="text"
                  placeholder="Cheque # or Transfer ID..."
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  className="quote-form-input w-full font-mono"
                />
              </div>

              <div className="quote-form-group">
                <label>Bank GL Account</label>
                <select
                  value={bankAccount}
                  onChange={e => setBankAccount(e.target.value)}
                  className="quote-form-input w-full font-mono"
                >
                  <option value="10100">10100 - Emirates NBD Current</option>
                  <option value="10200">10200 - Mashreq Operating</option>
                  <option value="10500">10500 - Petty Cash</option>
                </select>
              </div>
            </div>

            <div className="quote-form-group">
              <label>Remarks / Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="quote-form-textarea w-full"
                placeholder="Receipt notes..."
              />
            </div>
          </div>

          {/* Allocation Sidebar Panel */}
          <div className="quote-card w-full md:w-96 flex flex-col gap-5">
            <h3 className="quote-card-title text-xs font-mono text-[var(--accent)] uppercase tracking-wider border-b border-[var(--border)] pb-2">
              Invoice allocations
            </h3>

            {unpaidInvoices.length === 0 ? (
              <p className="text-xs text-[var(--text-primary)]0 font-mono py-4 text-center">No outstanding client invoices found for this customer.</p>
            ) : (
              <div className="flex flex-col gap-4 max-h-72 overflow-y-auto pr-1">
                {unpaidInvoices.map(inv => (
                  <div key={inv.id} className="bg-[var(--bg-card)]/30 border border-[var(--border)] p-3 rounded flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-mono font-bold text-[var(--text-primary)]">{inv.invoice_number}</span>
                      <span className="text-[10px] text-[var(--text-primary)]0 font-mono">Due: {inv.outstanding.toFixed(2)} AED</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--text-primary)]0 font-mono uppercase">Allocate:</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={allocations[inv.id] || ''}
                        onChange={e => handleAllocChange(inv.id, Number(e.target.value))}
                        className="quote-form-input flex-1 font-mono text-right"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-[var(--border)] pt-4 flex flex-col gap-2.5 text-xs font-mono">
              <div className="flex justify-between text-[var(--text-primary)]0">
                <span>Total Payment:</span>
                <span>{amount.toFixed(2)} AED</span>
              </div>
              <div className="flex justify-between text-[var(--text-primary)]0">
                <span>Total Allocated:</span>
                <span>{allocatedSum.toFixed(2)} AED</span>
              </div>
              <div className="flex justify-between border-t border-[var(--border)] pt-2.5 font-bold">
                <span>Unallocated Remaining:</span>
                <span className={Math.abs(amount - allocatedSum) < 0.01 ? 'text-[var(--accent)]' : 'text-[var(--status-warning-text)]'}>
                  {Math.max(0, amount - allocatedSum).toFixed(2)} AED
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || unpaidInvoices.length === 0}
              onClick={handleSubmit}
              className="quote-btn quote-btn-primary w-full uppercase tracking-wider text-xs font-bold"
            >
              {loading ? 'Recording...' : 'Record Receipt'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default function PaymentRecordPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text-primary)] flex items-center justify-center font-mono text-xs text-[var(--accent)]">Loading...</div>}>
      <PaymentRecordPageContent />
    </React.Suspense>
  );
}
