'use client';

// ============================================================
// JEET ERP — Expenses & Payment Accounts (AP)
// Capture every payment — LPO / non-LPO purchases, car petrol,
// petty cash, office expense — as an invoiced AP bill, paid from
// a tracked card/bank/cash account, bucketed to Project / Petty
// cash / Office. Accounts show a running balance.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import paymentAccountService, { PaymentAccountWithBalance, AccountType } from '@/services/paymentAccountService';
import { supplierInvoiceService } from '@/services/supplierInvoiceService';
import { runUploadPipeline } from '@/lib/document-upload-service';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Wallet, CreditCard, Banknote, Plus, X, Save, Receipt, Paperclip, Check } from 'lucide-react';

const money = (v: number) => new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const ACCT_ICON: Record<AccountType, any> = { BANK: Wallet, CARD: CreditCard, CASH: Banknote, PETTY_CASH: Banknote };
const ACCT_LABEL: Record<AccountType, string> = { BANK: 'Bank', CARD: 'Card', CASH: 'Cash', PETTY_CASH: 'Petty cash' };
const CATEGORIES = ['FUEL', 'VEHICLE', 'MATERIAL', 'TOOLS', 'TRANSPORT', 'WORKFORCE', 'MAINTENANCE', 'OFFICE_SUPPLIES', 'RENT', 'UTILITIES', 'SUBCONTRACTOR', 'PETTY_CASH', 'OTHER'];
const BUCKETS = [
  { key: 'PROJECT', label: 'Project (LPO / site)' },
  { key: 'PETTY_CASH', label: 'Petty cash (project)' },
  { key: 'OFFICE', label: 'Office expense (overhead)' },
] as const;

