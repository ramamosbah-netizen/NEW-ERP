'use client';

// ============================================================
// JEET ERP — Warehouse: Serial Number Tracking
// Per-serial lifecycle + warranty expiry. Reuses getSerialUnits
// (hardened) + getStockItems for item labels. No migration.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import stockService from '@/services/stockService';
import warehouseService from '@/services/warehouseService';
import type { SerialUnit, StockItem } from '@/types/stock.types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { ScanLine, FileDown, Sheet, Search } from 'lucide-react';

const DAY = 86400000;
const STATUSES = ['IN_STORE', 'ISSUED', 'INSTALLED', 'FAULTY', 'RETURNED'];
const statusStyle: Record<string, { bg: string; tx: string }> = {
  IN_STORE: { bg: 'var(--status-success-bg)', tx: 'var(--status-success-text)' },
  ISSUED: { bg: 'var(--status-info-bg)', tx: 'var(--status-info-text)' },
  INSTALLED: { bg: 'var(--status-neutral-bg)', tx: 'var(--status-neutral-text)' },
  FAULTY: { bg: 'var(--status-danger-bg)', tx: 'var(--status-danger-text)' },
  RETURNED: { bg: 'var(--status-warning-bg)', tx: 'var(--status-warning-text)' },
};

export default function SerialTrackingPage() {
  const [serials, setSerials] = useState<SerialUnit[]>([]);
  const [itemMap, setItemMap] = useState<Map<string, StockItem>>(new Map());
  const [locations, setLocations] = useState<{ id: string; name: string; location_code: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [units, items, locs] = await Promise.all([
          stockService.getSerialUnits().catch(() => [] as SerialUnit[]),
          stockService.getStockItems().catch(() => [] as StockItem[]),
          warehouseService.getLocations().catch(() => [] as any[]),
        ]);
        setSerials(units);
        setItemMap(new Map(items.map(it => [it.id, it])));
        setLocations(locs);
      } finally { setLoading(false); }
    })();
  }, []);

  const wStatus = (exp?: string | null) => {
    if (!exp) return null;
    const days = Math.ceil((new Date(exp).getTime() - Date.now()) / DAY);
    if (days < 0) return { label: 'Expired', color: 'var(--status-danger-text)' };
    if (days <= 30) return { label: `${days}d left`, color: 'var(--status-warning-text)' };
    return { label: exp.slice(0, 10), color: 'var(--text-secondary)' };
  };

  const rows = useMemo(() => serials.filter(s => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (locationFilter && s.current_location_id !== locationFilter) return false;
    if (search) {
      const it = itemMap.get(s.stock_item_id);
      const hay = `${s.serial_no} ${it?.item_code || ''} ${it?.description || ''}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  }), [serials, statusFilter, locationFilter, search, itemMap]);

  const counts = (st: string) => serials.filter(s => s.status === st).length;
  const expiringSoon = serials.filter(s => { if (!s.warranty_expiry) return false; const d = Math.ceil((new Date(s.warranty_expiry).getTime() - Date.now()) / DAY); return d >= 0 && d <= 30; }).length;

  const exportCols = ['Serial', 'Item', 'Description', 'Status', 'Location', 'Project', 'Warranty expiry'];
  const exportRows = rows.map(s => { const it = itemMap.get(s.stock_item_id); return [s.serial_no, it?.item_code || '', it?.description || '', s.status, s.location_name || '', s.project_name || '', s.warranty_expiry ? s.warranty_expiry.slice(0, 10) : '']; });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Serial Number Tracking"
        subtitle="Per-serial lifecycle, location, project deployment and warranty expiry"
        breadcrumbs={[{ label: 'Warehouse', href: '/warehouse' }, { label: 'Serials' }]}
        actions={rows.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Serial Units', columns: exportCols, rows: exportRows, fileName: 'serial-units' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Serial Units', columns: exportCols, rows: exportRows, fileName: 'serial-units' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : serials.length === 0 ? (
        <Card><EmptyState icon={ScanLine} title="No serialized stock" description="Serial-tracked items appear here once received against a serialized stock item." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total</div><div className="text-2xl font-bold mt-1">{serials.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">In store</div><div className="text-2xl font-bold mt-1">{counts('IN_STORE')}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Issued</div><div className="text-2xl font-bold mt-1">{counts('ISSUED')}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Installed</div><div className="text-2xl font-bold mt-1">{counts('INSTALLED')}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Faulty</div><div className="text-2xl font-bold mt-1" style={{ color: counts('FAULTY') ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{counts('FAULTY')}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Warranty ≤30d</div><div className="text-2xl font-bold mt-1" style={{ color: expiringSoon ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{expiringSoon}</div></Card>
          </div>

          <Card className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search serial / item…" className="w-full pl-7 pr-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm"><option value="">All statuses</option>{STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select>
            <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)} className="px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm"><option value="">All locations</option>{locations.map(l => <option key={l.id} value={l.id}>{l.location_code} — {l.name}</option>)}</select>
          </Card>

          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Serial</th><th className="p-3">Item</th><th className="p-3">Status</th>
                <th className="p-3">Location</th><th className="p-3">Project</th><th className="p-3">Warranty</th>
              </tr></thead>
              <tbody>
                {rows.map(s => { const it = itemMap.get(s.stock_item_id); const st = statusStyle[s.status] || statusStyle.IN_STORE; const w = wStatus(s.warranty_expiry); return (
                  <tr key={s.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3 font-mono text-xs text-[var(--text-primary)]">{s.serial_no}</td>
                    <td className="p-3"><div className="text-[var(--text-primary)]">{it?.item_code || '—'}</div><div className="text-[11px] text-[var(--text-tertiary)] line-clamp-1">{it?.description}</div></td>
                    <td className="p-3"><span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.tx }}>{s.status.replace('_', ' ')}</span></td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{s.location_name || '—'}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{s.project_name || '—'}</td>
                    <td className="p-3 text-xs" style={{ color: w?.color || 'var(--text-tertiary)' }}>{w?.label || '—'}</td>
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
