'use client';

// ============================================================
// JEET ERP — Warehouse: Inventory Aging
// Stock value bucketed by age since last movement. Read-only;
// reuses warehouseService.getStock (no migration).
// ============================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import warehouseService, { StockRow } from '@/services/warehouseService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Hourglass, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

const DAY = 86400000;
const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const num = (n: number) => Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 3 });

const BUCKETS = [
  { key: '0-30', label: '0–30 days', max: 30, color: 'var(--status-success-text)' },
  { key: '31-90', label: '31–90 days', max: 90, color: 'var(--status-info-text)' },
  { key: '91-180', label: '91–180 days', max: 180, color: 'var(--status-warning-text)' },
  { key: '180+', label: '180+ days', max: Infinity, color: 'var(--status-danger-text)' },
];

function ageDaysOf(r: StockRow): number | null {
  if (!r.last_movement_at) return null;
  return Math.floor((Date.now() - new Date(r.last_movement_at).getTime()) / DAY);
}
function bucketOf(age: number | null): typeof BUCKETS[number] {
  if (age === null) return BUCKETS[3]; // no movement → oldest
  return BUCKETS.find(b => age <= b.max) || BUCKETS[3];
}

export default function InventoryAgingPage() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string; location_code: string }[]>([]);
  const [locationFilter, setLocationFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { warehouseService.getLocations().then(setLocations).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows((await warehouseService.getStock(locationFilter || undefined)).filter(r => (r.qty_on_hand || 0) > 0)); }
    finally { setLoading(false); }
  }, [locationFilter]);
  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => [...new Set(rows.map(r => r.category).filter(Boolean))].sort(), [rows]);
  const filtered = categoryFilter ? rows.filter(r => r.category === categoryFilter) : rows;

  const enriched = useMemo(() => filtered.map(r => { const age = ageDaysOf(r); return { ...r, age, bucket: bucketOf(age).key }; }), [filtered]);

  const bucketSummary = useMemo(() => BUCKETS.map(b => {
    const items = enriched.filter(r => r.bucket === b.key);
    return { key: b.key, label: b.label, color: b.color, count: items.length, value: Math.round(items.reduce((s, r) => s + (r.stock_value || 0), 0)) };
  }), [enriched]);

  const totalValue = bucketSummary.reduce((s, b) => s + b.value, 0);
  const agedValue = bucketSummary.filter(b => b.key === '91-180' || b.key === '180+').reduce((s, b) => s + b.value, 0);
  const oldestValue = bucketSummary.find(b => b.key === '180+')?.value || 0;

  const exportCols = ['Item', 'Description', 'Category', 'Qty', 'Avg cost', 'Value', 'Last movement', 'Age (d)', 'Bucket'];
  const exportRows = [...enriched].sort((a, b) => (b.age ?? 99999) - (a.age ?? 99999))
    .map(r => [r.item_code, r.description, r.category, num(r.qty_on_hand), r.avg_unit_cost, Math.round(r.stock_value || 0), r.last_movement_at ? r.last_movement_at.slice(0, 10) : '—', r.age ?? 'no movement', bucketOf(r.age).label]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Inventory Aging"
        subtitle="Stock value bucketed by time since last movement"
        breadcrumbs={[{ label: 'Warehouse', href: '/warehouse' }, { label: 'Aging' }]}
        actions={rows.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Inventory Aging', columns: exportCols, rows: exportRows, fileName: 'inventory-aging' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Inventory Aging', columns: exportCols, rows: exportRows, fileName: 'inventory-aging' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      <Card className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-xs text-[var(--text-secondary)]">Location
          <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm"><option value="">All locations</option>{locations.map(l => <option key={l.id} value={l.id}>{l.location_code} — {l.name}</option>)}</select>
        </label>
        <label className="text-xs text-[var(--text-secondary)]">Category
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm"><option value="">All categories</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
        </label>
      </Card>

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : enriched.length === 0 ? (
        <Card><EmptyState icon={Hourglass} title="No stock on hand" description="Items with positive stock will be aged here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total stock value</div><div className="text-xl font-bold mt-1">{aed(totalValue)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Aged &gt; 90 days</div><div className="text-xl font-bold mt-1" style={{ color: 'var(--status-warning-text)' }}>{aed(agedValue)}</div><div className="text-[11px] text-[var(--text-tertiary)]">{totalValue ? Math.round(agedValue / totalValue * 100) : 0}% of value</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Aged &gt; 180 days</div><div className="text-xl font-bold mt-1" style={{ color: 'var(--status-danger-text)' }}>{aed(oldestValue)}</div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Value by age bucket</div>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={bucketSummary}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => aed(v)} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>{bucketSummary.map((b, i) => <Cell key={i} fill={b.color} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Bucket summary</div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-2">Bucket</th><th className="p-2 text-right">Items</th><th className="p-2 text-right">Value</th><th className="p-2 text-right">% value</th></tr></thead>
                <tbody>
                  {bucketSummary.map(b => (
                    <tr key={b.key} className="border-b border-[var(--border)] last:border-0">
                      <td className="p-2"><span className="inline-flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: b.color }} />{b.label}</span></td>
                      <td className="p-2 text-right tabular-nums">{b.count}</td>
                      <td className="p-2 text-right tabular-nums">{aed(b.value)}</td>
                      <td className="p-2 text-right tabular-nums text-[var(--text-secondary)]">{totalValue ? Math.round(b.value / totalValue * 100) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          <Card className="p-0 overflow-x-auto">
            <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Items by age (oldest first)</div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Item</th><th className="p-3">Category</th><th className="p-3 text-right">Qty</th>
                <th className="p-3 text-right">Value</th><th className="p-3">Last movement</th><th className="p-3 text-right">Age</th><th className="p-3">Bucket</th>
              </tr></thead>
              <tbody>
                {[...enriched].sort((a, b) => (b.age ?? 99999) - (a.age ?? 99999)).slice(0, 200).map(r => {
                  const bk = bucketOf(r.age);
                  return (
                    <tr key={r.stock_item_id} className="border-b border-[var(--border)] last:border-0">
                      <td className="p-3"><div className="font-medium text-[var(--text-primary)]">{r.item_code}</div><div className="text-[11px] text-[var(--text-tertiary)] line-clamp-1">{r.description}</div></td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{r.category || '—'}</td>
                      <td className="p-3 text-right tabular-nums">{num(r.qty_on_hand)}</td>
                      <td className="p-3 text-right tabular-nums font-medium">{aed(r.stock_value || 0)}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{r.last_movement_at ? r.last_movement_at.slice(0, 10) : 'no movement'}</td>
                      <td className="p-3 text-right tabular-nums">{r.age ?? '—'}</td>
                      <td className="p-3"><span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-active)', color: bk.color }}>{bk.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
