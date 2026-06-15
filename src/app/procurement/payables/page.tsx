'use client';

// ============================================================
// JEET ERP — Procurement: Payables Overview
// Supplier invoices outstanding, due/overdue aging and by supplier.
// Read-only; plain query (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Receipt, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

const DAY = 86400000;
const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const PAID = ['PAID', 'CANCELLED', 'VOID'];

interface Inv { id: string; internal_ref: string | null; supplier_invoice_number: string | null; supplier_id: string | null; total: number; amount_paid: number; status: string; invoice_date: string | null; due_date: string | null; }

export default function PayablesPage() {
  const router = useRouter();
  const [invs, setInvs] = useState<Inv[]>([]);
  const [supplierMap, setSupplierMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('supplier_invoices').select('id, internal_ref, supplier_invoice_number, supplier_id, total, amount_paid, status, invoice_date, due_date').order('due_date', { ascending: true });
        const rows = (data || []) as Inv[];
        setInvs(rows);
        const sids = [...new Set(rows.map(r => r.supplier_id).filter(Boolean))] as string[];
        if (sids.length) { const { data: s } = await supabase.from('pricing_suppliers').select('id, name').in('id', sids); setSupplierMap(new Map((s || []).map((x: any) => [x.id, x.name]))); }
      } finally { setLoading(false); }
    })();
  }, []);

  const now = Date.now();
  const outstandingOf = (i: Inv) => Math.max(0, Number(i.total || 0) - Number(i.amount_paid || 0));
  const open = invs.filter(i => !PAID.includes((i.status || '').toUpperCase()) && outstandingOf(i) > 0);
  const totalOutstanding = open.reduce((s, i) => s + outstandingOf(i), 0);
  const overdue = open.filter(i => i.due_date && new Date(i.due_date).getTime() < now);
  const overdueValue = overdue.reduce((s, i) => s + outstandingOf(i), 0);
  const dueSoon = open.filter(i => { if (!i.due_date) return false; const d = new Date(i.due_date).getTime(); return d >= now && d - now <= 7 * DAY; });
  const paidValue = invs.reduce((s, i) => s + Number(i.amount_paid || 0), 0);

  const aging = useMemo(() => {
    const b = [{ name: 'Not due', value: 0 }, { name: '1–30d overdue', value: 0 }, { name: '31–60d', value: 0 }, { name: '60d+', value: 0 }];
    open.forEach(i => { const out = outstandingOf(i); if (!i.due_date) { b[0].value += out; return; } const od = (now - new Date(i.due_date).getTime()) / DAY; if (od <= 0) b[0].value += out; else if (od <= 30) b[1].value += out; else if (od <= 60) b[2].value += out; else b[3].value += out; });
    return b.map(x => ({ ...x, value: Math.round(x.value) }));
  }, [open]);

  const bySupplier = useMemo(() => {
    const m = new Map<string, number>();
    open.forEach(i => { const k = i.supplier_id ? (supplierMap.get(i.supplier_id) || 'Unknown') : 'Unknown'; m.set(k, (m.get(k) || 0) + outstandingOf(i)); });
    return [...m.entries()].map(([name, value]) => ({ name: name.slice(0, 16), value: Math.round(value) })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [open, supplierMap]);

  const exportCols = ['Invoice', 'Supplier', 'Total', 'Paid', 'Outstanding', 'Due date', 'Status'];
  const exportRows = open.map(i => [i.supplier_invoice_number || i.internal_ref || '', i.supplier_id ? supplierMap.get(i.supplier_id) || '' : '', i.total, i.amount_paid, outstandingOf(i), i.due_date || '', i.status]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Payables Overview"
        subtitle="Supplier invoices outstanding, aging and by supplier"
        breadcrumbs={[{ label: 'Procurement', href: '/procurement/dashboard' }, { label: 'Payables' }]}
        actions={open.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Payables', columns: exportCols, rows: exportRows, fileName: 'payables' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Payables', columns: exportCols, rows: exportRows, fileName: 'payables' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : invs.length === 0 ? (
        <Card><EmptyState icon={Receipt} title="No supplier invoices" description="Supplier invoices and outstanding payables appear here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Outstanding</div><div className="text-xl font-bold mt-1">{aed(totalOutstanding)}</div><div className="text-[11px] text-[var(--text-tertiary)]">{open.length} invoice(s)</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Overdue</div><div className="text-xl font-bold mt-1" style={{ color: overdue.length ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{aed(overdueValue)}</div><div className="text-[11px] text-[var(--text-tertiary)]">{overdue.length} invoice(s)</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Due ≤7 days</div><div className="text-2xl font-bold mt-1" style={{ color: dueSoon.length ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{dueSoon.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Paid to date</div><div className="text-lg font-bold mt-1" style={{ color: 'var(--status-success-text)' }}>{aed(paidValue)}</div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Payables aging</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={aging}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => aed(v)} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>{aging.map((_, i) => <Cell key={i} fill={i === 0 ? 'var(--status-success-text)' : i === 1 ? 'var(--status-warning-text)' : 'var(--status-danger-text)'} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Outstanding by supplier</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={bySupplier} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <Tooltip formatter={(v: any) => aed(v)} />
                    <Bar dataKey="value" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-0 overflow-x-auto">
            <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Outstanding invoices</div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Invoice</th><th className="p-3">Supplier</th><th className="p-3 text-right">Total</th><th className="p-3 text-right">Outstanding</th><th className="p-3">Due</th><th className="p-3">Status</th>
              </tr></thead>
              <tbody>
                {open.map(i => { const od = i.due_date && new Date(i.due_date).getTime() < now; return (
                  <tr key={i.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push('/finance/ap')}>
                    <td className="p-3 font-medium text-[var(--text-primary)]">{i.supplier_invoice_number || i.internal_ref || '—'}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{i.supplier_id ? supplierMap.get(i.supplier_id) || '—' : '—'}</td>
                    <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{aed(i.total)}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{aed(outstandingOf(i))}</td>
                    <td className="p-3 text-xs" style={{ color: od ? 'var(--status-danger-text)' : 'var(--text-secondary)' }}>{i.due_date || '—'}{od ? ' ⚠' : ''}</td>
                    <td className="p-3 text-xs">{i.status}</td>
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
