'use client';

// ============================================================
// JEET ERP — Warehouse: Dead Stock Dashboard
// Items with no movement for N days and positive stock on hand.
// Reuses stockService.getDeadStockReport; write-off shortcut posts
// a WRITE_OFF movement. No migration.
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import stockService from '@/services/stockService';
import stockTransactionService from '@/services/stockTransactionService';
import type { StockBalance } from '@/types/stock.types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { PackageX, FileDown, Sheet, Trash2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

type DeadRow = StockBalance & { age_days: number; category?: string };
const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const num = (n: number) => Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 3 });

export default function DeadStockPage() {
  const [days, setDays] = useState(180);
  const [rows, setRows] = useState<DeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await stockService.getDeadStockReport(days) as DeadRow[]); }
    finally { setLoading(false); }
  }, [days]);
  useEffect(() => { load(); }, [load]);

  const valueOf = (r: DeadRow) => Number(r.qty_on_hand || 0) * Number(r.avg_unit_cost || 0);
  const totalValue = rows.reduce((s, r) => s + valueOf(r), 0);
  const oldest = rows.reduce((m, r) => Math.max(m, r.age_days || 0), 0);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach(r => { const k = (r.category as string) || 'Unassigned'; m.set(k, (m.get(k) || 0) + valueOf(r)); });
    return [...m.entries()].map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [rows]);

  const writeOff = async (r: DeadRow) => {
    const qty = Number(r.qty_on_hand || 0);
    if (qty <= 0) return;
    if (!confirm(`Write off all ${num(qty)} ${r.unit || ''} of "${r.item_code}" at ${r.location_name}?\nValue: ${aed(valueOf(r))}. This posts a WRITE_OFF movement.`)) return;
    const reason = prompt('Reason for write-off:', `Dead stock (${r.age_days} days no movement)`);
    if (reason === null) return;
    setBusy(r.id);
    try {
      await stockTransactionService.recordTransaction({
        type: 'WRITE_OFF',
        stock_item_id: r.stock_item_id,
        location_id: r.location_id,
        qty: -qty,
        unit_cost: Number(r.avg_unit_cost || 0),
        total_value: qty * Number(r.avg_unit_cost || 0),
        source_type: 'MANUAL',
        source_id: null,
        reason: reason || 'Dead stock write-off',
      } as any);
      await load();
    } catch (e: any) { alert(e?.message || 'Write-off failed'); } finally { setBusy(null); }
  };

  const exportCols = ['Item', 'Description', 'Category', 'Location', 'Qty', 'Avg cost', 'Value', 'Last movement', 'Age (d)'];
  const exportRows = [...rows].sort((a, b) => valueOf(b) - valueOf(a))
    .map(r => [r.item_code || '', r.description || '', (r.category as string) || '', r.location_name || '', num(r.qty_on_hand), r.avg_unit_cost, Math.round(valueOf(r)), r.last_movement_at ? r.last_movement_at.slice(0, 10) : '—', r.age_days]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Dead Stock Dashboard"
        subtitle="Stock with no movement and capital tied up — review and write off"
        breadcrumbs={[{ label: 'Warehouse', href: '/warehouse' }, { label: 'Dead Stock' }]}
        actions={rows.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: `Dead Stock (>${days} days)`, columns: exportCols, rows: exportRows, fileName: 'dead-stock' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: `Dead Stock (>${days} days)`, columns: exportCols, rows: exportRows, fileName: 'dead-stock' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      <Card className="p-4">
        <label className="text-xs font-medium text-[var(--text-secondary)]">No movement for at least</label>
        <select value={days} onChange={e => setDays(Number(e.target.value))} className="w-full md:max-w-xs mt-1 px-3 h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
          <option value={90}>90 days</option><option value={180}>180 days</option><option value={365}>365 days</option>
        </select>
      </Card>

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={PackageX} title="No dead stock" description={`No items have sat unmoved for ${days}+ days with stock on hand. Healthy inventory!`} /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Dead SKUs</div><div className="text-2xl font-bold mt-1">{rows.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Capital tied up</div><div className="text-xl font-bold mt-1" style={{ color: 'var(--status-danger-text)' }}>{aed(totalValue)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Oldest</div><div className="text-2xl font-bold mt-1">{oldest}<span className="text-sm font-normal text-[var(--text-tertiary)]">d</span></div></Card>
          </div>

          {byCategory.length > 1 && (
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Dead value by category</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={byCategory} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <Tooltip formatter={(v: any) => aed(v)} />
                    <Bar dataKey="value" fill="var(--status-danger-text)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Item</th><th className="p-3">Location</th><th className="p-3 text-right">Qty</th>
                <th className="p-3 text-right">Value</th><th className="p-3">Last movement</th><th className="p-3 text-right">Age</th><th className="p-3 text-right">Action</th>
              </tr></thead>
              <tbody>
                {[...rows].sort((a, b) => valueOf(b) - valueOf(a)).map(r => (
                  <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3"><div className="font-medium text-[var(--text-primary)]">{r.item_code}</div><div className="text-[11px] text-[var(--text-tertiary)] line-clamp-1">{r.description}{r.unit ? ` · ${r.unit}` : ''}</div></td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{r.location_name}</td>
                    <td className="p-3 text-right tabular-nums">{num(r.qty_on_hand)}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{aed(valueOf(r))}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{r.last_movement_at ? r.last_movement_at.slice(0, 10) : '—'}</td>
                    <td className="p-3 text-right tabular-nums" style={{ color: 'var(--status-danger-text)' }}>{r.age_days}d</td>
                    <td className="p-3 text-right">
                      <button onClick={() => writeOff(r)} disabled={busy === r.id} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-[var(--border)] hover:border-[var(--status-danger-border)] hover:text-[var(--status-danger-text)] disabled:opacity-50"><Trash2 size={12} />{busy === r.id ? '…' : 'Write off'}</button>
                    </td>
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
