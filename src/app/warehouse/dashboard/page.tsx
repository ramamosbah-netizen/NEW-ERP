'use client';

// ============================================================
// JEET ERP — Warehouse: Inventory Dashboard
// Value, risk and movement health across the store. Read-only;
// reuses warehouseService.getStock (proven Store query) + a plain
// movement-trend query (no embeds). No migration.
// ============================================================

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import warehouseService, { StockRow } from '@/services/warehouseService';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Package, FileDown, Sheet, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend, ComposedChart, Line } from 'recharts';

const DAY = 86400000;
const DEAD_DAYS = 180;
const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const aedShort = (n: number) => `${(Number(n || 0) / 1000).toFixed(0)}k`;
const PIE = ['var(--status-success-text)', 'var(--status-warning-text)', 'var(--status-danger-text)', 'var(--text-tertiary)'];
const IN_TYPES = ['GRN_RECEIPT', 'RETURN_FROM_SITE', 'TRANSFER_IN', 'ADJUSTMENT_IN'];

export default function InventoryDashboard() {
  const router = useRouter();
  const [rows, setRows] = useState<StockRow[]>([]);
  const [locationCount, setLocationCount] = useState(0);
  const [trend, setTrend] = useState<{ month: string; receipts: number; issues: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [stock, locs] = await Promise.all([
          warehouseService.getStock().catch(() => [] as StockRow[]),
          warehouseService.getLocations().catch(() => [] as any[]),
        ]);
        setRows(stock);
        setLocationCount(locs.length);

        // movement trend — plain select, no embeds, last 6 months
        const since = new Date(Date.now() - 183 * DAY).toISOString();
        const { data: txs } = await supabase
          .from('stock_transactions')
          .select('type, total_value, created_at')
          .gte('created_at', since);
        const m = new Map<string, { receipts: number; issues: number }>();
        (txs || []).forEach((t: any) => {
          const d = new Date(t.created_at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (!m.has(key)) m.set(key, { receipts: 0, issues: 0 });
          const e = m.get(key)!;
          const v = Math.abs(Number(t.total_value || 0));
          if (IN_TYPES.includes(t.type)) e.receipts += v; else e.issues += v;
        });
        setTrend([...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
          .map(([month, v]) => ({ month: month.slice(2), receipts: Math.round(v.receipts), issues: Math.round(v.issues) })));
      } finally { setLoading(false); }
    })();
  }, []);

  const totalValue = rows.reduce((s, r) => s + (r.stock_value || 0), 0);
  const outCount = rows.filter(r => r.risk === 'OUT').length;
  const lowCount = rows.filter(r => r.risk === 'LOW').length;
  const dead = rows.filter(r => (r.qty_on_hand || 0) > 0 && r.last_movement_at && (Date.now() - new Date(r.last_movement_at).getTime()) > DEAD_DAYS * DAY);
  const deadValue = dead.reduce((s, r) => s + (r.stock_value || 0), 0);

  const groupValue = (key: 'category' | 'system') => {
    const m = new Map<string, number>();
    rows.forEach(r => { const k = (r as any)[key] || 'Unassigned'; m.set(k, (m.get(k) || 0) + (r.stock_value || 0)); });
    return [...m.entries()].map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value).slice(0, 8);
  };
  const byCategory = groupValue('category');
  const bySystem = groupValue('system');
  const riskDist = [
    { name: 'In stock', value: rows.filter(r => r.risk === 'OK').length },
    { name: 'Below reorder', value: lowCount },
    { name: 'Out of stock', value: outCount },
    { name: 'Untracked', value: rows.filter(r => r.risk === 'NONE').length },
  ].filter(d => d.value > 0);
  const topItems = [...rows].sort((a, b) => (b.stock_value || 0) - (a.stock_value || 0)).slice(0, 10);

  const exportCols = ['Item', 'Description', 'Category', 'System', 'Qty', 'Avg cost', 'Value', 'Risk'];
  const exportRows = [...rows].sort((a, b) => (b.stock_value || 0) - (a.stock_value || 0))
    .map(r => [r.item_code, r.description, r.category, r.system, r.qty_on_hand, r.avg_unit_cost, Math.round(r.stock_value || 0), r.risk]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Inventory Dashboard"
        subtitle="Stock value, risk and movement health across the store"
        breadcrumbs={[{ label: 'Warehouse', href: '/warehouse' }, { label: 'Dashboard' }]}
        actions={rows.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Inventory Valuation', columns: exportCols, rows: exportRows, fileName: 'inventory-valuation' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Inventory Valuation', columns: exportCols, rows: exportRows, fileName: 'inventory-valuation' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading inventory…</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={Package} title="No stock registered" description="Register stock items in the Store to see inventory analytics." /></Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Stock value</div><div className="text-xl font-bold mt-1">{aed(totalValue)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">SKUs</div><div className="text-2xl font-bold mt-1">{rows.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Locations</div><div className="text-2xl font-bold mt-1">{locationCount}</div></Card>
            <Card className="p-4 cursor-pointer hover:border-[var(--accent)]" onClick={() => router.push('/warehouse/store')}><div className="text-xs text-[var(--text-secondary)]">Out of stock</div><div className="text-2xl font-bold mt-1" style={{ color: outCount ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{outCount}</div></Card>
            <Card className="p-4 cursor-pointer hover:border-[var(--accent)]" onClick={() => router.push('/warehouse/store')}><div className="text-xs text-[var(--text-secondary)]">Below reorder</div><div className="text-2xl font-bold mt-1" style={{ color: lowCount ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{lowCount}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Dead stock ({DEAD_DAYS}d)</div><div className="text-2xl font-bold mt-1" style={{ color: dead.length ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{dead.length}</div><div className="text-[11px] text-[var(--text-tertiary)]">{aed(deadValue)}</div></Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="p-4 lg:col-span-2">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Movement value — receipts vs issues (6 mo)</div>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  {trend.length ? (
                    <ComposedChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={aedShort} />
                      <Tooltip formatter={(v: any) => aed(v)} />
                      <Legend />
                      <Bar dataKey="receipts" name="Receipts" fill="var(--status-success-text)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="issues" name="Issues" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                      <Line dataKey="issues" stroke="var(--accent)" dot={false} legendType="none" />
                    </ComposedChart>
                  ) : <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">No movements in the last 6 months</div>}
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Stock risk</div>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={riskDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e: any) => e.name}>
                      {riskDist.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Value by category</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={byCategory} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={aedShort} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <Tooltip formatter={(v: any) => aed(v)} />
                    <Bar dataKey="value" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4 lg:col-span-2">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Value by system</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={bySystem}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={aedShort} />
                    <Tooltip formatter={(v: any) => aed(v)} />
                    <Bar dataKey="value" fill="var(--status-info-text)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Top items by value */}
          <Card className="p-0 overflow-x-auto">
            <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Top items by value</div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Item</th><th className="p-3">Category</th><th className="p-3 text-right">Qty</th>
                <th className="p-3 text-right">Avg cost</th><th className="p-3 text-right">Value</th><th className="p-3">Risk</th>
              </tr></thead>
              <tbody>
                {topItems.map(r => (
                  <tr key={r.stock_item_id} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3"><div className="font-medium text-[var(--text-primary)]">{r.item_code}</div><div className="text-[11px] text-[var(--text-tertiary)] line-clamp-1">{r.description}</div></td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{r.category || '—'}</td>
                    <td className="p-3 text-right tabular-nums">{r.qty_on_hand}</td>
                    <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{aed(r.avg_unit_cost)}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{aed(r.stock_value || 0)}</td>
                    <td className="p-3">{r.risk === 'OUT' || r.risk === 'LOW' ? <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full" style={{ background: r.risk === 'OUT' ? 'var(--status-danger-bg)' : 'var(--status-warning-bg)', color: r.risk === 'OUT' ? 'var(--status-danger-text)' : 'var(--status-warning-text)' }}><AlertTriangle size={10} />{r.risk}</span> : <span className="text-[var(--text-tertiary)] text-xs">OK</span>}</td>
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
