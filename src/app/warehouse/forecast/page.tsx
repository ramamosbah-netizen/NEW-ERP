'use client';

// ============================================================
// JEET ERP — Warehouse: Material Forecasting
// Open demand (from un-issued MRF lines) vs on-hand availability →
// net position + shortfall to procure per item. Complements the
// reorder-level Replenishment view. Read-only; no migration.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import mrfService from '@/services/mrfService';
import stockService from '@/services/stockService';
import warehouseService, { StockRow } from '@/services/warehouseService';
import { supabase } from '@/lib/supabase';
import type { StockItem } from '@/types/stock.types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { LineChart as LineIcon, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const OPEN_MRF = ['DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_ISSUED'];
const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const num = (n: number) => Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 3 });

interface Row {
  stock_item_id: string; item_code: string; description: string; unit: string;
  available: number; demand: number; net: number; shortfall: number;
  avg_cost: number; supplier: string;
}

export default function MaterialForecastPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [shortOnly, setShortOnly] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [mrfs, stock, items] = await Promise.all([
          mrfService.getMRFs().catch(() => []),
          warehouseService.getStock().catch(() => [] as StockRow[]),
          stockService.getStockItems().catch(() => [] as StockItem[]),
        ]);
        const openIds = mrfs.filter(m => OPEN_MRF.includes(m.status)).map(m => m.id);
        const demandMap = new Map<string, number>();
        if (openIds.length) {
          const { data: lines } = await supabase
            .from('mrf_items')
            .select('mrf_id, stock_item_id, qty_requested, qty_approved, qty_issued')
            .in('mrf_id', openIds);
          (lines || []).forEach((l: any) => {
            const base = Number(l.qty_approved || 0) > 0 ? Number(l.qty_approved) : Number(l.qty_requested || 0);
            const outstanding = Math.max(0, base - Number(l.qty_issued || 0));
            if (outstanding > 0) demandMap.set(l.stock_item_id, (demandMap.get(l.stock_item_id) || 0) + outstanding);
          });
        }
        const stockById = new Map(stock.map(s => [s.stock_item_id, s]));
        const itemById = new Map(items.map(it => [it.id, it]));
        const out: Row[] = [];
        demandMap.forEach((demand, sid) => {
          const s = stockById.get(sid);
          const it = itemById.get(sid);
          const available = s ? Number(s.qty_available || 0) : 0;
          const net = available - demand;
          out.push({
            stock_item_id: sid,
            item_code: it?.item_code || s?.item_code || '—',
            description: it?.description || s?.description || '',
            unit: it?.unit || s?.unit || '',
            available, demand, net, shortfall: Math.max(0, -net),
            avg_cost: s ? Number(s.avg_unit_cost || 0) : 0,
            supplier: it?.supplier_name || 'Unassigned',
          });
        });
        setRows(out.sort((a, b) => b.shortfall - a.shortfall || b.demand - a.demand));
      } finally { setLoading(false); }
    })();
  }, []);

  const filtered = shortOnly ? rows.filter(r => r.shortfall > 0) : rows;
  const shortItems = rows.filter(r => r.shortfall > 0);
  const shortfallValue = shortItems.reduce((s, r) => s + r.shortfall * r.avg_cost, 0);
  const totalDemand = rows.reduce((s, r) => s + r.demand, 0);

  const topShort = useMemo(() => shortItems.slice(0, 8).map(r => ({ name: r.item_code, value: Math.round(r.shortfall * r.avg_cost) })), [rows]);

  const exportCols = ['Item', 'Description', 'Supplier', 'On hand', 'Open demand', 'Net', 'Shortfall', 'Avg cost', 'Shortfall value'];
  const exportRows = filtered.map(r => [r.item_code, r.description, r.supplier, num(r.available), num(r.demand), num(r.net), num(r.shortfall), r.avg_cost, Math.round(r.shortfall * r.avg_cost)]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Material Forecasting"
        subtitle="Open requisition demand vs available stock — projected shortfalls to procure"
        breadcrumbs={[{ label: 'Warehouse', href: '/warehouse' }, { label: 'Forecasting' }]}
        actions={rows.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Material Forecast', columns: exportCols, rows: exportRows, fileName: 'material-forecast' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Material Forecast', columns: exportCols, rows: exportRows, fileName: 'material-forecast' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Computing forecast…</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={LineIcon} title="No open demand" description="When requisitions are raised but not fully issued, demand vs stock is forecast here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Items in demand</div><div className="text-2xl font-bold mt-1">{rows.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Open demand qty</div><div className="text-2xl font-bold mt-1">{num(totalDemand)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Items short</div><div className="text-2xl font-bold mt-1" style={{ color: shortItems.length ? 'var(--status-danger-text)' : 'var(--status-success-text)' }}>{shortItems.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Shortfall value</div><div className="text-xl font-bold mt-1" style={{ color: shortfallValue ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{aed(shortfallValue)}</div></Card>
          </div>

          {topShort.length > 0 && (
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Top shortfalls by value</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={topShort} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <Tooltip formatter={(v: any) => aed(v)} />
                    <Bar dataKey="value" fill="var(--status-danger-text)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <Card className="p-4">
            <label className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
              <input type="checkbox" checked={shortOnly} onChange={e => setShortOnly(e.target.checked)} /> Show shortfalls only
            </label>
          </Card>

          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Item</th><th className="p-3">Supplier</th><th className="p-3 text-right">On hand</th>
                <th className="p-3 text-right">Open demand</th><th className="p-3 text-right">Net</th>
                <th className="p-3 text-right">Procure</th><th className="p-3 text-right">Shortfall value</th>
              </tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.stock_item_id} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3"><div className="font-medium text-[var(--text-primary)]">{r.item_code}</div><div className="text-[11px] text-[var(--text-tertiary)] line-clamp-1">{r.description}{r.unit ? ` · ${r.unit}` : ''}</div></td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{r.supplier}</td>
                    <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{num(r.available)}</td>
                    <td className="p-3 text-right tabular-nums">{num(r.demand)}</td>
                    <td className="p-3 text-right tabular-nums font-medium" style={{ color: r.net < 0 ? 'var(--status-danger-text)' : 'var(--status-success-text)' }}>{num(r.net)}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{r.shortfall > 0 ? num(r.shortfall) : '—'}</td>
                    <td className="p-3 text-right tabular-nums">{r.shortfall > 0 ? aed(r.shortfall * r.avg_cost) : '—'}</td>
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
