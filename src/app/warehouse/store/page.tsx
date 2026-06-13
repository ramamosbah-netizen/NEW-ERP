'use client';

// ============================================================
// JEET ERP — Store (Stock on hand + risk)
// Registered goods/materials with quantities across locations
// and stock-risk indicators (out / below reorder level).
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import warehouseService, { StockRow } from '@/services/warehouseService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Package, Search, AlertTriangle } from 'lucide-react';

const RISK: Record<string, { label: string; bg: string; text: string; border: string }> = {
  OUT: { label: 'Out of stock', bg: 'var(--status-danger-bg)', text: 'var(--status-danger-text)', border: 'var(--status-danger-border)' },
  LOW: { label: 'Below reorder', bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)', border: 'var(--status-warning-border)' },
  OK: { label: 'In stock', bg: 'var(--status-success-bg)', text: 'var(--status-success-text)', border: 'var(--status-success-border)' },
  NONE: { label: '—', bg: 'var(--status-neutral-bg)', text: 'var(--status-neutral-text)', border: 'var(--status-neutral-border)' },
};

const fmtAED = (v: number) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(v) + ' AED';
const fmtQty = (v: number) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 3 }).format(v);

export default function StorePage() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [riskOnly, setRiskOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await warehouseService.getStock()); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter(r => {
    if (riskOnly && !(r.risk === 'OUT' || r.risk === 'LOW')) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return r.item_code.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
  });

  const totalValue = rows.reduce((s, r) => s + r.stock_value, 0);
  const atRisk = rows.filter(r => r.risk === 'OUT' || r.risk === 'LOW').length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Store"
        subtitle="Registered goods and materials on hand, valuation and stock-risk alerts"
        breadcrumbs={[{ label: 'Warehouse', href: '/warehouse' }, { label: 'Store' }]}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Stock items', value: rows.length },
          { label: 'Stock value', value: fmtAED(totalValue) },
          { label: 'At risk', value: atRisk, alert: atRisk > 0 },
          { label: 'Out of stock', value: rows.filter(r => r.risk === 'OUT').length, alert: rows.some(r => r.risk === 'OUT') },
        ].map(k => (
          <div key={k.label} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-3">
            <span className="text-xs text-[var(--text-muted)] block">{k.label}</span>
            <span className={`text-lg font-semibold ${k.alert ? 'text-[var(--error)]' : 'text-[var(--text-primary)]'}`}>{k.value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
          <input className="quote-form-input w-full !pl-9" placeholder="Search item code or description…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
          <input type="checkbox" checked={riskOnly} onChange={e => setRiskOnly(e.target.checked)} /> At-risk only
        </label>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><div className="h-7 w-7 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] animate-spin rounded-full" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Package} title="No stock registered yet" description="Stock appears here automatically as goods are received (GRN) into store locations. Register stock items and locations to begin tracking on-hand quantities and risk." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="No matches" description="No stock items match your filters." />
      ) : (
        <Card padding={false}>
          <div className="quote-table-wrap !border-0 !rounded-none">
            <table className="quote-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>On hand</th>
                  <th>Available</th>
                  <th>Reserved</th>
                  <th>Avg cost</th>
                  <th>Value</th>
                  <th>Reorder</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const rk = RISK[r.risk];
                  return (
                    <tr key={r.stock_item_id}>
                      <td>
                        <div className="flex flex-col">
                          <span className="font-medium text-[var(--text-primary)] text-xs">{r.description}</span>
                          <span className="font-mono text-[0.6875rem] text-[var(--text-muted)]">{r.item_code} · {r.unit}</span>
                        </div>
                      </td>
                      <td><span className="font-mono text-xs">{fmtQty(r.qty_on_hand)}</span></td>
                      <td><span className="font-mono text-xs">{fmtQty(r.qty_available)}</span></td>
                      <td><span className="font-mono text-xs text-[var(--text-muted)]">{fmtQty(r.qty_reserved)}</span></td>
                      <td><span className="font-mono text-xs">{r.avg_unit_cost.toFixed(2)}</span></td>
                      <td><span className="font-mono text-xs">{fmtAED(r.stock_value)}</span></td>
                      <td><span className="font-mono text-xs text-[var(--text-muted)]">{r.reorder_level != null ? fmtQty(r.reorder_level) : '—'}</span></td>
                      <td>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.6875rem] font-medium border"
                          style={{ backgroundColor: rk.bg, color: rk.text, borderColor: rk.border }}>
                          {(r.risk === 'OUT' || r.risk === 'LOW') && <AlertTriangle size={10} />}
                          {rk.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
