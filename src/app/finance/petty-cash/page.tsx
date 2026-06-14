'use client';

// ============================================================
// JEET ERP — Finance: Petty Cash (Page 8)
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import pettyCashService, { PettyFund, PettyTxn, PettyTxnType } from '@/services/pettyCashService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Banknote, Plus, X, Check, Ban, AlertTriangle } from 'lucide-react';

const money = (v: number) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 2 }).format(v || 0);
const TYPE_LABEL: Record<string, string> = { EXPENSE: 'Expense', REPLENISH: 'Replenish', RETURN: 'Return' };
const ST: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)' },
  APPROVED: { bg: 'var(--status-success-bg)', text: 'var(--status-success-text)' },
  REJECTED: { bg: 'var(--status-danger-bg)', text: 'var(--status-danger-text)' },
};

export default function PettyCashPage() {
  const [funds, setFunds] = useState<PettyFund[]>([]);
  const [txns, setTxns] = useState<PettyTxn[]>([]);
  const [projects, setProjects] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showFund, setShowFund] = useState(false);
  const [showTxn, setShowTxn] = useState(false);
  const [fundForm, setFundForm] = useState({ name: '', custodian_name: '', opening_balance: '', low_threshold: '' });
  const [txnForm, setTxnForm] = useState({ fund_id: '', type: 'EXPENSE' as PettyTxnType, amount: '', category: '', description: '', project_id: '' });

  const load = useCallback(async () => {
    try { setLoading(true); const [f, t] = await Promise.all([pettyCashService.listFunds(), pettyCashService.listTransactions()]); setFunds(f); setTxns(t); setError(null); }
    catch (e: any) { setError(e.message || 'Failed to load'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { supabase.from('projects').select('id, project_number, name').order('project_number', { ascending: false }).then(({ data }) => setProjects((data || []).map((p: any) => ({ id: p.id, label: `${p.project_number} — ${p.name}` })))); }, []);

  const totalBalance = funds.reduce((s, f) => s + f.balance, 0);
  const pendingTotal = funds.reduce((s, f) => s + f.pending, 0);
  const replenishCount = funds.filter(f => f.needsReplenish).length;
  const fundName = (id: string) => funds.find(f => f.id === id)?.name || '—';

  const addFund = async () => { setBusy(true); try { await pettyCashService.createFund({ name: fundForm.name, custodian_name: fundForm.custodian_name, opening_balance: Number(fundForm.opening_balance), low_threshold: Number(fundForm.low_threshold) }); setShowFund(false); setFundForm({ name: '', custodian_name: '', opening_balance: '', low_threshold: '' }); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(false); } };
  const addTxn = async () => { setBusy(true); try { await pettyCashService.createTransaction({ fund_id: txnForm.fund_id, type: txnForm.type, amount: Number(txnForm.amount), category: txnForm.category, description: txnForm.description, project_id: txnForm.project_id || null }); setShowTxn(false); setTxnForm({ fund_id: '', type: 'EXPENSE', amount: '', category: '', description: '', project_id: '' }); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(false); } };
  const setStatus = async (id: string, status: 'APPROVED' | 'REJECTED') => { await pettyCashService.setStatus(id, status); await load(); };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Petty Cash"
        subtitle="Cash floats, expense claims, approvals and replenishment"
        breadcrumbs={[{ label: 'Finance', href: '/finance' }, { label: 'Petty Cash' }]}
        actions={<div className="flex gap-2"><Button size="sm" variant="secondary" icon={Plus} onClick={() => setShowFund(true)}>New fund</Button><Button size="sm" variant="primary" icon={Plus} onClick={() => setShowTxn(true)} disabled={funds.length === 0}>Record transaction</Button></div>}
      />

      {error && <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]"><span>{error}</span><button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button></div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-3.5"><div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">Available balance</div><div className="text-lg font-semibold mt-1 tabular-nums">{money(totalBalance)} AED</div></Card>
        <Card className="p-3.5"><div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">Pending claims</div><div className="text-lg font-semibold mt-1 tabular-nums" style={{ color: pendingTotal > 0 ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{money(pendingTotal)} AED</div></Card>
        <Card className="p-3.5"><div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">Replenishment required</div><div className="text-lg font-semibold mt-1 tabular-nums" style={{ color: replenishCount > 0 ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{replenishCount} fund(s)</div></Card>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {funds.map(f => (
          <Card key={f.id} className="p-3.5">
            <div className="flex items-center justify-between"><div className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-1.5"><Banknote size={14} /> {f.name}</div>{f.needsReplenish && <AlertTriangle size={14} className="text-[var(--status-danger-text)]" />}</div>
            <div className="text-lg font-semibold tabular-nums mt-1" style={{ color: f.needsReplenish ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{money(f.balance)} AED</div>
            <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{f.custodian_name || '—'} · pending {money(f.pending)} · threshold {money(f.low_threshold)}</div>
          </Card>
        ))}
        {funds.length === 0 && !loading && <Card className="p-4 md:col-span-3"><EmptyState icon={Banknote} title="No petty cash funds" description="Create a cash float to record expense claims and replenishments." /></Card>}
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] text-sm font-semibold text-[var(--text-primary)]">Transactions</div>
        {loading ? <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div>
          : txns.length === 0 ? <EmptyState icon={Banknote} title="No transactions" description="Expense claims, replenishments and returns appear here." />
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)]"><th className="px-4 py-2.5 font-medium">Date</th><th className="px-4 py-2.5 font-medium">Fund</th><th className="px-4 py-2.5 font-medium">Type</th><th className="px-4 py-2.5 font-medium">Description</th><th className="px-4 py-2.5 font-medium text-right">Amount</th><th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 font-medium text-right">Action</th></tr></thead>
                <tbody>
                  {txns.map(t => {
                    const s = ST[t.status];
                    return (
                      <tr key={t.id} className="border-b border-[var(--border)] last:border-0">
                        <td className="px-4 py-2.5">{t.txn_date}</td>
                        <td className="px-4 py-2.5">{fundName(t.fund_id)}</td>
                        <td className="px-4 py-2.5">{TYPE_LABEL[t.type]}</td>
                        <td className="px-4 py-2.5 text-[var(--text-secondary)]">{t.category ? `${t.category} · ` : ''}{t.description || '—'}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: t.type === 'EXPENSE' ? 'var(--status-danger-text)' : 'var(--status-success-text)' }}>{t.type === 'EXPENSE' ? '−' : '+'}{money(t.amount)}</td>
                        <td className="px-4 py-2.5"><span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.text }}>{t.status}</span></td>
                        <td className="px-4 py-2.5 text-right">
                          {t.status === 'PENDING' && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button onClick={() => setStatus(t.id, 'APPROVED')} title="Approve" className="p-1 rounded border border-[var(--border)] text-[var(--status-success-text)] hover:bg-[var(--surface-hover)] cursor-pointer"><Check size={12} /></button>
                              <button onClick={() => setStatus(t.id, 'REJECTED')} title="Reject" className="p-1 rounded border border-[var(--border)] text-[var(--status-danger-text)] hover:bg-[var(--surface-hover)] cursor-pointer"><Ban size={12} /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </Card>

      {showFund && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowFund(false)}>
          <Card className="w-full max-w-md p-5" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-[var(--text-primary)]">New petty cash fund</h3><button onClick={() => setShowFund(false)} className="cursor-pointer text-[var(--text-tertiary)]"><X size={16} /></button></div>
            <div className="flex flex-col gap-3">
              <div><label className="text-xs font-medium text-[var(--text-secondary)]">Fund name *</label><input value={fundForm.name} onChange={e => setFundForm({ ...fundForm, name: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)]">Custodian</label><input value={fundForm.custodian_name} onChange={e => setFundForm({ ...fundForm, custodian_name: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-[var(--text-secondary)]">Opening balance</label><input type="number" step="any" value={fundForm.opening_balance} onChange={e => setFundForm({ ...fundForm, opening_balance: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm text-right" /></div>
                <div><label className="text-xs font-medium text-[var(--text-secondary)]">Low threshold</label><input type="number" step="any" value={fundForm.low_threshold} onChange={e => setFundForm({ ...fundForm, low_threshold: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm text-right" /></div>
              </div>
              <div className="flex justify-end gap-2 mt-1"><Button variant="secondary" size="sm" onClick={() => setShowFund(false)}>Cancel</Button><Button variant="primary" size="sm" isLoading={busy} disabled={!fundForm.name.trim()} onClick={addFund}>Create</Button></div>
            </div>
          </Card>
        </div>
      )}

      {showTxn && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowTxn(false)}>
          <Card className="w-full max-w-md p-5" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-[var(--text-primary)]">Record transaction</h3><button onClick={() => setShowTxn(false)} className="cursor-pointer text-[var(--text-tertiary)]"><X size={16} /></button></div>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-[var(--text-secondary)]">Fund *</label><select value={txnForm.fund_id} onChange={e => setTxnForm({ ...txnForm, fund_id: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm"><option value="">Select…</option>{funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
                <div><label className="text-xs font-medium text-[var(--text-secondary)]">Type</label><select value={txnForm.type} onChange={e => setTxnForm({ ...txnForm, type: e.target.value as PettyTxnType })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm"><option value="EXPENSE">Expense claim</option><option value="REPLENISH">Replenish</option><option value="RETURN">Return cash</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-[var(--text-secondary)]">Amount *</label><input type="number" step="any" value={txnForm.amount} onChange={e => setTxnForm({ ...txnForm, amount: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm text-right" /></div>
                <div><label className="text-xs font-medium text-[var(--text-secondary)]">Category</label><input value={txnForm.category} onChange={e => setTxnForm({ ...txnForm, category: e.target.value })} placeholder="fuel, supplies…" className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></div>
              </div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)]">Project (optional)</label><select value={txnForm.project_id} onChange={e => setTxnForm({ ...txnForm, project_id: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm"><option value="">Overhead</option>{projects.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)]">Description</label><input value={txnForm.description} onChange={e => setTxnForm({ ...txnForm, description: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></div>
              <p className="text-[11px] text-[var(--text-tertiary)]">Expense claims start as <strong>Pending</strong> for approval; replenish/return post immediately.</p>
              <div className="flex justify-end gap-2 mt-1"><Button variant="secondary" size="sm" onClick={() => setShowTxn(false)}>Cancel</Button><Button variant="primary" size="sm" isLoading={busy} disabled={!txnForm.fund_id || !(Number(txnForm.amount) > 0)} onClick={addTxn}>Record</Button></div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
