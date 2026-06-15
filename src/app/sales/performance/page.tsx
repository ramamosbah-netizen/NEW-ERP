'use client';

// ============================================================
// JEET ERP — Pre-Sales: Sales Performance (by owner)
// Tenders + quotations by preparer/owner, win rate and value.
// Read-only; plain queries (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Trophy, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;

interface Qt { prepared_by_name: string | null; status: string; grand_total_with_vat: number; client_response: string | null; linked_project_id: string | null; actual_project_id: string | null; rejection_reason: string | null; }
interface Tn { created_by: string | null; status: string; budget: number; }
const isWon = (q: Qt) => q.status === 'ACCEPTED' || q.client_response === 'ACCEPTED' || !!q.linked_project_id || !!q.actual_project_id;
const isLost = (q: Qt) => q.status === 'REJECTED' || (!!q.rejection_reason && !isWon(q));

interface Row { name: string; tenders: number; quotes: number; quotedValue: number; won: number; wonValue: number; lost: number; winRate: number; }

export default function SalesPerformancePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [qt, tn] = await Promise.all([
          supabase.from('quotations').select('prepared_by_name, status, grand_total_with_vat, client_response, linked_project_id, actual_project_id, rejection_reason'),
          supabase.from('tenders').select('created_by, status, budget'),
        ]);
        const quotes = (qt.data || []) as Qt[];
        const tenders = (tn.data || []) as Tn[];
        const ids = [...new Set(tenders.map(t => t.created_by).filter(Boolean))] as string[];
        const nameMap = new Map<string, string>();
        if (ids.length) { const { data } = await supabase.from('profiles').select('id, full_name').in('id', ids); (data || []).forEach((p: any) => nameMap.set(p.id, p.full_name)); }

        const m = new Map<string, Row>();
        const ensure = (name: string) => { if (!m.has(name)) m.set(name, { name, tenders: 0, quotes: 0, quotedValue: 0, won: 0, wonValue: 0, lost: 0, winRate: 0 }); return m.get(name)!; };
        quotes.forEach(q => {
          const r = ensure(q.prepared_by_name || 'Unassigned');
          r.quotes++; r.quotedValue += Number(q.grand_total_with_vat || 0);
          if (isWon(q)) { r.won++; r.wonValue += Number(q.grand_total_with_vat || 0); } else if (isLost(q)) r.lost++;
        });
        tenders.forEach(t => { const r = ensure(t.created_by ? (nameMap.get(t.created_by) || 'Unknown') : 'Unassigned'); r.tenders++; });
        m.forEach(r => { r.winRate = (r.won + r.lost) ? Math.round(r.won / (r.won + r.lost) * 100) : 0; });
        setRows([...m.values()].sort((a, b) => b.wonValue - a.wonValue || b.quotedValue - a.quotedValue));
      } finally { setLoading(false); }
    })();
  }, []);

  const top = rows[0];
  const chart = useMemo(() => rows.slice(0, 8).map(r => ({ name: r.name.split(' ')[0], value: Math.round(r.wonValue) })), [rows]);

  const exportCols = ['Owner', 'Tenders', 'Quotations', 'Quoted value', 'Won', 'Won value', 'Win rate %'];
  const exportRows = rows.map(r => [r.name, r.tenders, r.quotes, Math.round(r.quotedValue), r.won, Math.round(r.wonValue), r.winRate]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Sales Performance"
        subtitle="Tenders and quotations by owner, with win rate and won value"
        breadcrumbs={[{ label: 'Pre-Sales', href: '/sales/dashboard' }, { label: 'Performance' }]}
        actions={rows.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Sales Performance', columns: exportCols, rows: exportRows, fileName: 'sales-performance' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Sales Performance', columns: exportCols, rows: exportRows, fileName: 'sales-performance' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={Trophy} title="No sales activity" description="Tenders and quotations by owner appear here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Sales owners</div><div className="text-2xl font-bold mt-1">{rows.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Top by won value</div><div className="text-sm font-semibold mt-1 line-clamp-1">{top?.name || '—'}</div><div className="text-[11px] text-[var(--text-tertiary)]">{aed(top?.wonValue || 0)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total quoted</div><div className="text-lg font-bold mt-1">{aed(rows.reduce((s, r) => s + r.quotedValue, 0))}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total won</div><div className="text-lg font-bold mt-1" style={{ color: 'var(--status-success-text)' }}>{aed(rows.reduce((s, r) => s + r.wonValue, 0))}</div></Card>
          </div>

          <Card className="p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Won value by owner</div>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => aed(v)} />
                  <Bar dataKey="value" fill="var(--status-success-text)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Owner</th><th className="p-3 text-right">Tenders</th><th className="p-3 text-right">Quotes</th>
                <th className="p-3 text-right">Quoted</th><th className="p-3 text-right">Won</th><th className="p-3 text-right">Won value</th><th className="p-3 text-right">Win rate</th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3 font-medium text-[var(--text-primary)]">{r.name}</td>
                    <td className="p-3 text-right tabular-nums">{r.tenders}</td>
                    <td className="p-3 text-right tabular-nums">{r.quotes}</td>
                    <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{aed(r.quotedValue)}</td>
                    <td className="p-3 text-right tabular-nums">{r.won}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{aed(r.wonValue)}</td>
                    <td className="p-3 text-right tabular-nums font-medium" style={{ color: r.winRate >= 50 ? 'var(--status-success-text)' : r.winRate > 0 ? 'var(--status-warning-text)' : 'var(--text-tertiary)' }}>{r.won + r.lost ? `${r.winRate}%` : '—'}</td>
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
