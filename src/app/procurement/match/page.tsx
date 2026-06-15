'use client';

// ============================================================
// JEET ERP — Procurement: Three-Way Match Exceptions
// Supplier invoices by match status (PO ↔ GRN ↔ invoice), with
// exceptions to resolve. Read-only; plain query (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { ShieldAlert, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const EXCEPTION = ['MISMATCH', 'EXCEPTION', 'FAILED', 'OVERRIDE'];
const MATCHED = ['MATCHED', 'PASS', 'PASSED', 'OK'];

interface Inv { id: string; internal_ref: string | null; supplier_invoice_number: string | null; supplier_id: string | null; po_id: string | null; total: number; match_status: string | null; status: string; invoice_date: string | null; }

const bucket = (s: string | null) => { const u = (s || '').toUpperCase(); if (EXCEPTION.includes(u)) return 'EXCEPTION'; if (MATCHED.includes(u)) return 'MATCHED'; return 'PENDING'; };

export default function MatchExceptionsPage() {
  const router = useRouter();
  const [invs, setInvs] = useState<Inv[]>([]);
  const [supplierMap, setSupplierMap] = useState<Map<string, string>>(new Map());
  const [poMap, setPoMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('supplier_invoices').select('id, internal_ref, supplier_invoice_number, supplier_id, po_id, total, match_status, status, invoice_date').order('invoice_date', { ascending: false });
        const rows = (data || []) as Inv[];
        setInvs(rows);
        const sids = [...new Set(rows.map(r => r.supplier_id).filter(Boolean))] as string[];
        const pids = [...new Set(rows.map(r => r.po_id).filter(Boolean))] as string[];
        const [sRes, pRes] = await Promise.all([
          sids.length ? supabase.from('pricing_suppliers').select('id, name').in('id', sids) : Promise.resolve({ data: [] as any[] }),
          pids.length ? supabase.from('purchase_orders').select('id, po_number').in('id', pids) : Promise.resolve({ data: [] as any[] }),
        ]);
        setSupplierMap(new Map((sRes.data || []).map((s: any) => [s.id, s.name])));
        setPoMap(new Map((pRes.data || []).map((p: any) => [p.id, p.po_number])));
      } finally { setLoading(false); }
    })();
  }, []);

  const exceptions = invs.filter(i => bucket(i.match_status) === 'EXCEPTION');
  const matched = invs.filter(i => bucket(i.match_status) === 'MATCHED');
  const pending = invs.filter(i => bucket(i.match_status) === 'PENDING');
  const exceptionValue = exceptions.reduce((s, i) => s + Number(i.total || 0), 0);

  const dist = useMemo(() => [
    { name: 'Matched', value: matched.length, color: 'var(--status-success-text)' },
    { name: 'Pending', value: pending.length, color: 'var(--status-warning-text)' },
    { name: 'Exception', value: exceptions.length, color: 'var(--status-danger-text)' },
  ].filter(d => d.value > 0), [invs]);

  const rows = useMemo(() => filter ? invs.filter(i => bucket(i.match_status) === filter) : invs, [invs, filter]);

  const exportCols = ['Invoice', 'Supplier', 'PO', 'Value', 'Match status', 'Bucket', 'Doc status'];
  const exportRows = rows.map(i => [i.supplier_invoice_number || i.internal_ref || '', i.supplier_id ? supplierMap.get(i.supplier_id) || '' : '', i.po_id ? poMap.get(i.po_id) || '' : '', i.total, i.match_status || '', bucket(i.match_status), i.status]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Three-Way Match Exceptions"
        subtitle="Supplier invoices matched against PO and GRN — exceptions to resolve"
        breadcrumbs={[{ label: 'Procurement', href: '/procurement/dashboard' }, { label: 'Match' }]}
        actions={invs.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Three-Way Match', columns: exportCols, rows: exportRows, fileName: 'three-way-match' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Three-Way Match', columns: exportCols, rows: exportRows, fileName: 'three-way-match' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : invs.length === 0 ? (
        <Card><EmptyState icon={ShieldAlert} title="No supplier invoices" description="Supplier invoices and their match status appear here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4 cursor-pointer hover:border-[var(--accent)]" onClick={() => setFilter('')}><div className="text-xs text-[var(--text-secondary)]">All invoices</div><div className="text-2xl font-bold mt-1">{invs.length}</div></Card>
            <Card className="p-4 cursor-pointer hover:border-[var(--accent)]" onClick={() => setFilter('MATCHED')}><div className="text-xs text-[var(--text-secondary)]">Matched</div><div className="text-2xl font-bold mt-1" style={{ color: 'var(--status-success-text)' }}>{matched.length}</div></Card>
            <Card className="p-4 cursor-pointer hover:border-[var(--accent)]" onClick={() => setFilter('PENDING')}><div className="text-xs text-[var(--text-secondary)]">Pending</div><div className="text-2xl font-bold mt-1" style={{ color: 'var(--status-warning-text)' }}>{pending.length}</div></Card>
            <Card className="p-4 cursor-pointer hover:border-[var(--accent)]" onClick={() => setFilter('EXCEPTION')}><div className="text-xs text-[var(--text-secondary)]">Exceptions</div><div className="text-2xl font-bold mt-1" style={{ color: exceptions.length ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{exceptions.length}</div><div className="text-[11px] text-[var(--text-tertiary)]">{aed(exceptionValue)}</div></Card>
          </div>

          {dist.length > 0 && (
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Match status distribution</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <PieChart><Pie data={dist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => `${e.name}: ${e.value}`}>{dist.map((d, i) => <Cell key={i} fill={d.color} />)}</Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <Card className="p-0 overflow-x-auto">
            <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)] flex items-center justify-between">
              <span>{filter ? `${filter.charAt(0) + filter.slice(1).toLowerCase()} invoices` : 'All invoices'} ({rows.length})</span>
              {filter && <button onClick={() => setFilter('')} className="text-xs text-[var(--accent)]">Clear filter</button>}
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Invoice</th><th className="p-3">Supplier</th><th className="p-3">PO</th><th className="p-3 text-right">Value</th><th className="p-3">Match</th><th className="p-3">Doc status</th>
              </tr></thead>
              <tbody>
                {rows.map(i => { const b = bucket(i.match_status); const c = b === 'EXCEPTION' ? 'var(--status-danger-text)' : b === 'MATCHED' ? 'var(--status-success-text)' : 'var(--status-warning-text)'; return (
                  <tr key={i.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push('/finance/ap')}>
                    <td className="p-3 font-medium text-[var(--text-primary)]">{i.supplier_invoice_number || i.internal_ref || '—'}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{i.supplier_id ? supplierMap.get(i.supplier_id) || '—' : '—'}</td>
                    <td className="p-3 text-xs text-[var(--text-tertiary)]">{i.po_id ? poMap.get(i.po_id) || '—' : '—'}</td>
                    <td className="p-3 text-right tabular-nums">{aed(i.total)}</td>
                    <td className="p-3"><span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-active)', color: c }}>{i.match_status || b}</span></td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{i.status}</td>
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
