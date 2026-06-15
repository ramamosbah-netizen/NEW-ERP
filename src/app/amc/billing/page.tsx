'use client';

// ============================================================
// JEET ERP — AMC: Billing & Revenue
// Billing-schedule status (pending/invoiced/paid), overdue and
// recognised revenue; run due installments. Reuses amcBillingService.
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { amcBillingService } from '@/services/amcBillingService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Banknote, FileDown, Sheet, PlayCircle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const statusStyle: Record<string, { bg: string; tx: string }> = {
  PENDING: { bg: 'var(--status-warning-bg)', tx: 'var(--status-warning-text)' },
  INVOICED: { bg: 'var(--status-info-bg)', tx: 'var(--status-info-text)' },
  PAID: { bg: 'var(--status-success-bg)', tx: 'var(--status-success-text)' },
};

interface Sch { id: string; contract_id: string; sequence: number; due_date: string; amount: number; status: string; invoice_id: string | null; }

export default function AmcBillingPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Sch[]>([]);
  const [contractMap, setContractMap] = useState<Map<string, { number: string; client: string }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('amc_billing_schedule').select('id, contract_id, sequence, due_date, amount, status, invoice_id').order('due_date', { ascending: true });
      const sch = (data || []) as Sch[];
      setRows(sch);
      const cids = [...new Set(sch.map(s => s.contract_id).filter(Boolean))] as string[];
      if (cids.length) {
        const { data: cs } = await supabase.from('amc_contracts').select('id, contract_number, client_name').in('id', cids);
        setContractMap(new Map((cs || []).map((c: any) => [c.id, { number: c.contract_number, client: c.client_name }])));
      }
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const runDue = async () => {
    setRunning(true);
    try {
      const res = await amcBillingService.processDueInstallments();
      await load();
      alert(`Processed ${res.processedCount} due installment(s) into draft invoices.`);
    } catch (e: any) { alert(e?.message || 'Run failed'); } finally { setRunning(false); }
  };

  const now = Date.now();
  const val = (s: Sch[]) => s.reduce((a, r) => a + Number(r.amount || 0), 0);
  const pending = rows.filter(r => r.status === 'PENDING');
  const overdue = pending.filter(r => r.due_date && new Date(r.due_date).getTime() < now);
  const billed = rows.filter(r => r.status === 'INVOICED' || r.status === 'PAID');
  const paid = rows.filter(r => r.status === 'PAID');

  const filtered = statusFilter ? rows.filter(r => r.status === statusFilter) : rows;

  const byMonth = useMemo(() => {
    const m = new Map<string, { Pending: number; Invoiced: number; Paid: number }>();
    rows.forEach(r => { if (!r.due_date) return; const k = r.due_date.slice(0, 7); const e = m.get(k) || { Pending: 0, Invoiced: 0, Paid: 0 }; const a = Number(r.amount || 0); if (r.status === 'PAID') e.Paid += a; else if (r.status === 'INVOICED') e.Invoiced += a; else e.Pending += a; m.set(k, e); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-8).map(([k, v]) => ({ month: k.slice(2), Pending: Math.round(v.Pending), Invoiced: Math.round(v.Invoiced), Paid: Math.round(v.Paid) }));
  }, [rows]);

  const exportCols = ['Contract', 'Client', 'Seq', 'Due date', 'Amount', 'Status', 'Invoice'];
  const exportRows = filtered.map(r => { const c = contractMap.get(r.contract_id); return [c?.number || '', c?.client || '', r.sequence, r.due_date, r.amount, r.status, r.invoice_id ? 'Yes' : '']; });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="AMC Billing & Revenue"
        subtitle="Installment schedule status, overdue billing and recognised revenue"
        breadcrumbs={[{ label: 'AMC', href: '/amc' }, { label: 'Billing' }]}
        actions={
          <div className="flex gap-2">
            {rows.length > 0 && <>
              <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'AMC Billing Schedule', columns: exportCols, rows: exportRows, fileName: 'amc-billing' })}>PDF</Button>
              <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'AMC Billing Schedule', columns: exportCols, rows: exportRows, fileName: 'amc-billing' })}>Excel</Button>
            </>}
            <Button icon={PlayCircle} onClick={runDue} isLoading={running}>Run due installments</Button>
          </div>
        }
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={Banknote} title="No billing schedule" description="Activating AMC contracts generates installment schedules here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Scheduled total</div><div className="text-lg font-bold mt-1">{aed(val(rows))}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Billed</div><div className="text-lg font-bold mt-1" style={{ color: 'var(--status-info-text)' }}>{aed(val(billed))}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Collected (paid)</div><div className="text-lg font-bold mt-1" style={{ color: 'var(--status-success-text)' }}>{aed(val(paid))}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Pending</div><div className="text-lg font-bold mt-1">{aed(val(pending))}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Overdue</div><div className="text-lg font-bold mt-1" style={{ color: overdue.length ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{aed(val(overdue))}</div><div className="text-[11px] text-[var(--text-tertiary)]">{overdue.length} installment(s)</div></Card>
          </div>

          <Card className="p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Scheduled value by month</div>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={byMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => aed(v)} />
                  <Legend />
                  <Bar dataKey="Paid" stackId="a" fill="var(--status-success-text)" />
                  <Bar dataKey="Invoiced" stackId="a" fill="var(--status-info-text)" />
                  <Bar dataKey="Pending" stackId="a" fill="var(--status-warning-text)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Status filter</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full md:max-w-xs mt-1 px-3 h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
              <option value="">All</option>{['PENDING', 'INVOICED', 'PAID'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Card>

          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Contract</th><th className="p-3 text-center">Seq</th><th className="p-3">Due date</th><th className="p-3 text-right">Amount</th><th className="p-3">Status</th><th className="p-3">Invoice</th>
              </tr></thead>
              <tbody>
                {filtered.map(r => { const c = contractMap.get(r.contract_id); const st = statusStyle[r.status] || statusStyle.PENDING; const od = r.status === 'PENDING' && r.due_date && new Date(r.due_date).getTime() < now; return (
                  <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/amc/${r.contract_id}`)}>
                    <td className="p-3"><div className="font-medium text-[var(--text-primary)]">{c?.number || '—'}</div><div className="text-[11px] text-[var(--text-tertiary)]">{c?.client}</div></td>
                    <td className="p-3 text-center tabular-nums text-[var(--text-secondary)]">{r.sequence}</td>
                    <td className="p-3 text-xs" style={{ color: od ? 'var(--status-danger-text)' : 'var(--text-secondary)' }}>{r.due_date}{od ? ' ⚠' : ''}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{aed(r.amount)}</td>
                    <td className="p-3"><span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.tx }}>{r.status}</span></td>
                    <td className="p-3 text-xs text-[var(--text-tertiary)]">{r.invoice_id ? 'Linked' : '—'}</td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
