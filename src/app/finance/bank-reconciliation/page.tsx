'use client';

// ============================================================
// JEET ERP — Finance: Bank Reconciliation (Page 4, list)
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import bankReconciliationService, { ReconHeader } from '@/services/bankReconciliationService';
import paymentAccountService, { PaymentAccountWithBalance } from '@/services/paymentAccountService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Landmark, Plus, X } from 'lucide-react';

const money = (v: number) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 2 }).format(v || 0);
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function BankReconciliationPage() {
  const router = useRouter();
  const [rows, setRows] = useState<(ReconHeader & { unmatched: number; total: number })[]>([]);
  const [accounts, setAccounts] = useState<PaymentAccountWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ payment_account_id: '', statement_date: new Date().toISOString().slice(0, 10), opening_balance: '', closing_balance: '' });

  const load = useCallback(async () => {
    try { setLoading(true); const [r, a] = await Promise.all([bankReconciliationService.list(), paymentAccountService.list()]); setRows(r); setAccounts(a); setError(null); }
    catch (e: any) { setError(e.message || 'Failed to load'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setBusy(true);
    try {
      const acct = accounts.find(a => a.id === form.payment_account_id);
      const id = await bankReconciliationService.create({
        payment_account_id: form.payment_account_id || null, account_name: acct?.name || undefined,
        statement_date: form.statement_date, opening_balance: Number(form.opening_balance) || (acct?.balance ?? 0),
        closing_balance: Number(form.closing_balance) || 0,
      });
      router.push(`/finance/bank-reconciliation/${id}`);
    } catch (e: any) { setError(e.message); setBusy(false); }
  };

  const unmatchedTotal = rows.reduce((s, r) => s + r.unmatched, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Bank Reconciliation"
        subtitle="Import bank statements, auto/manual match against system receipts and payments"
        breadcrumbs={[{ label: 'Finance', href: '/finance' }, { label: 'Bank Reconciliation' }]}
        actions={<Button size="sm" variant="primary" icon={Plus} onClick={() => setShow(true)}>New reconciliation</Button>}
      />

      {error && <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]"><span>{error}</span><button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button></div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3.5"><div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">Reconciliations</div><div className="text-lg font-semibold mt-1 tabular-nums">{rows.length}</div></Card>
        <Card className="p-3.5"><div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">Unmatched items</div><div className="text-lg font-semibold mt-1 tabular-nums" style={{ color: unmatchedTotal > 0 ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{unmatchedTotal}</div></Card>
        {accounts.slice(0, 2).map(a => (
          <Card key={a.id} className="p-3.5"><div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">{a.name}</div><div className="text-lg font-semibold mt-1 tabular-nums">{money(a.balance)} AED</div></Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        {loading ? <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div>
          : rows.length === 0 ? <EmptyState icon={Landmark} title="No reconciliations" description="Create a reconciliation for an account, then import its bank statement." />
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)]"><th className="px-4 py-2.5 font-medium">Account</th><th className="px-4 py-2.5 font-medium">Statement date</th><th className="px-4 py-2.5 font-medium text-right">Opening</th><th className="px-4 py-2.5 font-medium text-right">Closing</th><th className="px-4 py-2.5 font-medium text-center">Lines</th><th className="px-4 py-2.5 font-medium text-center">Unmatched</th><th className="px-4 py-2.5 font-medium">Status</th></tr></thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} onClick={() => router.push(`/finance/bank-reconciliation/${r.id}`)} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer">
                      <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">{r.account_name || '—'}</td>
                      <td className="px-4 py-2.5">{fmtDate(r.statement_date)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{money(r.opening_balance)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{money(r.closing_balance)}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums">{r.total}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums" style={{ color: r.unmatched > 0 ? 'var(--status-warning-text)' : 'var(--status-success-text)' }}>{r.unmatched}</td>
                      <td className="px-4 py-2.5">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>

      {show && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShow(false)}>
          <Card className="w-full max-w-md p-5" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-[var(--text-primary)]">New reconciliation</h3><button onClick={() => setShow(false)} className="cursor-pointer text-[var(--text-tertiary)]"><X size={16} /></button></div>
            <div className="flex flex-col gap-3">
              <div><label className="text-xs font-medium text-[var(--text-secondary)]">Account</label>
                <select value={form.payment_account_id} onChange={e => setForm({ ...form, payment_account_id: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
                  <option value="">Select account…</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({money(a.balance)})</option>)}
                </select></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs font-medium text-[var(--text-secondary)]">Date</label><input type="date" value={form.statement_date} onChange={e => setForm({ ...form, statement_date: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></div>
                <div><label className="text-xs font-medium text-[var(--text-secondary)]">Opening</label><input type="number" step="any" value={form.opening_balance} onChange={e => setForm({ ...form, opening_balance: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm text-right" /></div>
                <div><label className="text-xs font-medium text-[var(--text-secondary)]">Closing</label><input type="number" step="any" value={form.closing_balance} onChange={e => setForm({ ...form, closing_balance: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm text-right" /></div>
              </div>
              <div className="flex justify-end gap-2 mt-1"><Button variant="secondary" size="sm" onClick={() => setShow(false)}>Cancel</Button><Button variant="primary" size="sm" isLoading={busy} onClick={create}>Create &amp; import</Button></div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
