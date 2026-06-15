'use client';

// ============================================================
// JEET ERP — Warehouse: Replenishment Planning
// Items at/below reorder level → suggested order qty, grouped by
// preferred supplier, with export hand-off to procurement (PR).
// Read-only; reuses getStockItems (reorder data) + getStock (live).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import warehouseService, { StockRow } from '@/services/warehouseService';
import stockService from '@/services/stockService';
import type { StockItem } from '@/types/stock.types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { ShoppingCart, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const num = (n: number) => Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 3 });

interface Row {
  id: string; item_code: string; description: string; unit: string; category: string;
  available: number; reorder_level: number; shortfall: number; suggested: number;
  avg_cost: number; supplier: string; risk: string;
}

export default function ReplenishmentPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [supplierFilter, setSupplierFilter] = useState('');
  const [edits, setEdits] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      try {
        const [its, stk] = await Promise.all([
          stockService.getStockItems().catch(() => [] as StockItem[]),
          warehouseService.getStock().catch(() => [] as StockRow[]),
        ]);
        setItems(its); setStock(stk);
      } finally { setLoading(false); }
    })();
  }, []);

  const rows = useMemo<Row[]>(() => {
    const stockById = new Map(stock.map(s => [s.stock_item_id, s]));
    const out: Row[] = [];
    items.forEach(it => {
      const rl = Number(it.reorder_level || 0);
      if (!rl || rl <= 0) return;
      const s = stockById.get(it.id);
      const available = s ? Number(s.qty_available || 0) : 0;
      if (available > rl) return; // not below reorder
      const shortfall = Math.max(0, rl - available);
      const rq = Number(it.reorder_qty || 0);
      const suggested = rq > 0 ? rq : shortfall;
      out.push({
        id: it.id, item_code: it.item_code || '', description: it.description || '', unit: it.unit || '',
        category: it.category || 'Unassigned', available, reorder_level: rl, shortfall, suggested,
        avg_cost: s ? Number(s.avg_unit_cost || 0) : 0, supplier: it.supplier_name || 'Unassigned',
        risk: s?.risk || 'OUT',
      });
    });
    return out.sort((a, b) => a.supplier.localeCompare(b.supplier) || b.shortfall - a.shortfall);
  }, [items, stock]);

  const suppliers = useMemo(() => [...new Set(rows.map(r => r.supplier))].sort(), [rows]);
  const filtered = supplierFilter ? rows.filter(r => r.supplier === supplierFilter) : rows;

  const suggestedQty = (r: Row) => edits[r.id] !== undefined ? Number(edits[r.id]) || 0 : r.suggested;
  const estValue = (r: Row) => suggestedQty(r) * r.avg_cost;

  const totalValue = filtered.reduce((s, r) => s + estValue(r), 0);
  const outCount = filtered.filter(r => r.risk === 'OUT').length;

  const bySupplier = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach(r => m.set(r.supplier, (m.get(r.supplier) || 0) + estValue(r)));
    return [...m.entries()].map(([name, value]) => ({ name: name.slice(0, 16), value: Math.round(value) })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [filtered, edits]);

  const exportCols = ['Item', 'Description', 'Category', 'Supplier', 'Available', 'Reorder lvl', 'Shortfall', 'Suggested', 'Avg cost', 'Est. value'];
  const exportRows = filtered.map(r => [r.item_code, r.description, r.category, r.supplier, num(r.available), num(r.reorder_level), num(r.shortfall), num(suggestedQty(r)), r.avg_cost, Math.round(estValue(r))]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Replenishment Planning"
        subtitle="Items at or below reorder level — suggested order quantities grouped by preferred supplier"
        breadcrumbs={[{ label: 'Warehouse', href: '/warehouse' }, { label: 'Replenishment' }]}
        actions={rows.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Replenishment Plan', subtitle: supplierFilter || 'All suppliers', columns: exportCols, rows: exportRows, fileName: 'replenishment-plan' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Replenishment Plan', subtitle: supplierFilter || 'All suppliers', columns: exportCols, rows: exportRows, fileName: 'replenishment-plan' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={ShoppingCart} title="Nothing to reorder" description="Items with a reorder level set will appear here when stock drops to or below that level." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Items to reorder</div><div className="text-2xl font-bold mt-1">{filtered.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Out of stock</div><div className="text-2xl font-bold mt-1" style={{ color: outCount ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{outCount}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Suppliers</div><div className="text-2xl font-bold mt-1">{suppliers.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Est. order value</div><div className="text-xl font-bold mt-1">{aed(totalValue)}</div></Card>
          </div>

          <Card className="p-4">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Supplier filter</label>
            <select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)} className="w-full md:max-w-md mt-1 px-3 h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
              <option value="">All suppliers</option>{suppliers.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-2">Adjust suggested quantities below, then export the plan to raise purchase requests.</p>
          </Card>

          {bySupplier.length > 1 && (
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Estimated order value by supplier</div>
              <div style={{ width: '100%', height: 220 }}>
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
          )}

          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Item</th><th className="p-3">Supplier</th><th className="p-3 text-right">Available</th>
                <th className="p-3 text-right">Reorder lvl</th><th className="p-3 text-right">Shortfall</th>
                <th className="p-3 text-right">Suggested</th><th className="p-3 text-right">Avg cost</th><th className="p-3 text-right">Est. value</th>
              </tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3"><div className="font-medium text-[var(--text-primary)]">{r.item_code}</div><div className="text-[11px] text-[var(--text-tertiary)] line-clamp-1">{r.description}{r.unit ? ` · ${r.unit}` : ''}</div></td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{r.supplier}</td>
                    <td className="p-3 text-right tabular-nums" style={{ color: r.risk === 'OUT' ? 'var(--status-danger-text)' : 'var(--text-secondary)' }}>{num(r.available)}</td>
                    <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{num(r.reorder_level)}</td>
                    <td className="p-3 text-right tabular-nums">{num(r.shortfall)}</td>
                    <td className="p-3 text-right">
                      <input type="number" value={edits[r.id] ?? String(r.suggested)} onChange={e => setEdits(s => ({ ...s, [r.id]: e.target.value }))} className="w-24 px-2 h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm text-right tabular-nums" />
                    </td>
                    <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{aed(r.avg_cost)}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{aed(estValue(r))}</td>
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