export default function ExpensesAccountsPage() {
  const [accounts, setAccounts] = useState<PaymentAccountWithBalance[]>([]);
  const [projects, setProjects] = useState<{ id: string; label: string }[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // account modal
  const [showAcct, setShowAcct] = useState(false);
  const [acctForm, setAcctForm] = useState({ name: '', type: 'CARD' as AccountType, account_ref: '', opening_balance: '' });

  // expense form
  const [exp, setExp] = useState({
    cost_bucket: 'PROJECT' as 'PROJECT' | 'PETTY_CASH' | 'OFFICE',
    project_id: '', payee_name: '', expense_category: 'MATERIAL',
    supplier_invoice_number: '', invoice_date: new Date().toISOString().slice(0, 10),
    amount: '', vat_applicable: true, payment_account_id: '', mark_paid: true, notes: '',
  });

  // receipt attachment
  const [receipt, setReceipt] = useState<{ docId: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [accts, recentBills] = await Promise.all([
        paymentAccountService.list(),
        supplierInvoiceService.fetchSupplierInvoices({}),
      ]);
      setAccounts(accts);
      setRecent((recentBills as any[]).filter(b => b.cost_bucket).slice(0, 30));
    } catch (err: any) { setError(err.message || 'Failed to load'); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    supabase.from('projects').select('id, project_number, name').order('project_number', { ascending: false })
      .then(({ data }) => setProjects((data || []).map((p: any) => ({ id: p.id, label: `${p.project_number} — ${p.name}` }))));
  }, []);

  const amount = Number(exp.amount) || 0;
  const vat = exp.vat_applicable ? Math.round(amount * 0.05 * 100) / 100 : 0;
  const total = Math.round((amount + vat) * 100) / 100;

  const addAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acctForm.name.trim()) return;
    setBusy(true);
    try {
      await paymentAccountService.create({
        name: acctForm.name, type: acctForm.type, account_ref: acctForm.account_ref,
        opening_balance: Number(acctForm.opening_balance) || 0,
      });
      setShowAcct(false);
      setAcctForm({ name: '', type: 'CARD', account_ref: '', opening_balance: '' });
      await load();
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  const uploadReceipt = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const entityType = exp.cost_bucket !== 'OFFICE' && exp.project_id ? 'PROJECT' : 'COMPANY';
      const entityId = entityType === 'PROJECT' ? exp.project_id : undefined;
      const doc = await runUploadPipeline(file, entityType, entityId, ['expense', 'receipt']);
      setReceipt({ docId: doc.id, name: file.name });
    } catch (err: any) {
      // Re-use an already-stored identical receipt instead of failing
      const m = /^DUPLICATE_FOUND:([^:]+):(.*)$/.exec(err?.message || '');
      if (m) setReceipt({ docId: m[1], name: m[2] || file.name });
      else setError(err.message || 'Receipt upload failed');
    } finally { setUploading(false); }
  };

  const saveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await supplierInvoiceService.recordExpense({
        cost_bucket: exp.cost_bucket,
        project_id: exp.cost_bucket === 'OFFICE' ? null : exp.project_id,
        payee_name: exp.payee_name,
        expense_category: exp.expense_category,
        supplier_invoice_number: exp.supplier_invoice_number,
        invoice_date: exp.invoice_date,
        taxable_amount: amount,
        vat_amount: vat,
        total,
        payment_account_id: exp.mark_paid ? exp.payment_account_id : null,
        source_document_id: receipt?.docId || null,
        mark_paid: exp.mark_paid,
        notes: exp.notes,
      });
      setExp(s => ({ ...s, payee_name: '', supplier_invoice_number: '', amount: '', notes: '' }));
      setReceipt(null);
      setError(null);
      await load();
    } catch (err: any) { setError(err.message || 'Failed to record expense'); } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Expenses & Payment Accounts"
        subtitle="Capture every payment as an invoiced bill — paid from a tracked account, bucketed to project, petty cash or office"
        breadcrumbs={[{ label: 'Finance', href: '/finance' }, { label: 'Payables', href: '/finance/ap' }, { label: 'Expenses' }]}
        actions={<Button size="sm" variant="secondary" onClick={() => setShowAcct(true)} icon={Plus}>Add card / account</Button>}
      />

      {error && (
        <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button>
        </div>
      )}

      {/* Accounts with balances */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {accounts.length === 0 && (
          <Card className="p-4 col-span-2 md:col-span-4 text-xs text-[var(--text-tertiary)]">
            No payment accounts yet. Add a card, bank or petty-cash float to track balances.
          </Card>
        )}
        {accounts.map(a => {
          const Icon = ACCT_ICON[a.type];
          return (
            <Card key={a.id} className="p-3.5">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
                <Icon size={13} /> {ACCT_LABEL[a.type]}{a.account_ref ? ` · ${a.account_ref}` : ''}
              </div>
              <div className="text-sm font-medium text-[var(--text-primary)] mt-1">{a.name}</div>
              <div className="text-lg font-semibold tabular-nums mt-0.5" style={{ color: a.balance < 0 ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>
                {money(a.balance)}<span className="text-xs font-normal text-[var(--text-tertiary)]"> AED</span>
              </div>
              <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">opening {money(a.opening_balance)} · out {money(a.paid_out)}</div>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Record expense */}
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] mb-3"><Receipt size={15} /> Record expense</div>
          <form onSubmit={saveExpense} className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)]">Linked to</label>
              <div className="flex gap-1.5 mt-1">
                {BUCKETS.map(b => (
                  <button type="button" key={b.key} onClick={() => setExp({ ...exp, cost_bucket: b.key })}
                    className="px-2.5 py-1.5 rounded-md text-[11px] font-medium border cursor-pointer"
                    style={{
                      background: exp.cost_bucket === b.key ? 'var(--accent)' : 'var(--surface)',
                      color: exp.cost_bucket === b.key ? 'var(--accent-fg, #fff)' : 'var(--text-secondary)',
                      borderColor: exp.cost_bucket === b.key ? 'var(--accent)' : 'var(--border)',
                    }}>{b.label}</button>
                ))}
              </div>
            </div>

            {exp.cost_bucket !== 'OFFICE' && (
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)]">Project *</label>
                <select value={exp.project_id} onChange={e => setExp({ ...exp, project_id: e.target.value })}
                  className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
                  <option value="">Select project…</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)]">Payee / supplier</label>
                <input value={exp.payee_name} onChange={e => setExp({ ...exp, payee_name: e.target.value })}
                  placeholder="e.g. ENOC, ADNOC, shop name" className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)]">Category</label>
                <select value={exp.expense_category} onChange={e => setExp({ ...exp, expense_category: e.target.value })}
                  className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)]">Invoice / receipt no *</label>
                <input value={exp.supplier_invoice_number} onChange={e => setExp({ ...exp, supplier_invoice_number: e.target.value })}
                  placeholder="required" className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)]">Date</label>
                <input type="date" value={exp.invoice_date} onChange={e => setExp({ ...exp, invoice_date: e.target.value })}
                  className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)]">Amount (excl. VAT)</label>
                <input type="number" min="0" step="any" value={exp.amount} onChange={e => setExp({ ...exp, amount: e.target.value })}
                  placeholder="0.00" className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm text-right" />
              </div>
              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] h-9 cursor-pointer">
                <input type="checkbox" checked={exp.vat_applicable} onChange={e => setExp({ ...exp, vat_applicable: e.target.checked })} /> +5% VAT
              </label>
            </div>
            <div className="text-[11px] text-[var(--text-tertiary)] tabular-nums">VAT {money(vat)} · <span className="text-[var(--text-primary)] font-medium">Total {money(total)} AED</span></div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)]">Paid from {exp.mark_paid ? '*' : ''}</label>
                <select value={exp.payment_account_id} onChange={e => setExp({ ...exp, payment_account_id: e.target.value })}
                  disabled={!exp.mark_paid}
                  className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm disabled:opacity-50">
                  <option value="">Select account…</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({money(a.balance)})</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] h-9 cursor-pointer">
                <input type="checkbox" checked={exp.mark_paid} onChange={e => setExp({ ...exp, mark_paid: e.target.checked })} /> Paid now
              </label>
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)]">Receipt photo / PDF</label>
              {receipt ? (
                <div className="flex items-center gap-2 mt-1 text-xs text-[var(--status-success-text)] bg-[var(--status-success-bg)] border border-[var(--status-success-border)] rounded-md px-3 py-2">
                  <Check size={13} /> <span className="flex-1 truncate">{receipt.name}</span>
                  <button type="button" onClick={() => setReceipt(null)} className="cursor-pointer text-[var(--text-tertiary)]"><X size={13} /></button>
                </div>
              ) : (
                <label className="flex items-center gap-2 mt-1 px-3 h-9 rounded-md border border-dashed border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text-tertiary)] cursor-pointer hover:border-[var(--accent)]">
                  <Paperclip size={13} /> {uploading ? 'Uploading…' : 'Attach receipt (image or PDF)'}
                  <input type="file" accept="image/*,application/pdf" className="hidden" disabled={uploading}
                    onChange={e => uploadReceipt(e.target.files?.[0])} />
                </label>
              )}
            </div>

            <Button type="submit" variant="primary" size="sm" icon={Save} isLoading={busy} disabled={uploading} className="mt-1">Record expense</Button>
          </form>
        </Card>

        {/* Recent expenses */}
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] text-sm font-semibold text-[var(--text-primary)]">Recent expenses</div>
          {recent.length === 0 ? (
            <EmptyState icon={Receipt} title="No expenses yet" description="Recorded expenses (project, petty cash, office) appear here and in the AP register." />
          ) : (
            <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[var(--surface)]">
                  <tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)]">
                    <th className="px-3 py-2 font-medium">Ref</th>
                    <th className="px-3 py-2 font-medium">Payee</th>
                    <th className="px-3 py-2 font-medium">Bucket</th>
                    <th className="px-3 py-2 font-medium text-right">Total</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r: any) => (
                    <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-3 py-2 font-mono text-[var(--text-secondary)]">{r.supplier_invoice_number}</td>
                      <td className="px-3 py-2 text-[var(--text-primary)]">{r.payee_name || r.supplier_name || '—'}</td>
                      <td className="px-3 py-2 text-[var(--text-tertiary)]">{(r.cost_bucket || '').replace('_', ' ')}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(Number(r.total))}</td>
                      <td className="px-3 py-2">{r.status === 'PAID' ? <span className="text-[var(--status-success-text)]">Paid</span> : r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Add account modal */}
      {showAcct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAcct(false)}>
          <Card className="w-full max-w-md p-5" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Add card / account</h3>
              <button onClick={() => setShowAcct(false)} className="cursor-pointer text-[var(--text-tertiary)]"><X size={16} /></button>
            </div>
            <form onSubmit={addAccount} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)]">Name *</label>
                <input value={acctForm.name} onChange={e => setAcctForm({ ...acctForm, name: e.target.value })}
                  placeholder="e.g. ENBD Business Card" className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Type</label>
                  <select value={acctForm.type} onChange={e => setAcctForm({ ...acctForm, type: e.target.value as AccountType })}
                    className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
                    <option value="CARD">Card</option><option value="BANK">Bank</option>
                    <option value="CASH">Cash</option><option value="PETTY_CASH">Petty cash</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Ref (last 4 / IBAN)</label>
                  <input value={acctForm.account_ref} onChange={e => setAcctForm({ ...acctForm, account_ref: e.target.value })}
                    className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)]">Opening balance (AED)</label>
                <input type="number" step="any" value={acctForm.opening_balance} onChange={e => setAcctForm({ ...acctForm, opening_balance: e.target.value })}
                  placeholder="0.00" className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm text-right" />
              </div>
              <div className="flex justify-end gap-2 mt-1">
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowAcct(false)}>Cancel</Button>
                <Button type="submit" variant="primary" size="sm" icon={Save} isLoading={busy}>Add account</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
