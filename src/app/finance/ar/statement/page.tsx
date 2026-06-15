// ============================================================
// JEET ERP — Customer Account Statement Ledger
// Routes: /finance/ar/statement
// Theme: Bloomberg Terminal Electric Mint
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Printer, FileText } from 'lucide-react';

function ClientStatementPageContent() {
  const searchParams = useSearchParams();
  const initialClientId = searchParams.get('client_id') || '';

  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(initialClientId);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [startingBalance, setStartingBalance] = useState(0);

  const formatAED = (v: number) => {
    return new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' AED';
  };

  // Load clients
  useEffect(() => {
    supabase.from('clients').select('id, name').then(({ data }) => {
      setClients(data || []);
      if (data && data.length > 0 && !selectedClientId) {
        setSelectedClientId(data[0].id);
      }
    });
  }, []);

  // Fetch statement ledger for selected client
  useEffect(() => {
    const fetchStatement = async () => {
      if (!selectedClientId) return;
      try {
        setLoading(true);

        // Fetch Invoices
        const { data: invoices } = await supabase
          .from('client_invoices')
          .select('invoice_number, invoice_date, net_due, status')
          .eq('client_id', selectedClientId)
          .in('status', ['APPROVED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE']);

        // Fetch Payments
        const { data: payments } = await supabase
          .from('client_payments')
          .select('payment_number, payment_date, amount, method, reference')
          .eq('client_id', selectedClientId);

        // Map entries
        const entries: any[] = [];

        for (const inv of invoices || []) {
          entries.push({
            date: new Date(inv.invoice_date),
            ref: inv.invoice_number,
            description: `Tax Invoice - Status: ${inv.status}`,
            debit: Number(inv.net_due),
            credit: 0,
            type: 'INVOICE'
          });
        }

        for (const pay of payments || []) {
          entries.push({
            date: new Date(pay.payment_date),
            ref: pay.payment_number,
            description: `Payment Receipt - Method: ${pay.method} ${pay.reference ? `(Ref: ${pay.reference})` : ''}`,
            debit: 0,
            credit: Number(pay.amount),
            type: 'PAYMENT'
          });
        }

        // Sort chronologically
        entries.sort((a, b) => a.date.getTime() - b.date.getTime());

        // Calculate running balance
        let balance = startingBalance;
        const compiledEntries = entries.map(entry => {
          balance = balance + entry.debit - entry.credit;
          return {
            ...entry,
            runningBalance: balance
          };
        });

        setLedgerEntries(compiledEntries);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatement();
  }, [selectedClientId, startingBalance]);

  const selectedClientName = clients.find(c => c.id === selectedClientId)?.name || 'Select Client';

  return (
    <div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text-primary)] flex flex-col font-sans">
<main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="text-[10px] text-[var(--text-primary)]0 font-mono uppercase tracking-widest flex items-center gap-1">
              <Link href="/finance/ar" className="hover:text-[var(--accent)] flex items-center gap-0.5"><ArrowLeft size={10} /> Registry</Link> &gt; <span className="text-[var(--text-secondary)]">Customer Statement</span>
            </div>
            <h1 className="font-heading font-extrabold text-2xl tracking-tight text-[var(--text-primary)] uppercase mt-1">
              Customer Statement Ledger
            </h1>
          </div>

          <button
            onClick={() => window.print()}
            className="quote-btn quote-btn-secondary font-mono text-xs uppercase"
          >
            <Printer size={13} /> Print Statement
          </button>
        </div>

        {/* Client Selection Row */}
        <div className="quote-card flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-2.5 w-full md:w-fit">
            <span className="text-xs text-[var(--text-secondary)] font-mono uppercase">Select Customer:</span>
            <select
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
              className="quote-filter-input w-full md:w-64"
            >
              <option value="">Choose Customer...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="text-right text-xs bg-[var(--bg-card)] border border-[var(--border)] p-3 rounded font-mono">
            <span className="text-[var(--text-primary)]0 uppercase mr-2 text-[10px]">Current Balance:</span>
            <span className="text-[var(--accent)] font-bold text-sm">
              {ledgerEntries.length > 0 ? formatAED(ledgerEntries[ledgerEntries.length - 1].runningBalance) : '0.00 AED'}
            </span>
          </div>
        </div>

        {/* Statement Ledger List */}
        <div className="quote-table-wrap">
          <table className="quote-table">
              <thead>
                <tr className="bg-[var(--bg-card)] border-b border-[var(--border)] text-[var(--text-secondary)] font-mono uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Document Ref</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4 text-right">Debit (Charge)</th>
                  <th className="py-3.5 px-4 text-right">Credit (Receipt)</th>
                  <th className="py-3.5 px-4 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[var(--text-primary)]0 font-mono">
                      Querying customer transaction ledger...
                    </td>
                  </tr>
                ) : ledgerEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[var(--text-primary)]0 font-mono">
                      No matching records in the statement.
                    </td>
                  </tr>
                ) : (
                  ledgerEntries.map((entry, idx) => (
                    <tr key={idx} className="border-b border-[var(--border)] text-[var(--text-secondary)]">
                      <td className="py-3.5 px-4 font-mono text-[var(--text-secondary)]">
                        {entry.date.toLocaleDateString('en-GB')}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-[var(--text-primary)]">
                        {entry.ref}
                      </td>
                      <td className="py-3.5 px-4 text-[var(--text-secondary)]">
                        {entry.description}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-[var(--status-danger-text)]">
                        {entry.debit > 0 ? formatAED(entry.debit) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-[var(--accent)]">
                        {entry.credit > 0 ? formatAED(entry.credit) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-[var(--text-primary)] bg-[var(--bg-card)]/10">
                        {formatAED(entry.runningBalance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
        </div>
      </main>
    </div>
  );
}

export default function ClientStatementPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text-primary)] flex items-center justify-center font-mono text-xs text-[var(--accent)]">Loading...</div>}>
      <ClientStatementPageContent />
    </React.Suspense>
  );
}
