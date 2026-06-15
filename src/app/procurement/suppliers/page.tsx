'use client';

// ============================================================
// JEET ERP — Procurement: Supplier Performance Leaderboard
// PO volume/value, delivery completion, overdue and invoice-match
// across suppliers. Read-only; plain queries (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Users, FileDown, Sheet, Star } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const COMMITTED = ['APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CLOSED'];

interface Row { id: string; name: string; type: string; preferred: boolean; pos: number; value: number; delivered: number; overdue: number; invoices: number; matchEx: number; completion: number; }

export default function SupplierLeaderboardPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOnly, setActiveOnly] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [sup, po, inv] = await Promise.all([
          supabase.from('pricing_suppliers').select('id, name, supplier_type, preferred, is_active'),
          supabase.from('purchase_orders').select('supplier_id, total, status, delivery_status, required_delivery_date'),
          supabase.from('supplier_invoices').select('supplier_id, match_status'),
        ]);
        const now = Date.now();
        const suppliers = (sup.data || []) as any[];
        const pos = (po.data || []) as any[];
        const invs = (inv.data || []) as any[];
        const stat = new Map<string, { pos: number; value: number; delivered: number; overdue: number }>();
        pos.forEach(p => {
          if (!p.supplier_id) return;
          const e = stat.get(p.supplier_id) || { pos: 0, value: 0, delivered: 0, overdue: 0 };
          if (COMMITTED.includes(p.status)) { e.pos++; e.value += Number(p.total || 0); }
          if (p.delivery_status === 'COMPLETE') e.delivered++;
          if (p.required_delivery_date && new Date(p.required_delivery_date).getTime() < now && p.delivery_status !== 'COMPLETE' && p.status !== 'CANCELLED') e.overdue++;
          stat.set(p.supplier_id, e);
        });
        const invStat = new Map<string, { count: number; ex: number }>();
        invs.forEach(i => { if (!i.supplier_id) return; const e = invStat.get(i.supplier_id) || { count: 0, ex: 0 }; e.count++; if (['MISMATCH', 'EXCEPTION', 'FAILED'].includes((i.match_status || '').toUpperCase())) e.ex++; invStat.set(i.supplier_id, e); });

        const out: Row[] = suppliers.filter(s => !activeOnly || s.is_active).map(s => {
          const st = stat.get(s.id) || { pos: 0, value: 0, delivered: 0, overdue: 0 };
          const iv = invStat.get(s.id) || { count: 0, ex: 0 };
          return { id: s.id, name: s.name, type: s.supplier_type || '—', preferred: !!s.preferred, pos: st.pos, value: st.value, delivered: st.delivered, overdue: st.overdue, invoices: iv.count, matchEx: iv.ex, completion: st.pos ? Math.round(st.delivered / st.pos * 100) : 0 };
        }).filter(r => r.pos > 0 || r.invoices > 0).sort((a, b) => b.value - a.value);
        setRows(out);
      } finally { setLoading(false); }
    })();
  }, [activeOnly]);

  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const avgCompletion = rows.length ? Math.round(rows.reduce((s, r) => s + r.completion, 0) / rows.length) : 0;
  const top = rows[0];
  const chart = useMemo(() => rows.slice(0, 8).map(r => ({ name: r.name.slice(0, 16), value: Math.round(r.value) })), [rows]);

  const exportCols = ['Supplier', 'Type', 'POs', 'PO value', 'Delivered', 'Overdue', 'Completion %', 'Invoices', 'Match exceptions'];
  const exportRows = rows.map(r => [r.name, r.type, r.pos, Math.round(r.value), r.delivered, r.overdue, `${r.completion}%`, r.invoices, r.matchEx]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Supplier Performance"
        subtitle="PO volume & value, delivery completion, overdue and invoice match by supplier"
        breadcrumbs={[{ label: 'Procurement', href: '/procurement/dashboard' }, { label: 'Suppliers' }]}
        actions={rows.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Supplier Performance', columns: exportCols, rows: exportRows, fileName: 'supplier-performance' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Supplier Performance', columns: exportCols, rows: exportRows, fileName: 'supplier-performance' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      <Card className="p-4">
        <label className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer"><input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} /> Active suppliers only</label>
      </Card>

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={Users} title="No supplier activity" description="Suppliers with purchase orders or invoices appear here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Suppliers with activity</div><div className="text-2xl font-bold mt-1">{rows.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total PO value</div><div className="text-lg font-bold mt-1">{aed(totalValue)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Top supplier</div><div className="text-sm font-semibold mt-1 line-clamp-1">{top?.name || '—'}</div><div className="text-[11px] text-[var(--text-tertiary)]">{aed(top?.value || 0)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Avg delivery completion</div><div className="text-2xl font-bold mt-1" style={{ color: avgCompletion >= 80 ? 'var(--status-success-text)' : 'var(--status-warning-text)' }}>{avgCompletion}%</div></Card>
          </div>

          <Card className="p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">PO value by supplier (top 8)</div>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={chart} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                  <Tooltip formatter={(v: any) => aed(v)} />
                  <Bar dataKey="value" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Supplier</th><th className="p-3">Type</th><th className="p-3 text-right">POs</th><th className="p-3 text-right">PO value</th>
                <th className="p-3 text-right">Delivered</th><th className="p-3 text-right">Overdue</th><th className="p-3 text-right">Completion</th><th className="p-3 text-right">Match exc.</th>
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/procurement/suppliers/${r.id}/scorecard`)}>
                    <td className="p-3"><div className="font-medium text-[var(--text-primary)] flex items-center gap-1">{r.preferred && <Star size={12} className="text-[var(--status-warning-text)]" />}{r.name}</div></td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{r.type}</td>
                    <td className="p-3 text-right tabular-nums">{r.pos}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{aed(r.value)}</td>
                    <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{r.delivered}</td>
                    <td className="p-3 text-right tabular-nums" style={{ color: r.overdue ? 'var(--status-danger-text)' : 'var(--text-tertiary)' }}>{r.overdue || '—'}</td>
                    <td className="p-3 text-right tabular-nums font-medium" style={{ color: r.completion >= 80 ? 'var(--status-success-text)' : r.completion >= 50 ? 'var(--status-warning-text)' : 'var(--status-danger-text)' }}>{r.pos ? `${r.completion}%` : '—'}</td>
                    <td className="p-3 text-right tabular-nums" style={{ color: r.matchEx ? 'var(--status-danger-text)' : 'var(--text-tertiary)' }}>{r.matchEx || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
