'use client';

// ============================================================
// JEET ERP — Warehouse: Stock Count / Stock-take (list)
// Surfaces stockCountService: start a physical count per location,
// then reconcile on the count-sheet detail page.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import stockCountService from '@/services/stockCountService';
import warehouseService from '@/services/warehouseService';
import type { StockCount } from '@/types/stock.types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ClipboardCheck, Plus } from 'lucide-react';

const statusStyle: Record<string, { bg: string; tx: string }> = {
  IN_PROGRESS: { bg: 'var(--status-warning-bg)', tx: 'var(--status-warning-text)' },
  PENDING_REVIEW: { bg: 'var(--status-info-bg)', tx: 'var(--status-info-text)' },
  POSTED: { bg: 'var(--status-success-bg)', tx: 'var(--status-success-text)' },
  CANCELLED: { bg: 'var(--status-neutral-bg)', tx: 'var(--status-neutral-text)' },
};

export default function StockCountListPage() {
  const router = useRouter();
  const [counts, setCounts] = useState<StockCount[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string; location_code: string; type: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationFilter, setLocationFilter] = useState('');
  const [modal, setModal] = useState(false);
  const [newLocation, setNewLocation] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => { warehouseService.getLocations().then(setLocations).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try { setCounts(await stockCountService.getStockCounts(locationFilter || undefined)); }
    finally { setLoading(false); }
  }, [locationFilter]);
  useEffect(() => { load(); }, [load]);

  const start = async () => {
    if (!newLocation) { alert('Select a location to count.'); return; }
    setStarting(true);
    try {
      const id = await stockCountService.startStockCount(newLocation);
      router.push(`/warehouse/stock-count/${id}`);
    } catch (e: any) { alert(e?.message || 'Could not start count'); setStarting(false); }
  };

  const inProgress = counts.filter(c => c.status === 'IN_PROGRESS' || c.status === 'PENDING_REVIEW').length;
  const posted = counts.filter(c => c.status === 'POSTED').length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Stock Count / Stock-take"
        subtitle="Freeze a location, count physical stock, and post variances to the ledger"
        breadcrumbs={[{ label: 'Warehouse', href: '/warehouse' }, { label: 'Stock Count' }]}
        actions={<Button icon={Plus} onClick={() => { setNewLocation(''); setModal(true); }}>Start count</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Open counts</div><div className="text-2xl font-bold mt-1" style={{ color: inProgress ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{inProgress}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Posted</div><div className="text-2xl font-bold mt-1">{posted}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total counts</div><div className="text-2xl font-bold mt-1">{counts.length}</div></Card>
      </div>

      <Card className="p-4">
        <label className="text-xs font-medium text-[var(--text-secondary)]">Location filter</label>
        <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)} className="w-full md:max-w-md mt-1 px-3 h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
          <option value="">All locations</option>{locations.map(l => <option key={l.id} value={l.id}>{l.location_code} — {l.name}</option>)}
        </select>
      </Card>

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : counts.length === 0 ? (
        <Card><EmptyState icon={ClipboardCheck} title="No stock counts" description="Start a count to freeze a location and reconcile physical stock." /></Card>
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
              <th className="p-3">Count #</th><th className="p-3">Location</th><th className="p-3">Date</th><th className="p-3">Counted by</th><th className="p-3">Status</th>
            </tr></thead>
            <tbody>
              {counts.map(c => { const st = statusStyle[c.status] || statusStyle.CANCELLED; return (
                <tr key={c.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/warehouse/stock-count/${c.id}`)}>
                  <td className="p-3 font-medium text-[var(--text-primary)]">{c.count_number}</td>
                  <td className="p-3 text-[var(--text-secondary)]">{c.location_name}</td>
                  <td className="p-3 text-xs text-[var(--text-secondary)]">{c.count_date}</td>
                  <td className="p-3 text-xs text-[var(--text-secondary)]">{c.counter_name || '—'}</td>
                  <td className="p-3"><span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.tx }}>{c.status.replace('_', ' ')}</span></td>
                </tr>
              ); })}
            </tbody>
          </table>
        </Card>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(false)}>
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <div className="text-base font-semibold mb-1">Start stock count</div>
            <p className="text-xs text-[var(--text-tertiary)] mb-3">This freezes the location&apos;s current system quantities as the baseline. You then enter the physical counted quantities.</p>
            <label className="text-xs text-[var(--text-secondary)]">Location
              <select value={newLocation} onChange={e => setNewLocation(e.target.value)} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
                <option value="">Select…</option>{locations.map(l => <option key={l.id} value={l.id}>{l.location_code} — {l.name}</option>)}
              </select>
            </label>
            <div className="flex justify-end gap-2 mt-4"><Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button><Button onClick={start} isLoading={starting}>Start</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
