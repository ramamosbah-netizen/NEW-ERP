'use client';

// ============================================================
// JEET ERP — Finance: Treasury Management (Page 6)
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import treasuryService, { Facility, FacilityType } from '@/services/treasuryService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Landmark, Plus, X, AlertTriangle } from 'lucide-react';

const money = (v: number) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(v || 0);
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const TYPE_LABEL: Record<string, string> = { LOAN: 'Loan', OVERDRAFT: 'Overdraft', FACILITY: 'Facility', BANK_GUARANTEE: 'Bank Guarantee', LC: 'Letter of Credit' };
const ST: Record<string, { bg: string; text: string }> = {
  ACTIVE: { bg: 'var(--status-success-bg)', text: 'var(--status-success-text)' },
  EXPIRED: { bg: 'var(--status-danger-bg)', text: 'var(--status-danger-text)' },
  CLOSED: { bg: 'var(--status-neutral-bg)', text: 'var(--status-neutral-text)' },
  RELEASED: { bg: 'var(--status-info-bg)', text: 'var(--status-info-text)' },
};

export default function TreasuryPage() {
  const [rows, setRows] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ type: 'BANK_GUARANTEE' as FacilityType, reference: '', bank_name: '', beneficiary: '', facility_limit: '', utilized_amount: '', interest_rate: '', issue_date: '', maturity_date: '' });

  const load = useCallback(async () => {
    try { setLoading(true); setRows(await treasuryService.list()); setError(null); }
    catch (e: any) { setError(e.message || 'Failed to load'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const active = rows.filter(r => r.status === 'ACTIVE');
  const totalLimit = active.reduce((s, r) => s + r.facility_limit, 0);
  const utilized = active.reduce((s, r) => s + r.utilized_amount, 0);
  const available = active.reduce((s, r) => s + r.available, 0);
  const expiring = active.filter(r => r.expiringSoon);

  const create = async () => {
    setBusy(true);
    try {
      await treasuryService.create({
        type: form.type, reference: form.reference, bank_name: form.bank_name, beneficiary: form.beneficiary,
        facility_limit: Number(form.facility_limit), utilized_amount: Number(form.utilized_amount),
        interest_rate: form.interest_rate ? Number(form.interest_rate) : null,
        issue_date: form.issue_date || null, maturity_date: form.maturity_date || null,
      });
      setShow(false); setForm({ type: 'BANK_GUARANTEE', reference: '', bank_name: '', beneficiary: '', facility_limit: '', utilized_amount: '', interest_rate: '', issue_date: '', maturity_date: '' });
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Treasury Management"
        subtitle="Loans, overdrafts, bank guarantees and LCs — limits, utilization and maturity"
        breadcrumbs={[{ label: 'Finance', href: '/finance' }, { label: 'Treasury' }]}
        actions={<Button size="sm" variant="primary" icon={Plus} onClick={() => setShow(true)}>Add facility</Button>}
      />

      {error && <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]"><span>{error}</span><button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button></div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3.5"><div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">Total facilities</div><div className="text-lg font-semibold mt-1 tabular-nums">{money(totalLimit)} AED</div></Card>
        <Card className="p-3.5"><div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">Utilized</div><div className="text-lg font-semibold mt-1 tabular-nums" style={{ color: 'var(--status-warning-text)' }}>{money(utilized)} AED</div></Card>
        <Card className="p-3.5"><div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">Available</div><div className="text-lg font-semibold mt-1 tabular-nums" style={{ color: 'var(--status-success-text)' }}>{money(available)} AED</div></Card>
        <Card className="p-3.5"><div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">Expiring ≤60d</div><div className="text-lg font-semibold mt-1 tabular-nums" style={{ color: expiring.length ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{expiring.length}</div></Card>
      </div>

      <Card className="overflow-hidden">
        {loading ? <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div>
          : rows.length === 0 ? <EmptyState icon={Landmark} title="No facilities" description="Add a loan, overdraft, bank guarantee or LC to track limits and maturity." />
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)]">
                  <th className="px-4 py-2.5 font-medium">Type</th><th className="px-4 py-2.5 font-medium">Bank / Ref</th><th className="px-4 py-2.5 font-medium">Beneficiary</th>
                  <th className="px-4 py-2.5 font-medium text-right">Limit</th><th className="px-4 py-2.5 font-medium text-right">Utilized</th><th className="px-4 py-2.5 font-medium text-right">Available</th>
                  <th className="px-4 py-2.5 font-medium">Maturity</th><th className="px-4 py-2.5 font-medium">Status</th>
                </tr></thead>
                <tbody>
                  {rows.map(r => {
                    const st = ST[r.status];
                    return (
                      <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]">
                        <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">{TYPE_LABEL[r.type]}</td>
                        <td className="px-4 py-2.5">{r.bank_name}{r.reference ? <span className="text-[var(--text-tertiary)]"> · {r.reference}</span> : ''}</td>
                        <td className="px-4 py-2.5 text-[var(--text-secondary)]">{r.beneficiary || '—'}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{money(r.facility_limit)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{money(r.utilized_amount)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{money(r.available)}</td>
                        <td className="px-4 py-2.5">{r.expiringSoon && <AlertTriangle size={11} className="inline mr-1 text-[var(--status-danger-text)]" />}{fmtDate(r.maturity_date)}{r.daysToMaturity !== null && r.status === 'ACTIVE' ? <span className="text-[var(--text-tertiary)]"> ({r.daysToMaturity}d)</span> : ''}</td>
                        <td className="px-4 py-2.5"><span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.text }}>{r.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot><tr className="border-t-2 border-[var(--border)] font-semibold"><td className="px-4 py-2.5" colSpan={3}>Active total</td><td className="px-4 py-2.5 text-right tabular-nums">{money(totalLimit)}</td><td className="px-4 py-2.5 text-right tabular-nums">{money(utilized)}</td><td className="px-4 py-2.5 text-right tabular-nums">{money(available)}</td><td colSpan={2}></td></tr></tfoot>
              </table>
            </div>
          )}
      </Card>

      {show && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShow(false)}>
          <Card className="w-full max-w-lg p-5" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-[var(--text-primary)]">Add facility</h3><button onClick={() => setShow(false)} className="cursor-pointer text-[var(--text-tertiary)]"><X size={16} /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium text-[var(--text-secondary)]">Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as FacilityType })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
                  <option value="BANK_GUARANTEE">Bank Guarantee</option><option value="LC">Letter of Credit</option><option value="LOAN">Loan</option><option value="OVERDRAFT">Overdraft</option><option value="FACILITY">Facility</option>
                </select></div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)]">Bank *</label><input value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)]">Reference</label><input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)]">Beneficiary</label><input value={form.beneficiary} onChange={e => setForm({ ...form, beneficiary: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)]">Limit (AED)</label><input type="number" step="any" value={form.facility_limit} onChange={e => setForm({ ...form, facility_limit: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm text-right" /></div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)]">Utilized (AED)</label><input type="number" step="any" value={form.utilized_amount} onChange={e => setForm({ ...form, utilized_amount: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm text-right" /></div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)]">Issue date</label><input type="date" value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)]">Maturity / expiry</label><input type="date" value={form.maturity_date} onChange={e => setForm({ ...form, maturity_date: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4"><Button variant="secondary" size="sm" onClick={() => setShow(false)}>Cancel</Button><Button variant="primary" size="sm" isLoading={busy} disabled={!form.bank_name.trim()} onClick={create}>Add facility</Button></div>
          </Card>
        </div>
      )}
    </div>
  );
}
