'use client';

// ============================================================
// JEET ERP — Service: Spare Parts & Consumption
// Parts used on tickets (parts_used), cost, chargeable vs covered,
// by item and by month. Read-only; plain query (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Wrench, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const num = (n: number) => Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 2 });

interface Part { item_code: string; description: string; quantity: number; unit_price: number; chargeable: boolean; created_at: string; }

export default function SparePartsPage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('service_tickets').select('parts_used, created_at');
        const flat: Part[] = [];
        (data || []).forEach((t: any) => {
          const arr = Array.isArray(t.parts_used) ? t.parts_used : [];
          arr.forEach((p: any) => flat.push({
            item_code: p.item_code || '—', description: p.description || '', quantity: Number(p.quantity || 0),
            unit_price: Number(p.unit_price || 0), chargeable: !!p.chargeable, created_at: t.created_at,
          }));
        });
        setParts(flat);
      } finally { setLoading(false); }
    })();
  }, []);

  const valueOf = (p: Part) => p.quantity * p.unit_price;
  const totalValue = parts.reduce((s, p) => s + valueOf(p), 0);
  const totalQty = parts.reduce((s, p) => s + p.quantity, 0);
  const chargeableValue = parts.filter(p => p.chargeable).reduce((s, p) => s + valueOf(p), 0);
  const coveredValue = totalValue - chargeableValue;

  const byItem = useMemo(() => {
    const m = new Map<string, { description: string; qty: number; value: number; lines: number }>();
    parts.forEach(p => { const k = p.item_code; const e = m.get(k) || { description: p.description, qty: 0, value: 0, lines: 0 }; e.qty += p.quantity; e.value += valueOf(p); e.lines++; m.set(k, e); });
    return [...m.entries()].map(([item_code, v]) => ({ item_code, ...v })).sort((a, b) => b.value - a.value);
  }, [parts]);

  const topItems = byItem.slice(0, 8).map(i => ({ name: i.item_code, value: Math.round(i.value) }));
  const byMonth = useMemo(() => {
    const m = new Map<string, number>();
    parts.forEach(p => { if (!p.created_at) return; const d = new Date(p.created_at); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; m.set(k, (m.get(k) || 0) + valueOf(p)); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([k, v]) => ({ month: k.slice(2), value: Math.round(v) }));
  }, [parts]);
  const split = [{ name: 'Chargeable', value: Math.round(chargeableValue) }, { name: 'Covered (AMC)', value: Math.round(coveredValue) }].filter(d => d.value > 0);

  const exportCols = ['Item', 'Description', 'Lines', 'Qty', 'Total value'];
  const exportRows = byItem.map(i => [i.item_code, i.description, i.lines, num(i.qty), Math.round(i.value)]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Spare Parts & Consumption"
        subtitle="Parts consumed on service tickets — cost, chargeable vs covered, by item and month"
        breadcrumbs={[{ label: 'Service', href: '/service-desk' }, { label: 'Spare Parts' }]}
        actions={parts.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Spare Parts Consumption', columns: exportCols, rows: exportRows, fileName: 'spare-parts' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Spare Parts Consumption', columns: exportCols, rows: exportRows, fileName: 'spare-parts' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : parts.length === 0 ? (
        <Card><EmptyState icon={Wrench} title="No parts consumed yet" description="Parts recorded on resolved tickets appear here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total value</div><div className="text-xl font-bold mt-1">{aed(totalValue)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Distinct items</div><div className="text-2xl font-bold mt-1">{byItem.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Chargeable value</div><div className="text-lg font-semibold mt-1" style={{ color: 'var(--status-success-text)' }}>{aed(chargeableValue)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Covered (AMC) cost</div><div className="text-lg font-semibold mt-1" style={{ color: 'var(--status-warning-text)' }}>{aed(coveredValue)}</div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="p-4 lg:col-span-2">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Top items by value</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={topItems} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <Tooltip formatter={(v: any) => aed(v)} />
                    <Bar dataKey="value" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Chargeable vs covered</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <PieChart><Pie data={split} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(e: any) => e.name}><Cell fill="var(--status-success-text)" /><Cell fill="var(--status-warning-text)" /></Pie><Tooltip formatter={(v: any) => aed(v)} /></PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {byMonth.length > 0 && (
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Monthly parts consumption</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <LineChart data={byMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => aed(v)} />
                    <Line dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Item</th><th className="p-3 text-right">Lines</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Total value</th>
              </tr></thead>
              <tbody>
                {byItem.map(i => (
                  <tr key={i.item_code} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3"><div className="font-medium text-[var(--text-primary)]">{i.item_code}</div><div className="text-[11px] text-[var(--text-tertiary)] line-clamp-1">{i.description}</div></td>
                    <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{i.lines}</td>
                    <td className="p-3 text-right tabular-nums">{num(i.qty)}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{aed(i.value)}</td>
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
